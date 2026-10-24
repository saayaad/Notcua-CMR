import type { PrismaClient } from '@prisma/client';
import type { MessagingService } from '../attendance/messaging.service.js';
import type { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { generateSuggestion } from './ai.service.js';
import { putRecord, record, type AgentSettings } from './records.js';
export class AiWorker {
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private work: Promise<void> = Promise.resolve();
  private flushing = false;
  constructor(
    private db: PrismaClient,
    private whatsapp: WhatsappService,
    private messaging: MessagingService,
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
      }, 2000).unref();
  }
  async stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.work;
  }
  async flush() {
    if (this.flushing || this.stopped) return;
    this.flushing = true;
    try {
      const settings = await record<AgentSettings | null>(this.db, 'integration:ai', null);
      if (!settings?.enabled || !settings.encryptedKey || !settings.enabledAt) return;
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
      if (
        (await this.db.operationRecord.count({
          where: { kind: 'AI_RUN', createdAt: { gte: new Date(`${day}T00:00:00-03:00`) } },
        })) >= (settings.dailyLimit ?? 100)
      )
        return;
      const events = await this.db.flowInboxEvent.findMany({
        where: {
          outcome: 'no-trigger',
          receivedAt: {
            gte: new Date(Math.max(Date.now() - 300000, new Date(settings.enabledAt).getTime())),
          },
        },
        orderBy: { receivedAt: 'desc' },
        take: 100,
      });
      for (const event of events) {
        const key = `ai-run:${event.messageId}`;
        if (await this.db.operationRecord.findUnique({ where: { id: key } })) continue;
        const message = await this.db.chatMessage.findUnique({
          where: { id: event.messageId },
          include: { conversation: { include: { contact: true } } },
        });
        const chat = message?.conversation;
        if (
          !message ||
          !chat ||
          chat.contact.isGroup ||
          chat.status !== 'OPEN' ||
          (chat.contact.metadata as { optOut?: boolean }).optOut ||
          !message.text
        )
          continue;
        try {
          this.whatsapp.connectedSocket(chat.sessionId);
        } catch {
          continue;
        }
        const active = async () =>
          (await this.db.flowExecution.count({
            where: { conversationId: chat.id, status: { in: ['QUEUED', 'RUNNING', 'WAITING_INPUT'] } },
          })) ||
          (await this.db.sequenceRun.count({
            where: { conversationId: chat.id, status: { in: ['QUEUED', 'RUNNING'] } },
          }));
        if (await active()) continue;
        const latest = await this.db.chatMessage.findFirst({
          where: { conversationId: chat.id },
          orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
        });
        if (latest?.id !== message.id) continue;
        await this.db.operationRecord.create({
          data: { id: key, kind: 'AI_RUN', data: { status: 'RUNNING', conversationId: chat.id } },
        });
        try {
          const suggestion = await generateSuggestion(
            this.db,
            chat.id,
            'Responda à última mensagem do cliente com base no conhecimento aprovado e nas regras do administrador.',
          );
          const current = await record<AgentSettings | null>(this.db, 'integration:ai', null);
          const last = await this.db.chatMessage.findFirst({
            where: { conversationId: chat.id },
            orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
          });
          const currentChat = await this.db.conversation.findUnique({
            where: { id: chat.id },
            include: { contact: true },
          });
          if (
            !current?.enabled ||
            currentChat?.status !== 'OPEN' ||
            (currentChat.contact.metadata as { optOut?: boolean }).optOut ||
            last?.id !== message.id ||
            (await active())
          ) {
            await putRecord(this.db, key, 'AI_RUN', { status: 'HELD', conversationId: chat.id });
            await putRecord(this.db, `notice:${key}`, 'NOTICE', {
              title: 'Sugestão de IA aguardando revisão',
              text: suggestion.text,
              conversationId: chat.id,
              read: false,
              createdAt: new Date().toISOString(),
            });
            return;
          }
          await this.messaging.send(chat.sessionId, chat.id, {
            kind: 'text',
            text: suggestion.text,
            requestId: key,
          });
          await putRecord(this.db, key, 'AI_RUN', {
            status: 'COMPLETED',
            conversationId: chat.id,
            usage: suggestion.usage ?? null,
          });
        } catch (error) {
          await putRecord(this.db, key, 'AI_RUN', {
            status: 'FAILED',
            conversationId: chat.id,
            error:
              error instanceof Error ? error.message.slice(0, 300) : 'Não foi possível confirmar a resposta.',
          });
        }
        this.whatsapp.notify(chat.sessionId, 'messages');
        return;
      }
    } finally {
      this.flushing = false;
    }
  }
}
