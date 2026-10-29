import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { putRecord, record, type BusinessSettings } from './records.js';

const scheduleSchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  minTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  maxTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});
export const businessHoursReplySchema = z.object({
  schedule: scheduleSchema.nullable().optional(),
  afterHoursReplyEnabled: z.boolean().optional(),
  afterHoursReplyText: z.string().trim().max(2000).optional(),
}).refine(
  (value) => !value.afterHoursReplyEnabled || Boolean(value.schedule && value.afterHoursReplyText),
  'Configure o horário e a mensagem antes de ativar a resposta fora do horário.',
);

type Schedule = z.infer<typeof scheduleSchema>;
const zone = 'America/Sao_Paulo';
function localParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return {
    day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(part('weekday')),
    clock: `${part('hour')}:${part('minute')}`,
    date: `${part('year')}-${part('month')}-${part('day')}`,
  };
}
export function withinBusinessHours(schedule: Schedule, date: Date) {
  const { day, clock } = localParts(date);
  const { days, minTime, maxTime } = schedule;
  if (minTime === maxTime) return days.includes(day);
  if (minTime < maxTime) return days.includes(day) && clock >= minTime && clock < maxTime;
  return clock >= minTime ? days.includes(day) : clock < maxTime && days.includes((day + 6) % 7);
}

interface Cursor { receivedAt: string; messageId: string }
interface ReplySender {
  send(sessionId: string, conversationId: string, input: unknown): Promise<unknown>;
}
const cursorId = 'business-hours:last-inbound';
export class BusinessHoursReplyWorker {
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private flushing = false;
  private work: Promise<void> = Promise.resolve();
  constructor(
    private readonly db: PrismaClient,
    private readonly messaging: ReplySender,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async start() {
    const existing = await this.db.operationRecord.findUnique({ where: { id: cursorId } });
    if (!existing) await putRecord(this.db, cursorId, 'STATE', { receivedAt: this.now().toISOString(), messageId: '' });
    this.schedule();
  }
  private schedule() {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.work = this.flush().catch(() => undefined).finally(() => this.schedule());
    }, 10_000).unref();
  }
  async stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.work;
  }
  async flush() {
    if (this.stopped || this.flushing) return;
    this.flushing = true;
    try {
      const cursor = await record<Cursor | null>(this.db, cursorId, null);
      if (!cursor) return;
      const receivedAt = new Date(cursor.receivedAt);
      const events = await this.db.flowInboxEvent.findMany({
        where: {
          OR: [
            { receivedAt: { gt: receivedAt } },
            { receivedAt, messageId: { gt: cursor.messageId } },
          ],
        },
        orderBy: [{ receivedAt: 'asc' }, { messageId: 'asc' }],
        take: 100,
      });
      const settings = await record<BusinessSettings>(this.db, 'settings:business', {});
      const parsed = businessHoursReplySchema.safeParse(settings);
      for (const event of events) {
        if (parsed.success && parsed.data.afterHoursReplyEnabled && parsed.data.schedule && parsed.data.afterHoursReplyText)
          await this.reply(event, parsed.data.schedule, parsed.data.afterHoursReplyText);
        await putRecord(this.db, cursorId, 'STATE', {
          receivedAt: event.receivedAt.toISOString(), messageId: event.messageId,
        } satisfies Cursor);
      }
    } finally {
      this.flushing = false;
    }
  }

  private async reply(event: { messageId: string; receivedAt: Date }, schedule: Schedule, text: string) {
    if (withinBusinessHours(schedule, event.receivedAt)) return;
    const now = this.now();
    if (localParts(now).date !== localParts(event.receivedAt).date || withinBusinessHours(schedule, now)) return;
    const message = await this.db.chatMessage.findUnique({
      where: { id: event.messageId },
      include: { conversation: { include: { contact: true } } },
    });
    if (!message || message.direction !== 'INBOUND') return;
    const chat = message.conversation;
    if (chat.contact.isGroup || (chat.contact.metadata as { optOut?: boolean } | null)?.optOut) return;
    const date = localParts(event.receivedAt).date;
    const suffix = createHash('sha256')
      .update(`${chat.contactId}:${date}`)
      .digest('hex').slice(0, 32);
    const requestId = `after-hours-${suffix}`;
    const sentId = `business-hours:sent:${suffix}`;
    if (await this.db.operationRecord.findUnique({ where: { id: sentId } })) return;
    const previous = await this.db.chatMessage.findUnique({ where: { id: `out:${requestId}` } });
    if (previous?.status === 'PENDING' || previous?.status === 'FAILED') {
      await putRecord(this.db, sentId, 'AUTO_REPLY', { status: previous.status, date, messageId: event.messageId });
      return;
    }
    await this.messaging.send(chat.sessionId, chat.id, { requestId, kind: 'text', text, composingMs: 0 });
    await putRecord(this.db, sentId, 'AUTO_REPLY', { status: 'SENT', date, messageId: event.messageId });
  }
}
