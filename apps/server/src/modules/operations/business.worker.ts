import type { PrismaClient } from '@prisma/client';
import type { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { record, putRecord, type BusinessSettings } from './records.js';
import { json } from '../backups/validation.js';
import { remindNextActions } from './next-actions.js';
export class BusinessWorker {
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private work: Promise<void> = Promise.resolve();
  constructor(
    private db: PrismaClient,
    private whatsapp: WhatsappService,
  ) {}
  start() {
    this.schedule();
  }
  private schedule() {
    if (!this.stopped)
      this.timer = setTimeout(() => {
        this.work = this.flush()
          .catch(() => undefined)
          .finally(() => this.schedule());
      }, 60000).unref();
  }
  async stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.work;
  }
  async flush() {
    await remindNextActions(this.db, (sessionId) => this.whatsapp.notify(sessionId, 'messages'));
    const settings = await record<BusinessSettings>(this.db, 'settings:business', {});
    const minutes = settings.autoCloseMinutes;
    if (settings.distribution) {
      const team = (
        await this.db.operationRecord.findMany({ where: { kind: 'TEAM' }, orderBy: { id: 'asc' } })
      )
        .map((row) => row.data as { email: string; active: boolean; department?: string })
        .filter((member) => member.active);
      const unassigned = await this.db.conversation.findMany({
        where: { status: 'OPEN', assignedTo: '' },
        take: 100,
        include: { contact: true },
        orderBy: { createdAt: 'asc' },
      });
      let cursor = (await record(this.db, 'distribution:cursor', { next: 0 })).next;
      for (const chat of unassigned) {
        const department = (chat.contact.metadata as { department?: string }).department;
        const eligible = department ? team.filter((member) => member.department === department) : team;
        if (!eligible.length) continue;
        const member = eligible[cursor % eligible.length]!;
        await this.db.$transaction(async (tx) => {
          const claim = await tx.conversation.updateMany({
            where: { id: chat.id, assignedTo: '' },
            data: { assignedTo: member.email },
          });
          if (claim.count) {
            const contact = await tx.contact.findUniqueOrThrow({ where: { id: chat.contactId } });
            await tx.contact.update({
              where: { id: contact.id },
              data: { metadata: json({ ...(contact.metadata as object), assignedTo: member.email }) },
            });
          }
        });
        cursor++;
        this.whatsapp.notify(chat.sessionId, 'messages');
      }
      await putRecord(this.db, 'distribution:cursor', 'STATE', { next: cursor });
    }
    if (!minutes || minutes < 1 || minutes > 43200) return;
    const chats = await this.db.conversation.findMany({
      where: { status: 'OPEN', lastMessageAt: { lte: new Date(Date.now() - minutes * 60000) } },
      include: { messages: { orderBy: { sentAt: 'desc' }, take: 1 } },
      take: 500,
    });
    for (const chat of chats) {
      if (chat.messages[0]?.direction !== 'OUTBOUND') continue;
      if (
        await this.db.flowExecution.count({
          where: { conversationId: chat.id, status: { in: ['QUEUED', 'RUNNING', 'WAITING_INPUT'] } },
        })
      )
        continue;
      await this.db.conversation.updateMany({
        where: { id: chat.id, status: 'OPEN', lastMessageAt: chat.lastMessageAt },
        data: { status: 'CLOSED' },
      });
      this.whatsapp.notify(chat.sessionId, 'messages');
    }
  }
}
