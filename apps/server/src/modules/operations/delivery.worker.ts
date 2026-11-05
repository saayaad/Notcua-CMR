import { randomInt } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { WhatsappService } from '../whatsapp/whatsapp.service.js';
import type { MessagingService } from '../attendance/messaging.service.js';
import type { SequenceService } from '../attendance/sequence.service.js';
import { record, putRecord } from './records.js';
import { json } from '../backups/validation.js';
import { FlowEngine } from '../flows/flow.engine.js';
import { queueLabelChange } from '../whatsapp/label-changes.js';
import { nextSendWindowAt, type SendWindow } from './send-window.js';
import { env } from '../../config/env.js';
export interface CampaignCta {
  keyword: string;
  replyText?: string;
  assetId?: string;
  labelId?: string;
}
export interface Batch {
  name: string;
  sessionId: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'PAUSED_CONNECTION' | 'BATCH_COMPLETE' | 'CANCELLED' | 'COMPLETED';
  mode: 'CAMPAIGN' | 'SCHEDULE' | 'REMINDER';
  minSeconds: number;
  maxSeconds: number;
  speedMultiplier?: 1 | 1.5 | 2;
  nextAllowedAt?: string;
  count: number;
  createdAt: string;
  pauseEvery?: number;
  pauseSeconds?: number;
  sentCount?: number;
  investmentInCents?: number;
  attributedRevenueInCents?: number;
  approaches?: string[];
  followUpCount?: number;
  ctaKeyword?: string;
  ctaKeywords?: string[];
  sendWindow?: SendWindow;
  batchSize?: number;
  sentTotal?: number;
  batchSentCount?: number;
  pauseAfterBatch?: boolean;
  autoResume?: boolean;
  sequenceMode?: boolean;
  activeSequenceTaskId?: string;
  distribution?: 'RANDOM' | 'ROUND_ROBIN';
  variationNames?: string[];
  ctaMessages?: CampaignCta[];
  followUpMessages?: { waitMinutes: number; text: string }[];
  defaultReplyText?: string;
  optOutLine?: string;
  batchNumber?: number;
  batchHistory?: {
    number: number;
    startedAt: string;
    completedAt?: string;
    leadIds: string[];
    variationByLead: Record<string, number>;
    textVersion: string[];
  }[];
  pauseHistory?: { at: string; reason: string; action: 'paused' | 'resumed' }[];
}
export interface Delivery {
  kind: 'text' | 'asset' | 'funnel' | 'flow' | 'reminder' | 'sequence';
  steps?: { snapshot: Record<string, unknown>; waitSeconds: number }[];
  stepIndex?: number;
  text?: string;
  approachIndex?: number;
  batchNumber?: number;
  assetId?: string;
  funnelId?: string;
  flowId?: string;
  snapshot?: Record<string, unknown>;
  followUp?: boolean;
  sourceMessageAt?: string;
  followUps?: { waitMinutes: number; text: string }[];
  followUpIndex?: number;
  cta?: CampaignCta;
  ctas?: CampaignCta[];
  defaultReplyText?: string;
  sourceCampaignId?: string;
  labelTransition?: { fromLabelId?: string; toLabelId?: string };
}

// Content comes exclusively from the task snapshot. Only execution state may
// change after freezing; never look up the campaign's current alternative here.
function taskDelivery(task: {
  payload: unknown;
  frozenContent: unknown;
  stepIndex: number | null;
  alternativeIndex: number | null;
}): Delivery {
  const payload = task.payload as Delivery;
  if (!env.CAMPAIGN_ALTERNATIVES_ENABLED || task.frozenContent == null) return payload;
  return {
    ...(task.frozenContent as Delivery),
    stepIndex: task.stepIndex ?? 0,
    approachIndex: task.alternativeIndex ?? (task.frozenContent as Delivery).approachIndex,
    batchNumber: (task.payload as Delivery).batchNumber,
    followUp: payload.followUp,
    followUpIndex: payload.followUpIndex,
    sourceMessageAt: payload.sourceMessageAt,
  };
}

function validateFrozenDelivery(data: Delivery) {
  if (!['text', 'asset', 'sequence', 'funnel', 'flow', 'reminder'].includes(data.kind))
    throw new Error('Conteúdo congelado inválido: tipo de entrega ausente.');
  if (data.kind === 'sequence' && (
    !data.steps?.length || !Number.isInteger(data.stepIndex) ||
    data.stepIndex! < 0 || data.stepIndex! >= data.steps.length ||
    data.steps.some((step) => !step.snapshot || !Number.isFinite(step.waitSeconds) || step.waitSeconds < 0)
  )) throw new Error('Conteúdo congelado inválido: etapas ou posição da sequência.');
  if (['text', 'asset'].includes(data.kind) && !data.snapshot && !data.text?.trim())
    throw new Error('Conteúdo congelado inválido: mensagem ausente.');
  if ((data.kind === 'funnel' && !data.funnelId) || (data.kind === 'flow' && !data.flowId))
    throw new Error('Conteúdo congelado inválido: automação ausente.');
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
        status: 'VERIFY',
        error: 'Servidor interrompido durante o envio. Entrega incerta: confira a conversa antes de decidir.',
      },
    });
    for (const { batchId } of interrupted) {
      const current = await record<Batch | null>(this.db, batchId, null);
      if (current && ['ACTIVE', 'PAUSED_CONNECTION'].includes(current.status)) {
        await putRecord(this.db, batchId, 'BATCH', {
          ...current,
          status: 'PAUSED',
          autoResume: false,
          pauseHistory: [
            ...(current.pauseHistory ?? []),
            {
              at: new Date().toISOString(),
              reason: 'Servidor reiniciado; envio pendente de conferência.',
              action: 'paused',
            },
          ],
        });
        await putRecord(this.db, `notice:campaign:${batchId}:restart:${Date.now()}`, 'NOTICE', {
          title: current.name,
          text: 'Campanha pausada após reiniciar o servidor. Um contato estava em envio; confira o status “verificar” antes de prosseguir.',
          createdAt: new Date().toISOString(),
          read: false,
        });
      }
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
      const activeBatches = batches
        .filter((row) => {
          const data = row.data as unknown as Batch;
          return (
            (data.status === 'ACTIVE' || (data.status === 'PAUSED_CONNECTION' && data.autoResume)) &&
            (!data.nextAllowedAt || new Date(data.nextAllowedAt) <= new Date())
          );
        });
      const tasks = [];
      for (const row of activeBatches.slice(0, 30)) {
        const batchId = row.id;
        let batch = row.data as unknown as Batch;
        let task;
        let inspectLegacySequence = false;
        if (batch.activeSequenceTaskId) {
          task = await this.db.deliveryTask.findFirst({
            where: { id: batch.activeSequenceTaskId, batchId, status: 'QUEUED' },
          });
          if (!task) {
            batch = { ...batch, activeSequenceTaskId: undefined };
            await putRecord(this.db, batchId, 'BATCH', batch);
            inspectLegacySequence = true;
          } else if (task.runAt > new Date()) {
            const nextAllowedAt = task.runAt.toISOString();
            if (!batch.nextAllowedAt || new Date(batch.nextAllowedAt) < task.runAt)
              await putRecord(this.db, batchId, 'BATCH', { ...batch, nextAllowedAt });
            continue;
          }
        }
        if (!task) {
          let firstQueued = await this.db.deliveryTask.findFirst({
            where: { batchId, status: 'QUEUED' },
            orderBy: [{ runAt: 'asc' }, { id: 'asc' }],
          });
          if (env.CAMPAIGN_ALTERNATIVES_ENABLED && firstQueued?.alternativeId) {
            // Initial waits belong to the selected lead. A later alternative
            // becoming due sooner must not overtake that lead in the rotation.
            const queued = await this.db.deliveryTask.findMany({ where: { batchId, status: 'QUEUED' } });
            queued.sort((left, right) => {
              const leftData = taskDelivery(left);
              const rightData = taskDelivery(right);
              const leftStarted = leftData.kind === 'sequence' && (leftData.stepIndex ?? 0) > 0;
              const rightStarted = rightData.kind === 'sequence' && (rightData.stepIndex ?? 0) > 0;
              return Number(rightStarted) - Number(leftStarted) ||
                Number((left.payload as { batchOrder?: number }).batchOrder ?? 0) -
                  Number((right.payload as { batchOrder?: number }).batchOrder ?? 0) ||
                left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id);
            });
            firstQueued = queued[0] ?? null;
          }
          if (!firstQueued) continue;
          const firstPayload = taskDelivery(firstQueued);
          if (firstPayload.kind === 'sequence' && (!batch.sequenceMode || inspectLegacySequence)) {
            const queued = await this.db.deliveryTask.findMany({ where: { batchId, status: 'QUEUED' } });
            const inProgress = queued
              .filter((candidate) => {
                const payload = taskDelivery(candidate);
                return payload.kind === 'sequence' && (payload.stepIndex ?? 0) > 0;
              })
              .sort((left, right) => {
                const leftOrder = Number((left.payload as { batchOrder?: number }).batchOrder ?? 0);
                const rightOrder = Number((right.payload as { batchOrder?: number }).batchOrder ?? 0);
                return leftOrder - rightOrder || left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id);
              });
            const active = inProgress[0];
            batch = {
              ...batch,
              sequenceMode: true,
              ...(active ? { activeSequenceTaskId: active.id } : { activeSequenceTaskId: undefined }),
            };
            await putRecord(this.db, batchId, 'BATCH', batch);
            if (active) {
              if (active.runAt > new Date()) {
                const nextAllowedAt = active.runAt.toISOString();
                if (!batch.nextAllowedAt || new Date(batch.nextAllowedAt) < active.runAt)
                  await putRecord(this.db, batchId, 'BATCH', { ...batch, nextAllowedAt });
                continue;
              }
              task = active;
            } else if (firstQueued.runAt <= new Date()) task = firstQueued;
            else continue;
          } else if (firstQueued.runAt <= new Date()) task = firstQueued;
          else continue;
        }
        tasks.push(task);
      }
      const handled = new Set<string>();
      for (const task of tasks) {
        if (handled.has(task.batchId)) continue;
        handled.add(task.batchId);
        const batch = await record<Batch | null>(this.db, task.batchId, null);
        if (
          !batch ||
          !['ACTIVE', 'PAUSED_CONNECTION'].includes(batch.status) ||
          (batch.nextAllowedAt && new Date(batch.nextAllowedAt) > new Date())
        )
          continue;
        if (batch.sendWindow) {
          const next = nextSendWindowAt(batch.sendWindow, new Date());
          if (next.getTime() > Date.now()) {
            await putRecord(this.db, task.batchId, 'BATCH', { ...batch, nextAllowedAt: next.toISOString() });
            continue;
          }
        }
        const data = taskDelivery(task);
        const frozen = env.CAMPAIGN_ALTERNATIVES_ENABLED && task.frozenContent != null;
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
        if (data.followUp && data.sourceMessageAt) {
          const reply = await this.db.chatMessage.findFirst({
            where: {
              conversationId: chat.id,
              direction: 'INBOUND',
              sentAt: { gte: new Date(new Date(data.sourceMessageAt).getTime() - 1000) },
            },
            select: { id: true },
          });
          if (reply) {
            await this.db.deliveryTask.update({
              where: { id: task.id },
              data: { status: 'CANCELLED', error: 'Follow-up cancelado: o cliente respondeu.' },
            });
            const remaining = await this.db.deliveryTask.count({
              where: { batchId: task.batchId, status: 'QUEUED' },
            });
            await putRecord(this.db, task.batchId, 'BATCH', {
              ...batch,
              status: batch.mode === 'CAMPAIGN' ? (remaining ? batch.status : 'COMPLETED') : 'CANCELLED',
            });
            continue;
          }
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
            if (batch.mode === 'CAMPAIGN' && batch.status === 'ACTIVE') {
              const at = new Date().toISOString();
              await putRecord(this.db, task.batchId, 'BATCH', {
                ...batch,
                status: 'PAUSED_CONNECTION',
                pauseHistory: [
                  ...(batch.pauseHistory ?? []),
                  { at, reason: 'Conexão WhatsApp indisponível.', action: 'paused' },
                ],
              });
              await putRecord(this.db, `notice:campaign:${task.batchId}:pause:${Date.now()}`, 'NOTICE', {
                title: batch.name,
                text: 'Campanha pausada por falha na conexão do WhatsApp. A fila será retomada com segurança quando a conexão voltar.',
                createdAt: at,
                read: false,
              });
              this.whatsapp.notify(task.sessionId, 'chats');
            }
            continue;
          }
        }
        if (batch.status === 'PAUSED_CONNECTION' && batch.autoResume) {
          const at = new Date().toISOString();
          await putRecord(this.db, task.batchId, 'BATCH', {
            ...batch,
            status: 'ACTIVE',
            pauseHistory: [
              ...(batch.pauseHistory ?? []),
              { at, reason: 'Conexão WhatsApp restabelecida.', action: 'resumed' },
            ],
          });
          await putRecord(this.db, `notice:campaign:${task.batchId}:resume:${Date.now()}`, 'NOTICE', {
            title: batch.name,
            text: 'A conexão voltou. A campanha retomou a fila pelo próximo contato pendente.',
            createdAt: at,
            read: false,
          });
          this.whatsapp.notify(task.sessionId, 'chats');
        }
        // Claim only while the persisted campaign state still permits sending.
        // A manual pause that wins the race prevents this task from reaching WhatsApp.
        const claimed = await this.db.$transaction(async (tx) => {
          const current = await tx.operationRecord.findUnique({ where: { id: task.batchId } });
          const latest = current?.data as unknown as Batch | undefined;
          if (!latest || !(latest.status === 'ACTIVE' || (latest.status === 'PAUSED_CONNECTION' && latest.autoResume)))
            return false;
          const changed = await tx.deliveryTask.updateMany({
            where: { id: task.id, status: 'QUEUED' },
            data: { status: 'RUNNING' },
          });
          return changed.count > 0;
        });
        if (!claimed) continue;
        const index = data.stepIndex ?? 0;
        const step = data.kind === 'sequence' ? data.steps?.[index] : undefined;
        const followUpIndex = data.followUpIndex ?? 0;
        const campaignFollowUp =
          data.kind === 'text' && data.followUp ? data.followUps?.[followUpIndex] : undefined;
        const hasNextSequence = data.kind === 'sequence' && index + 1 < (data.steps?.length ?? 0);
        const hasNextCampaignFollowUp =
          data.kind === 'text' &&
          Boolean(data.followUps?.length) &&
          (!data.followUp || followUpIndex + 1 < data.followUps!.length);
        const hasNext = hasNextSequence || hasNextCampaignFollowUp;
        const countAsLead =
          !(data.kind === 'text' && data.followUp) && !(data.kind === 'sequence' && hasNextSequence);
        try {
          if (env.CAMPAIGN_ALTERNATIVES_ENABLED && task.alternativeId && !frozen)
            throw new Error('Alternativa sem conteúdo congelado; envio bloqueado para conferência.');
          if (frozen) validateFrozenDelivery(data);
          let sentAt: Date | undefined;
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
          else {
            const sent = await this.messaging.send(task.sessionId, chat.id, {
              ...(campaignFollowUp
                ? { kind: 'text', text: campaignFollowUp.text }
                : (step?.snapshot ?? data.snapshot ?? { kind: 'text', text: data.text })),
              requestId: `delivery:${task.id}${data.kind === 'sequence' ? `:${index}` : data.followUp && data.kind === 'text' ? `:follow-up:${followUpIndex}` : ''}`,
            });
            sentAt = sent.sentAt;
          }
          await this.db.$transaction(async (tx) => {
            await tx.deliveryTask.updateMany({
              where: { id: task.id, status: 'RUNNING' },
              data: hasNext
                ? {
                    status: 'QUEUED',
                    ...(frozen && hasNextSequence ? { stepIndex: index + 1 } : {}),
                    payload: json(
                      hasNextCampaignFollowUp
                        ? {
                            ...(frozen ? task.payload as Record<string, unknown> : data),
                            followUp: true,
                            followUpIndex: data.followUp ? followUpIndex + 1 : 0,
                            sourceMessageAt: data.sourceMessageAt ?? sentAt?.toISOString(),
                          }
                        : { ...(frozen ? task.payload as Record<string, unknown> : data), stepIndex: index + 1 },
                    ),
                    runAt: new Date(
                      Date.now() +
                        (hasNextCampaignFollowUp
                          ? data.followUps![data.followUp ? followUpIndex + 1 : 0]!.waitMinutes * 60
                          : (data.steps?.[index + 1]?.waitSeconds ?? 1)) *
                          1000,
                    ),
                  }
                : { status: 'COMPLETED' },
            });
            if (!hasNext && data.labelTransition && data.kind !== 'reminder') {
              const transition = data.labelTransition;
              const scope = { isDeleted: false, OR: [{ sessionId: task.sessionId }, { sessionId: null }] };
              const targetLabel = transition.toLabelId
                ? await tx.label.findFirst({ where: { ...scope, id: transition.toLabelId } })
                : null;
              const sourceLabel = transition.fromLabelId
                ? await tx.label.findFirst({ where: { ...scope, id: transition.fromLabelId } })
                : null;
              const jid = chat.contact.whatsappJid || `${chat.contact.phoneNumber}@s.whatsapp.net`;
              if (!transition.toLabelId || targetLabel) {
                if (sourceLabel && sourceLabel.id !== targetLabel?.id) {
                  await tx.contactLabel.deleteMany({
                    where: { contactId: chat.contactId, labelId: sourceLabel.id },
                  });
                  if (sourceLabel.whatsappId)
                    await queueLabelChange(tx, {
                      sessionId: task.sessionId,
                      contactId: chat.contactId,
                      labelId: sourceLabel.id,
                      jid,
                      whatsappId: sourceLabel.whatsappId,
                      active: false,
                    });
                }
                if (targetLabel) {
                  await tx.contactLabel.upsert({
                    where: { contactId_labelId: { contactId: chat.contactId, labelId: targetLabel.id } },
                    create: { contactId: chat.contactId, labelId: targetLabel.id },
                    update: {},
                  });
                  if (targetLabel.whatsappId)
                    await queueLabelChange(tx, {
                      sessionId: task.sessionId,
                      contactId: chat.contactId,
                      labelId: targetLabel.id,
                      jid,
                      whatsappId: targetLabel.whatsappId,
                      active: true,
                    });
                }
              }
            }
            const current = await tx.operationRecord.findUnique({ where: { id: task.batchId } });
            const latest = current?.data as unknown as Batch | undefined;
            if (hasNext && latest?.status === 'CANCELLED')
              await tx.deliveryTask.updateMany({
                where: { id: task.id, status: 'QUEUED' },
                data: { status: 'CANCELLED' },
              });
            if (latest && ['ACTIVE', 'PAUSED', 'PAUSED_CONNECTION'].includes(latest.status)) {
              const sentTotal = (latest.sentTotal ?? latest.sentCount ?? 0) + (countAsLead ? 1 : 0);
              const batchSentCount = (latest.batchSentCount ?? 0) + (countAsLead ? 1 : 0);
              const batchSize = latest.batchSize ?? Infinity;
              const batchReached = countAsLead && latest.mode === 'CAMPAIGN' && batchSentCount >= batchSize;
              const pendingTasks = await tx.deliveryTask.findMany({
                where: { batchId: task.batchId, status: 'QUEUED' },
              });
              const pendingCampaignTasks = pendingTasks.filter(
                (pending) => !(pending.payload as { followUp?: boolean }).followUp,
              );
              const remaining = pendingCampaignTasks.length;
              const hasPendingFollowUps = pendingTasks.length > remaining;
              const calculatedStatus = remaining
                ? batchReached && latest.pauseAfterBatch !== false
                  ? 'BATCH_COMPLETE'
                  : 'ACTIVE'
                : hasPendingFollowUps
                  ? 'ACTIVE'
                  : 'COMPLETED';
              const nextStatus = latest.status === 'PAUSED' && calculatedStatus === 'ACTIVE'
                ? 'PAUSED'
                : latest.status === 'PAUSED_CONNECTION' && calculatedStatus === 'ACTIVE'
                  ? 'PAUSED_CONNECTION'
                  : calculatedStatus;
              const pauseLong = Boolean(
                countAsLead && latest.pauseEvery &&
                ((latest.sentCount ?? 0) + 1) % latest.pauseEvery === 0,
              );
              const nextWaitSeconds = hasNextSequence
                ? (data.steps?.[index + 1]?.waitSeconds ?? 1)
                : randomInt(batch.minSeconds, batch.maxSeconds + 1) +
                  (pauseLong ? (latest.pauseSeconds ?? 0) : 0);
              const activeSequenceTaskId = hasNextSequence
                ? task.id
                : latest.activeSequenceTaskId === task.id
                  ? undefined
                  : latest.activeSequenceTaskId;
              const history = (latest.batchHistory ?? []).map((entry) =>
                entry.number === (data as Delivery & { batchNumber?: number }).batchNumber
                  ? {
                      ...entry,
                      ...(batchReached ? { completedAt: new Date().toISOString() } : {}),
                      variationByLead: {
                        ...entry.variationByLead,
                        [task.conversationId]: data.approachIndex ?? 0,
                      },
                    }
                  : entry,
              );
              if (batchReached && latest.pauseAfterBatch === false && remaining) {
                const nextBatchNumber = (latest.batchNumber ?? 1) + 1;
                const nextBatchTasks = pendingCampaignTasks.slice(0, batchSize);
                for (const nextTask of nextBatchTasks) {
                  await tx.deliveryTask.update({
                    where: { id: nextTask.id },
                    data: {
                      payload: json({
                        ...(nextTask.payload as Record<string, unknown>),
                        batchNumber: nextBatchNumber,
                      }),
                    },
                  });
                }
                history.push({
                  number: nextBatchNumber,
                  startedAt: new Date().toISOString(),
                  leadIds: nextBatchTasks.map((nextTask) => nextTask.conversationId),
                  variationByLead: {},
                  textVersion: latest.approaches ?? [],
                });
              }
              await tx.operationRecord.update({
                where: { id: task.batchId },
                data: {
                  data: json({
                    ...latest,
                    ...(data.kind === 'sequence' ? { sequenceMode: true } : {}),
                    ...(activeSequenceTaskId ? { activeSequenceTaskId } : { activeSequenceTaskId: undefined }),
                    status: nextStatus,
                    sentCount: sentTotal,
                    sentTotal,
                    batchSentCount: batchReached && latest.pauseAfterBatch === false ? 0 : batchSentCount,
                    batchNumber:
                      batchReached && latest.pauseAfterBatch === false && remaining
                        ? (latest.batchNumber ?? 1) + 1
                        : latest.batchNumber,
                    batchHistory: history,
                    nextAllowedAt: new Date(Date.now() + nextWaitSeconds * 1000).toISOString(),
                  }),
                },
              });
            }
          });
          if (!hasNext && data.labelTransition && data.kind !== 'reminder')
            this.whatsapp.notify(task.sessionId, 'labels');
        } catch (error) {
          await this.db.$transaction(async (tx) => {
            await tx.deliveryTask.updateMany({
              where: { id: task.id, status: 'RUNNING' },
              data: {
                status: 'VERIFY',
                error: error instanceof Error ? error.message.slice(0, 300) : 'Envio não confirmado.',
              },
            });
            const current = await tx.operationRecord.findUnique({ where: { id: task.batchId } });
            const latest = current?.data as unknown as Batch | undefined;
            if (latest?.status === 'ACTIVE')
              await tx.operationRecord.update({
                where: { id: task.batchId },
                data: {
                  data: json({
                    ...latest,
                    status: 'PAUSED',
                    pauseHistory: [
                      ...(latest.pauseHistory ?? []),
                      {
                        at: new Date().toISOString(),
                        reason: 'Falha durante envio; entrega precisa ser conferida.',
                        action: 'paused',
                      },
                    ],
                  }),
                },
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
