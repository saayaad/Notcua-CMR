import type { PrismaClient } from '@prisma/client';
import type { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { record, putRecord, type BusinessSettings } from './records.js';
import { json } from '../backups/validation.js';
import { remindNextActions } from './next-actions.js';
import { teamDirectory } from './team-directory.js';
export class BusinessWorker {
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private work: Promise<void> = Promise.resolve();
  constructor(
    private db: PrismaClient,
    private whatsapp: WhatsappService,
    private readonly now: () => Date = () => new Date(),
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
    await this.nightSummary();
    const settings = await record<BusinessSettings>(this.db, 'settings:business', {});
    const minutes = settings.autoCloseMinutes;
    if (settings.distribution) {
      const team = (await teamDirectory(this.db)).filter((member) => member.active && member.online);
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
  private async nightSummary() {
    const now = this.now();
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
    if (Number(part('hour')) < 8) return;
    const day = `${part('year')}-${part('month')}-${part('day')}`;
    const marker = await record<{ day?: string }>(this.db, 'night-summary:last-run', {});
    if (marker.day === day) return;
    const sessions = await this.db.whatsappSession.findMany({ select: { id: true } });
    const since = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    for (const session of sessions) {
      const chats = await this.db.conversation.findMany({
        where: { sessionId: session.id, status: 'OPEN', lastMessageAt: { gte: since }, contact: { isGroup: false } },
        include: { contact: true, messages: { where: { sentAt: { gte: since } }, orderBy: [{ sentAt: 'desc' }, { id: 'desc' }], take: 12 } },
        take: 200,
      });
      const priority = chats.map((chat) => {
        const lastInbound = chat.messages.find((message) => message.direction === 'INBOUND');
        const lastOutbound = chat.messages.find((message) => message.direction === 'OUTBOUND' && message.type !== 'internalNote');
        const awaiting = Boolean(lastInbound && (!lastOutbound || lastInbound.sentAt > lastOutbound.sentAt));
        const transcript = chat.messages.map((message) => message.text ?? message.caption ?? '').join(' ').toLocaleLowerCase('pt-BR');
        const closing = /pre[cç]o|valor|pagamento|pix|prazo|or[cç]amento|fechar|cria[cç][aã]o/.test(transcript);
        return { chat, awaiting, closing };
      }).filter((item) => item.awaiting || item.closing).sort((a, b) => Number(b.awaiting) - Number(a.awaiting)).slice(0, 30);
      if (!priority.length) continue;
      const lines = priority.map(({ chat, awaiting, closing }, index) => `${index + 1}. ${chat.contact.name} · ${awaiting ? 'aguardando retorno do atendente' : 'conversa com possível intenção de compra'}${closing ? ' · menciona preço/pagamento/prazo' : ''} · conversa ${chat.id}`);
      await putRecord(this.db, `night-summary:${session.id}:${day}`, 'NOTICE', {
        title: 'Resumo do turno noturno · prioridade de hoje',
        text: lines.join('\n'),
        sessionId: session.id,
        createdAt: now.toISOString(),
        read: false,
      });
    }
    await putRecord(this.db, 'night-summary:last-run', 'STATE', { day });
  }
}
