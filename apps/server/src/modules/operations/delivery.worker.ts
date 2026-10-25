import { randomInt } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { WhatsappService } from '../whatsapp/whatsapp.service.js';
import type { MessagingService } from '../attendance/messaging.service.js';
import type { SequenceService } from '../attendance/sequence.service.js';
import { record, putRecord } from './records.js';
import { json } from '../backups/validation.js';
import { FlowEngine } from '../flows/flow.engine.js';
export interface Batch {
  name: string;
  sessionId: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'COMPLETED';
  mode: 'CAMPAIGN' | 'SCHEDULE' | 'REMINDER';
  minSeconds: number;
  maxSeconds: number;
  nextAllowedAt?: string;
  count: number;
  createdAt: string;
  pauseEvery?: number;
  pauseSeconds?: number;
  sentCount?: number;
  investmentInCents?: number;
  attributedRevenueInCents?: number;
}
export interface Delivery {
  kind: 'text' | 'asset' | 'funnel' | 'flow' | 'reminder' | 'sequence';
  steps?: { snapshot: Record<string, unknown>; waitSeconds: number }[];
  stepIndex?: number;
  text?: string;
  assetId?: string;
  funnelId?: string;
  flowId?: string;
  snapshot?: Record<string, unknown>;
}
export class DeliveryWorker {
  private stopped = false;
  private timer?: ReturnType<typeof setTimeout>;
  private work: Promise<void> = Promise.resolve();
  private flushing = false;
  constructor(
    private db: PrismaClient,
    private whatsapp: WhatsappService,
    private messaging: MessagingService,
    private sequences: SequenceService,
    private flows = new FlowEngine(db, whatsapp, messaging),
  ) {}
  async start() {
    const interrupted = await this.db.deliveryTask.findMany({
      where: { status: 'RUNNING' },
      select: { batchId: true },
      distinct: ['batchId'],
    });
    await this.db.deliveryTask.updateMany({
      where: { status: 'RUNNING' },
      data: {
        status: 'FAILED',
        error: 'Servidor interrompido durante o envio. Confira a conversa antes de criar um novo envio.',
      },
    });
    for (const { batchId } of interrupted) {
      const current = await record<Batch | null>(this.db, batchId, null);
      if (current?.status === 'ACTIVE')
        await putRecord(this.db, batchId, 'BATCH', { ...current, status: 'PAUSED' });
    }
    this.schedule();
  }
  private schedule() {
    if (!this.stopped)
      this.timer = setTimeout(() => {
        this.work = this.flush()
          .catch(() => undefined)
          .finally(() => this.schedule());
      }, 1000).unref();
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
      const batches = await this.db.operationRecord.findMany({
        where: { kind: 'BATCH' },
        orderBy: { updatedAt: 'asc' },
      });
      const activeIds = batches
        .filter((row) => {
          const data = row.data as unknown as Batch;
          return (
            data.status === 'ACTIVE' && (!data.nextAllowedAt || new Date(data.nextAllowedAt) <= new Date())
          );
        })
        .map((row) => row.id);
      const tasks = [];
      for (const batchId of activeIds.slice(0, 30)) {
        const task = await this.db.deliveryTask.findFirst({
          where: { batchId, status: 'QUEUED', runAt: { lte: new Date() } },
          orderBy: [{ runAt: 'asc' }, { id: 'asc' }],
        });
        if (task) tasks.push(task);
      }
      const handled = new Set<string>();
      for (const task of tasks) {
        if (handled.has(task.batchId)) continue;
        handled.add(task.batchId);
        const batch = await record<Batch | null>(this.db, task.batchId, null);
        if (
          !batch ||
          batch.status !== 'ACTIVE' ||
          (batch.nextAllowedAt && new Date(batch.nextAllowedAt) > new Date())
        )
          continue;
        const data = task.payload as unknown as Delivery;
        const chat = await this.db.conversation.findFirst({
          where: { id: task.conversationId, sessionId: task.sessionId },
          include: { contact: true },
        });
        if (!chat || (data.kind !== 'reminder' && (chat.contact.metadata as { optOut?: boolean }).optOut)) {
          await this.db.deliveryTask.update({
            where: { id: task.id },
            data: { status: 'CANCELLED', error: 'Contato indisponível ou com saída de campanhas.' },
          });
          if (!(await this.db.deliveryTask.count({ where: { batchId: task.batchId, status: 'QUEUED' } })))
            await putRecord(this.db, task.batchId, 'BATCH', { ...batch, status: 'COMPLETED' });
          continue;
        }
        if (
          data.kind !== 'reminder' &&
          ((await this.db.flowExecution.count({
            where: { conversationId: chat.id, status: { in: ['QUEUED', 'RUNNING', 'WAITING_INPUT'] } },
          })) ||
            (await this.db.sequenceRun.count({
              where: { conversationId: chat.id, status: { in: ['QUEUED', 'RUNNING'] } },
            })))
        )
          continue;
        if (data.kind !== 'reminder') {
          try {
            this.whatsapp.connectedSocket(task.sessionId);
          } catch {
            continue;
          }
        }
        const claimed = await this.db.deliveryTask.updateMany({
          where: { id: task.id, status: 'QUEUED' },
          data: { status: 'RUNNING' },
        });
        if (!claimed.count) continue;
        const index = data.stepIndex ?? 0;
        const step = data.kind === 'sequence' ? data.steps?.[index] : undefined;
        const hasNext = data.kind === 'sequence' && index + 1 < (data.steps?.length ?? 0);
        try {
          if (data.kind === 'reminder')
            await putRecord(this.db, `notice:${task.id}`, 'NOTICE', {
              title: batch.name,
              text: data.text,
              conversationId: chat.id,
              createdAt: new Date().toISOString(),
              read: false,
            });
          else if (data.kind === 'funnel')
            await this.sequences.enqueue(
              task.sessionId,
              chat.id,
              'FUNNEL',
              data.funnelId!,
              `delivery:${task.id}`,
            );
          else if (data.kind === 'flow') await this.flows.launch(task.sessionId, data.flowId!, chat.id);
          else
            await this.messaging.send(task.sessionId, chat.id, {
              ...(step?.snapshot ?? data.snapshot ?? { kind: 'text', text: data.text }),
              requestId: `delivery:${task.id}${data.kind === 'sequence' ? `:${index}` : ''}`,
            });
          await this.db.$transaction(async (tx) => {
            await tx.deliveryTask.updateMany({
              where: { id: task.id, status: 'RUNNING' },
              data: hasNext
                ? {
                    status: 'QUEUED',
                    payload: json({ ...data, stepIndex: index + 1 }),
                    runAt: new Date(Date.now() + (data.steps?.[index + 1]?.waitSeconds ?? 1) * 1000),
                  }
                : { status: 'COMPLETED' },
            });
            const current = await tx.operationRecord.findUnique({ where: { id: task.batchId } });
            const latest = current?.data as unknown as Batch | undefined;
            if (hasNext && latest?.status === 'CANCELLED')
              await tx.deliveryTask.updateMany({
                where: { id: task.id, status: 'QUEUED' },
                data: { status: 'CANCELLED' },
              });
            if (latest?.status === 'ACTIVE') {
              const remaining = await tx.deliveryTask.count({
                where: { batchId: task.batchId, status: 'QUEUED' },
              });
              await tx.operationRecord.update({
                where: { id: task.batchId },
                data: {
                  data: json({
                    ...latest,
                    status: remaining ? 'ACTIVE' : 'COMPLETED',
                    sentCount: (latest.sentCount ?? 0) + 1,
                    nextAllowedAt: new Date(
                      Date.now() +
                        (randomInt(batch.minSeconds, batch.maxSeconds + 1) +
                          (latest.pauseEvery && ((latest.sentCount ?? 0) + 1) % latest.pauseEvery === 0
                            ? (latest.pauseSeconds ?? 0)
                            : 0)) *
                          1000,
                    ).toISOString(),
                  }),
                },
              });
            }
          });
        } catch (error) {
          await this.db.$transaction(async (tx) => {
            await tx.deliveryTask.updateMany({
              where: { id: task.id, status: 'RUNNING' },
              data: {
                status: 'FAILED',
                error: error instanceof Error ? error.message.slice(0, 300) : 'Envio não confirmado.',
              },
            });
            const current = await tx.operationRecord.findUnique({ where: { id: task.batchId } });
            const latest = current?.data as unknown as Batch | undefined;
            if (latest?.status === 'ACTIVE')
              await tx.operationRecord.update({
                where: { id: task.batchId },
                data: { data: json({ ...latest, status: 'PAUSED' }) },
              });
          });
        }
        this.whatsapp.notify(task.sessionId, 'messages');
      }
    } finally {
      this.flushing = false;
    }
  }
}
