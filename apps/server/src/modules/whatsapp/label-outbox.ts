import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { WhatsappSocket } from './socket-factory.js';

const payloadSchema = z.object({
  sessionId: z.string(),
  contactId: z.string(),
  labelId: z.string(),
  jid: z.string(),
  whatsappId: z.string(),
  active: z.boolean().default(true),
});
const jobTypes = ['WHATSAPP_ADD_LABEL', 'WHATSAPP_SET_LABEL'];

export class LabelOutbox {
  private running = false;
  private stopped = false;
  private timer?: ReturnType<typeof setTimeout>;
  private work: Promise<void> = Promise.resolve();

  constructor(
    private readonly db: PrismaClient,
    private readonly connected: (id: string) => WhatsappSocket | undefined,
    private readonly notify: (sessionId: string) => void = () => undefined,
  ) {}

  async start() {
    // A delivery interrupted by shutdown is retried; adding a label is idempotent.
    await this.db.scheduledJob.updateMany({
      where: { type: { in: jobTypes }, status: 'RUNNING' },
      data: { status: 'QUEUED', lockedAt: null },
    });
    this.schedule();
  }

  private schedule() {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.work = this.flush()
        .catch(() => undefined)
        .finally(() => this.schedule());
    }, 2000).unref();
  }

  async flush() {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      const jobs = await this.db.scheduledJob.findMany({
        where: { type: { in: jobTypes }, status: 'QUEUED', runAt: { lte: new Date() } },
        orderBy: [{ runAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        take: 20,
      });
      for (const job of jobs) {
        if (this.stopped) break;
        const parsed = payloadSchema.safeParse(job.payload);
        if (!parsed.success) {
          await this.db.scheduledJob.update({
            where: { id: job.id },
            data: { status: 'FAILED', error: 'Dados de etiqueta inválidos.' },
          });
          continue;
        }
        const data = parsed.data;
        const socket = this.connected(data.sessionId);
        if (!socket) continue;
        const label = await this.db.label.findUnique({ where: { id: data.labelId } });
        const link = await this.db.contactLabel.findUnique({
          where: { contactId_labelId: { contactId: data.contactId, labelId: data.labelId } },
        });
        if (!label || label.isDeleted || (job.type === 'WHATSAPP_ADD_LABEL' && !link)) {
          await this.db.scheduledJob.update({ where: { id: job.id }, data: { status: 'CANCELLED' } });
          this.notify(data.sessionId);
          continue;
        }
        const claim = await this.db.scheduledJob.updateMany({
          where: { id: job.id, status: 'QUEUED' },
          data: { status: 'RUNNING', lockedAt: new Date(), attempts: { increment: 1 } },
        });
        if (!claim.count) continue;
        try {
          if (data.active) await socket.addChatLabel(data.jid, data.whatsappId);
          else {
            if (!socket.removeChatLabel) throw new Error('Remoção indisponível.');
            await socket.removeChatLabel(data.jid, data.whatsappId);
          }
          await this.db.$transaction(async (tx) => {
            const completed = await tx.scheduledJob.updateMany({
              where: { id: job.id, status: 'RUNNING' },
              data: { status: 'COMPLETED', lockedAt: null, error: null },
            });
            if (completed.count && job.type === 'WHATSAPP_SET_LABEL') {
              const key = { contactId: data.contactId, labelId: data.labelId };
              if (data.active)
                await tx.contactLabel.upsert({ where: { contactId_labelId: key }, create: key, update: {} });
              else await tx.contactLabel.deleteMany({ where: key });
            }
          });
          this.notify(data.sessionId);
        } catch {
          await this.db.scheduledJob.updateMany({
            where: { id: job.id, status: 'RUNNING' },
            data: {
              status: job.attempts + 1 >= job.maxAttempts ? 'FAILED' : 'QUEUED',
              lockedAt: null,
              runAt: new Date(Date.now() + Math.min(60_000, 2000 * 2 ** job.attempts)),
              error: 'WhatsApp não confirmou a alteração da etiqueta.',
            },
          });
          this.notify(data.sessionId);
        }
      }
    } finally {
      this.running = false;
    }
  }

  async stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.work;
  }
}
