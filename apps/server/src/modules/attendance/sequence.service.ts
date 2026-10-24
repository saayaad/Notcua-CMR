import type { PrismaClient, SequenceRun } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../../shared/errors.js';
import { automationLock } from '../flows/flow.lock.js';
import { SerialQueue } from '../../shared/serial-queue.js';
import type { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { MessagingService, sendSchema } from './messaging.service.js';
import { json } from '../backups/validation.js';
import { queueLabelChange } from '../whatsapp/label-changes.js';

const stepSchema = z.object({
  delayMs: z.number().int().min(0).max(86_400_000).default(0),
  send: z.record(z.string(), z.unknown()).optional(),
  labelId: z.string().optional(),
  remove: z.boolean().optional(),
  command: z
    .enum(['WAIT', 'ARCHIVE', 'UNARCHIVE', 'PIN', 'UNPIN', 'MARK_UNREAD', 'CLEAR_LABELS', 'TRANSFER'])
    .optional(),
  target: z.string().max(200).optional(),
  presence: z.enum(['none', 'composing', 'recording']).optional(),
});
export interface SequenceStep {
  delayMs: number;
  send?: Record<string, unknown>;
  labelId?: string;
  remove?: boolean;
  command?: 'WAIT' | 'ARCHIVE' | 'UNARCHIVE' | 'PIN' | 'UNPIN' | 'MARK_UNREAD' | 'CLEAR_LABELS' | 'TRANSFER';
  target?: string;
  presence?: 'none' | 'composing' | 'recording';
}

export class SequenceService {
  private readonly enqueueQueue = new SerialQueue();
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private work: Promise<void> = Promise.resolve();
  private flushing = false;

  constructor(
    private readonly db: PrismaClient,
    private readonly whatsapp: WhatsappService,
    private readonly messaging: MessagingService,
  ) {}

  async start() {
    await this.db.sequenceRun.updateMany({
      where: { status: 'RUNNING' },
      data: {
        status: 'FAILED',
        error: 'Execução interrompida. Confira o último envio no WhatsApp antes de iniciar outra sequência.',
      },
    });
    await this.db.chatMessage.updateMany({
      where: { id: { startsWith: 'out:' }, status: 'PENDING' },
      data: {
        status: 'FAILED',
        error: 'Servidor reiniciado durante o envio. Confira a conversa no WhatsApp.',
      },
    });
    this.schedule();
  }

  private schedule() {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.work = this.flush()
        .catch(() => undefined)
        .finally(() => this.schedule());
    }, 500).unref();
  }

  async enqueue(
    sessionId: string,
    conversationId: string,
    kind: 'FUNNEL' | 'MACRO',
    sourceId: string,
    requestKey: string,
  ) {
    return automationLock.run(() =>
      this.enqueueQueue.run(async () => {
        await this.messaging.chat(sessionId, conversationId);
        this.whatsapp.connectedSocket(sessionId);
        const duplicate = await this.db.sequenceRun.findUnique({ where: { requestKey } });
        if (duplicate) {
          if (
            duplicate.conversationId !== conversationId ||
            duplicate.kind !== kind ||
            duplicate.sourceId !== sourceId
          )
            throw new AppError(409, 'Identificador já usado em outra sequência.');
          return duplicate;
        }
        if (
          await this.db.flowExecution.count({
            where: { conversationId, status: { in: ['QUEUED', 'RUNNING', 'WAITING_INPUT'] } },
          })
        )
          throw new AppError(
            409,
            'Há um fluxo ativo nesta conversa. Cancele a automação antes de iniciar uma sequência manual.',
          );
        const active = await this.db.sequenceRun.findFirst({
          where: { conversationId, status: { in: ['QUEUED', 'RUNNING'] } },
        });
        if (active) throw new AppError(409, 'Já existe uma sequência em andamento nesta conversa.');
        const steps: SequenceStep[] = [];
        let name: string;
        const assetStep = async (assetId: string, delayMs: number): Promise<SequenceStep> => {
          const asset = await this.db.asset.findUnique({
            where: { id: assetId },
            include: { file: { select: { mimeType: true } } },
          });
          if (!asset) throw new AppError(422, 'A sequência contém um ativo indisponível.');
          return {
            delayMs,
            send: {
              kind:
                asset.kind === 'MESSAGE'
                  ? 'text'
                  : asset.kind === 'AUDIO'
                    ? 'audio'
                    : asset.kind === 'DOCUMENT'
                      ? 'document'
                      : asset.file?.mimeType.startsWith('video/')
                        ? 'video'
                        : 'image',
              text: asset.text ?? undefined,
              caption: asset.caption ?? undefined,
              fileId: asset.fileId ?? undefined,
              isPtt: asset.isPtt,
              isPtv: asset.isPtv,
              asViewOnce: asset.asViewOnce,
            },
          };
        };
        if (kind === 'FUNNEL') {
          const funnel = await this.db.funnel.findUnique({
            where: { id: sourceId },
            include: { items: { orderBy: { position: 'asc' } } },
          });
          if (!funnel) throw new AppError(404, 'Funil não encontrado.');
          name = funnel.name;
          for (const item of funnel.items) steps.push(await assetStep(item.assetId, item.delayBeforeSendMs));
        } else {
          const macro = await this.db.macro.findUnique({
            where: { id: sourceId },
            include: { actions: { orderBy: { position: 'asc' } } },
          });
          if (!macro) throw new AppError(404, 'Macro não encontrada.');
          name = macro.name;
          if (!macro.actions.length && macro.text)
            steps.push({ delayMs: 0, send: { kind: 'text', text: macro.text } });
          for (const action of macro.actions) {
            const payload = action.payload as {
              type?: string;
              command?: SequenceStep['command'];
              target?: string;
              presence?: SequenceStep['presence'];
              send?: Record<string, unknown>;
            };
            if (payload.type === 'utility') {
              steps.push(
                stepSchema.parse({
                  delayMs: action.waitMs,
                  command: payload.command,
                  target: payload.target,
                  presence: payload.presence,
                }),
              );
              continue;
            }
            if (action.type === 'ADD_LABEL' || action.type === 'REMOVE_LABEL')
              steps.push({
                delayMs: action.waitMs,
                labelId: action.labelId ?? undefined,
                remove: action.type === 'REMOVE_LABEL',
              });
            else {
              const file = action.fileId
                ? await this.db.storedFile.findUnique({
                    where: { id: action.fileId },
                    select: { mimeType: true },
                  })
                : null;
              steps.push({
                delayMs: action.waitMs,
                send: {
                  ...(payload.send ?? {
                    kind:
                      action.type === 'TEXT'
                        ? 'text'
                        : file?.mimeType.startsWith('video/')
                          ? 'video'
                          : file?.mimeType.startsWith('audio/')
                            ? 'audio'
                            : file?.mimeType.startsWith('image/')
                              ? 'image'
                              : 'document',
                    text: action.text ?? undefined,
                  }),
                  fileId: action.fileId ?? undefined,
                  composingMs: Math.min(30_000, action.composingMs),
                },
              });
            }
          }
        }
        if (!steps.length) throw new AppError(422, 'A sequência não possui ações.');
        for (const step of steps) {
          if (step.send) sendSchema.parse({ ...step.send, requestId: 'validation' });
          else if (step.command) {
            if (step.command === 'TRANSFER' && !step.target?.trim())
              throw new AppError(422, 'Escolha o responsável da transferência.');
          } else {
            const label = step.labelId
              ? await this.db.label.findUnique({ where: { id: step.labelId } })
              : null;
            if (!label || label.isDeleted || (label.sessionId && label.sessionId !== sessionId))
              throw new AppError(422, 'A macro contém uma etiqueta indisponível nesta conexão.');
          }
        }
        const run = await this.db.sequenceRun.create({
          data: {
            requestKey,
            conversationId,
            kind,
            sourceId,
            name,
            steps: json(steps),
            nextRunAt: new Date(Date.now() + steps[0]!.delayMs),
          },
        });
        await this.simulate(sessionId, conversationId, steps[0]!);
        this.whatsapp.notify(sessionId, 'messages');
        return run;
      }),
    );
  }

  private async simulate(sessionId: string, conversationId: string, step: SequenceStep) {
    if (step.command === 'WAIT' && step.presence && step.presence !== 'none')
      await this.messaging.presence(sessionId, conversationId, step.presence).catch(() => undefined);
    if (step.delayMs && step.send)
      await this.messaging
        .presence(sessionId, conversationId, step.send.kind === 'audio' ? 'recording' : 'composing')
        .catch(() => undefined);
  }

  async cancel(sessionId: string, conversationId: string, id: string) {
    await this.messaging.chat(sessionId, conversationId);
    const updated = await this.db.sequenceRun.updateMany({
      where: { id, conversationId, status: { in: ['QUEUED', 'RUNNING'] } },
      data: { status: 'CANCELLED' },
    });
    await this.messaging.presence(sessionId, conversationId, 'paused').catch(() => undefined);
    this.whatsapp.notify(sessionId, 'messages');
    return { cancelled: updated.count > 0 };
  }

  async flush() {
    if (this.flushing || this.stopped) return;
    this.flushing = true;
    try {
      const runs = await this.db.sequenceRun.findMany({
        where: { status: 'QUEUED', nextRunAt: { lte: new Date() } },
        include: { conversation: true },
        orderBy: { nextRunAt: 'asc' },
        take: 10,
      });
      for (const run of runs) {
        if (this.stopped) break;
        try {
          this.whatsapp.connectedSocket(run.conversation.sessionId);
        } catch {
          continue;
        }
        const claimed = await this.db.sequenceRun.updateMany({
          where: { id: run.id, status: 'QUEUED' },
          data: { status: 'RUNNING' },
        });
        if (!claimed.count) continue;
        await this.execute(run, run.conversation.sessionId);
      }
    } finally {
      this.flushing = false;
    }
  }

  private async execute(run: SequenceRun, sessionId: string) {
    try {
      const steps = z.array(stepSchema).parse(run.steps) as SequenceStep[];
      const step = steps[run.position];
      if (!step) throw new AppError(422, 'Etapa da sequência inválida.');
      if (step.send)
        await this.messaging.send(sessionId, run.conversationId, {
          ...step.send,
          requestId: `sequence:${run.id}:${run.position}`,
        });
      else if (step.command) {
        const chat = await this.messaging.chat(sessionId, run.conversationId);
        if (step.command === 'WAIT')
          await this.messaging.presence(sessionId, run.conversationId, 'paused').catch(() => undefined);
        if (step.command === 'ARCHIVE' || step.command === 'UNARCHIVE')
          await this.db.conversation.update({
            where: { id: chat.id },
            data: { status: step.command === 'ARCHIVE' ? 'CLOSED' : 'OPEN' },
          });
        if (step.command === 'MARK_UNREAD')
          await this.db.conversation.update({ where: { id: chat.id }, data: { unreadCount: 1 } });
        if (step.command === 'PIN' || step.command === 'UNPIN' || step.command === 'TRANSFER')
          await this.db.conversation.update({
            where: { id: chat.id },
            data:
              step.command === 'TRANSFER' ? { assignedTo: step.target } : { pinned: step.command === 'PIN' },
          });
        if (['PIN', 'UNPIN', 'TRANSFER'].includes(step.command))
          await this.db.contact.update({
            where: { id: chat.contactId },
            data: {
              metadata: json({
                ...(chat.contact.metadata as object),
                ...(step.command === 'TRANSFER'
                  ? { assignedTo: step.target }
                  : { pinned: step.command === 'PIN' }),
              }),
            },
          });
        if (step.command === 'CLEAR_LABELS')
          await this.db.$transaction(async (tx) => {
            const links = await tx.contactLabel.findMany({
              where: { contactId: chat.contactId, label: { OR: [{ sessionId }, { sessionId: null }] } },
              include: { label: true },
            });
            for (const link of links) {
              await tx.contactLabel.delete({
                where: { contactId_labelId: { contactId: chat.contactId, labelId: link.labelId } },
              });
              if (link.label.whatsappId)
                await queueLabelChange(tx, {
                  sessionId,
                  contactId: chat.contactId,
                  labelId: link.labelId,
                  jid: chat.jid,
                  whatsappId: link.label.whatsappId,
                  active: false,
                });
            }
          });
      } else if (step.labelId) {
        const chat = await this.messaging.chat(sessionId, run.conversationId);
        const label = await this.db.label.findUnique({ where: { id: step.labelId } });
        if (!label || label.isDeleted) throw new AppError(422, 'A etiqueta da macro foi removida.');
        const link = { contactId: chat.contactId, labelId: label.id };
        await this.db.$transaction(async (tx) => {
          if (step.remove) await tx.contactLabel.deleteMany({ where: link });
          else await tx.contactLabel.upsert({ where: { contactId_labelId: link }, create: link, update: {} });
          if (label.whatsappId)
            await queueLabelChange(tx, {
              ...link,
              sessionId,
              jid: chat.jid,
              whatsappId: label.whatsappId,
              active: !step.remove,
            });
        });
        this.whatsapp.notify(sessionId, 'labels');
      }
      const next = steps[run.position + 1];
      const changed = await this.db.sequenceRun.updateMany({
        where: { id: run.id, status: 'RUNNING' },
        data: {
          position: run.position + 1,
          status: next ? 'QUEUED' : 'COMPLETED',
          nextRunAt: new Date(Date.now() + (next?.delayMs ?? 0)),
          error: null,
        },
      });
      if (next && changed.count) await this.simulate(sessionId, run.conversationId, next);
    } catch (error) {
      await this.db.sequenceRun.updateMany({
        where: { id: run.id, status: 'RUNNING' },
        data: {
          status: 'FAILED',
          error:
            error instanceof AppError
              ? error.message
              : 'Não foi possível concluir a etapa. Confira a conversa antes de repetir.',
        },
      });
    } finally {
      this.whatsapp.notify(sessionId, 'messages');
    }
  }

  async stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.work;
  }
}
