import { randomInt } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { WhatsappService } from '../whatsapp/whatsapp.service.js';
import type { MessagingService } from '../attendance/messaging.service.js';
import type { SequenceService } from '../attendance/sequence.service.js';
import { record, putRecord } from './records.js';
import { json } from '../backups/validation.js';
import { FlowEngine } from '../flows/flow.engine.js';
import { queueLabelChange } from '../whatsapp/label-changes.js';
import { nextSendWindowAt, type SendWindow, withinBusinessHours } from './send-window.js';
type CompanySchedule = { days: number[]; minTime: string; maxTime: string };
function nextCompanyWindowAt(schedule: CompanySchedule, from: Date) {
  if (withinBusinessHours(schedule, from)) return from;
  let candidate = new Date(Math.ceil(from.getTime() / 60_000) * 60_000);
  for (let minute = 0; minute < 8 * 24 * 60; minute++, candidate = new Date(candidate.getTime() + 60_000))
    if (withinBusinessHours(schedule, candidate)) return candidate;
  return null;
}
export interface Batch {
  name: string;
  sessionId: string;
  status: 'DRAFT' | 'ACTIVE' | 'BATCH_COMPLETE' | 'PAUSED' | 'CANCELLED' | 'COMPLETED';
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
  approaches?: string[];
  followUpCount?: number;
  followUpPaused?: boolean;
  ctaKeyword?: string;
  ctaKeywords?: string[];
  sendWindow?: SendWindow;
}
export interface Delivery {
  kind: 'text' | 'asset' | 'funnel' | 'flow' | 'reminder' | 'sequence';
  steps?: { snapshot: Record<string, unknown>; waitSeconds: number; minDelaySeconds?: number; maxDelaySeconds?: number; sendWindow?: SendWindow }[];
  stepIndex?: number;
  text?: string;
  approachIndex?: number;
  assetId?: string;
  funnelId?: string;
  flowId?: string;
  snapshot?: Record<string, unknown>;
  followUp?: boolean;
  sourceMessageAt?: string;
  followUps?: { waitMinutes: number; text: string; minDelaySeconds?: number; maxDelaySeconds?: number; sendWindow?: SendWindow }[];
  followUpIndex?: number;
  cta?: { keyword: string; replyText: string };
  ctas?: { keyword: string; replyText: string }[];
  sourceCampaignId?: string;
  retryAttempt?: number;
  recoveryAuthorized?: boolean;
  labelTransition?: { fromLabelId?: string; toLabelId?: string };
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
      const activeRows = batches
        .filter((row) => {
          const data = row.data as unknown as Batch;
          return (
            (data.status === 'ACTIVE' || data.status === 'BATCH_COMPLETE') &&
            (!data.nextAllowedAt || new Date(data.nextAllowedAt) <= new Date())
          );
        });
      const tasks = [];
      for (const row of activeRows.slice(0, 30)) {
        const candidates = await this.db.deliveryTask.findMany({
          where: { batchId: row.id, status: 'QUEUED', runAt: { lte: new Date() } },
          orderBy: [{ runAt: 'asc' }, { id: 'asc' }],
        });
        const onlyFollowUps = (row.data as unknown as Batch).status === 'BATCH_COMPLETE';
        const task = onlyFollowUps
          ? candidates.find((candidate) => {
              const payload = candidate.payload as unknown as Delivery;
              return Boolean(payload.followUp || payload.recoveryAuthorized);
            })
          : candidates[0];
        if (task) tasks.push(task);
      }
      const handled = new Set<string>();
      for (const task of tasks) {
        if (handled.has(task.batchId)) continue;
        handled.add(task.batchId);
        const batch = await record<Batch | null>(this.db, task.batchId, null);
        if (
          !batch ||
          !['ACTIVE', 'BATCH_COMPLETE'].includes(batch.status) ||
          (batch.nextAllowedAt && new Date(batch.nextAllowedAt) > new Date())
        )
          continue;
        const data = task.payload as unknown as Delivery;
        const recoveryAuthorized = Boolean(data.recoveryAuthorized);
        if (batch.status === 'BATCH_COMPLETE' && !data.followUp && !recoveryAuthorized) continue;
        const followStepWindow = data.followUp
          ? data.kind === 'sequence' ? data.steps?.[data.stepIndex ?? 0]?.sendWindow : data.followUps?.[data.followUpIndex ?? 0]?.sendWindow
          : undefined;
        const sendWindow = followStepWindow ?? batch.sendWindow;
        if (sendWindow) {
          const next = nextSendWindowAt(sendWindow, new Date());
          if (next.getTime() > Date.now()) {
            await putRecord(this.db, task.batchId, 'BATCH', { ...batch, nextAllowedAt: next.toISOString() });
            continue;
          }
        }
        const isFollowUp = Boolean(data.followUp);
        if (isFollowUp) {
          const business = await record<{ schedule?: CompanySchedule | null }>(this.db, 'settings:business', {});
          if (business.schedule) {
            const next = nextCompanyWindowAt(business.schedule, new Date());
            if (next && next.getTime() > Date.now()) {
              await putRecord(this.db, task.batchId, 'BATCH', { ...batch, nextAllowedAt: next.toISOString() });
              continue;
            }
          }
        }
        const guard = isFollowUp ? await record<{ paused?: boolean; hourKey?: string; hourCount?: number; dayKey?: string; dayCount?: number; consecutiveFailures?: number; maxPerHour?: number; maxPerDay?: number }>(this.db, 'settings:followups', {}) : {};
        if (isFollowUp && (batch.followUpPaused || guard.paused)) continue;
        if (isFollowUp) {
          const now = new Date();
          const hourKey = now.toISOString().slice(0, 13);
          const dayKey = now.toISOString().slice(0, 10);
          const hourCount = guard.hourKey === hourKey ? guard.hourCount ?? 0 : 0;
          const dayCount = guard.dayKey === dayKey ? guard.dayCount ?? 0 : 0;
          if (hourCount >= (guard.maxPerHour ?? 30) || dayCount >= (guard.maxPerDay ?? 100)) {
            const retryAt = new Date(now);
            if (hourCount >= (guard.maxPerHour ?? 30)) retryAt.setUTCHours(retryAt.getUTCHours() + 1, 0, 0, 0);
            else retryAt.setUTCHours(24, 0, 0, 0);
            await putRecord(this.db, task.batchId, 'BATCH', { ...batch, nextAllowedAt: retryAt.toISOString() });
            continue;
          }
          if ((guard.consecutiveFailures ?? 0) >= 3) {
            await putRecord(this.db, 'settings:followups', 'SETTING', { ...guard, paused: true });
            continue;
          }
        }
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
            where: { conversationId: chat.id, direction: 'INBOUND',
              sentAt: { gte: new Date(new Date(data.sourceMessageAt).getTime() - 1000) } },
            select: { id: true },
          });
          if (reply) {
            await this.db.deliveryTask.update({ where: { id: task.id }, data: { status: 'CANCELLED', error: 'Follow-up cancelado: o cliente respondeu.' } });
            const remaining = await this.db.deliveryTask.count({ where: { batchId: task.batchId, status: 'QUEUED' } });
            await putRecord(this.db, task.batchId, 'BATCH', {
              ...batch, status: batch.mode === 'CAMPAIGN' ? (remaining ? batch.status : 'COMPLETED') : 'CANCELLED',
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
            continue;
          }
        }
        const claimed = await this.db.$transaction(async (tx) => {
          const current = await tx.operationRecord.findUnique({ where: { id: task.batchId } });
          const latest = current?.data as unknown as Batch | undefined;
          if (!latest || !(latest.status === 'ACTIVE' || (latest.status === 'BATCH_COMPLETE' && (data.followUp || recoveryAuthorized))))
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
        const campaignFollowUp = data.kind === 'text' && data.followUp ? data.followUps?.[followUpIndex] : undefined;
        const hasNextSequence = data.kind === 'sequence' && index + 1 < (data.steps?.length ?? 0);
        const hasNextCampaignFollowUp = data.kind === 'text' && Boolean(data.followUps?.length) &&
          (!data.followUp || followUpIndex + 1 < data.followUps!.length);
        const hasNext = hasNextSequence || hasNextCampaignFollowUp;
        try {
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
                : step?.snapshot ?? data.snapshot ?? { kind: 'text', text: data.text }),
              requestId: `delivery:${task.id}${data.kind === 'sequence' ? `:${index}` : data.followUp && data.kind === 'text' ? `:follow-up:${followUpIndex}` : ''}${data.retryAttempt ? `:retry:${data.retryAttempt}` : ''}`,
            });
            sentAt = sent.sentAt;
          }
          await this.db.$transaction(async (tx) => {
            await tx.deliveryTask.updateMany({
              where: { id: task.id, status: 'RUNNING' },
              data: hasNext
                ? {
                    status: 'QUEUED',
                    payload: json(hasNextCampaignFollowUp
                      ? { ...data, followUp: true, followUpIndex: data.followUp ? followUpIndex + 1 : 0,
                          sourceMessageAt: data.sourceMessageAt ?? sentAt?.toISOString() }
                      : { ...data, stepIndex: index + 1 }),
                    runAt: new Date(Date.now() + (hasNextCampaignFollowUp
                      ? (() => { const next = data.followUps![data.followUp ? followUpIndex + 1 : 0]!; const base = next.waitMinutes * 60; const min = next.minDelaySeconds ?? 0; const max = next.maxDelaySeconds ?? min; return base + (max >= min && max > 0 ? randomInt(min, max + 1) : 0); })()
                      : (() => { const next = data.steps?.[index + 1]; const min = next?.minDelaySeconds ?? 0; const max = next?.maxDelaySeconds ?? min; return (next?.waitSeconds ?? 1) + (max >= min && max > 0 ? randomInt(min, max + 1) : 0); })()) * 1000),
                  }
                : { status: 'COMPLETED' },
            });
            if (!hasNext && data.labelTransition && data.kind !== 'reminder') {
              const transition = data.labelTransition;
              const scope = { isDeleted: false, OR: [{ sessionId: task.sessionId }, { sessionId: null }] };
              const targetLabel = transition.toLabelId
                ? await tx.label.findFirst({ where: { ...scope, id: transition.toLabelId } }) : null;
              const sourceLabel = transition.fromLabelId
                ? await tx.label.findFirst({ where: { ...scope, id: transition.fromLabelId } }) : null;
              const jid = chat.contact.whatsappJid || `${chat.contact.phoneNumber}@s.whatsapp.net`;
              if (!transition.toLabelId || targetLabel) {
                if (sourceLabel && sourceLabel.id !== targetLabel?.id) {
                  await tx.contactLabel.deleteMany({ where: { contactId: chat.contactId, labelId: sourceLabel.id } });
                  if (sourceLabel.whatsappId) await queueLabelChange(tx, {
                    sessionId: task.sessionId, contactId: chat.contactId, labelId: sourceLabel.id,
                    jid, whatsappId: sourceLabel.whatsappId, active: false,
                  });
                }
                if (targetLabel) {
                  await tx.contactLabel.upsert({ where: { contactId_labelId: { contactId: chat.contactId, labelId: targetLabel.id } }, create: { contactId: chat.contactId, labelId: targetLabel.id }, update: {} });
                  if (targetLabel.whatsappId) await queueLabelChange(tx, {
                    sessionId: task.sessionId, contactId: chat.contactId, labelId: targetLabel.id,
                    jid, whatsappId: targetLabel.whatsappId, active: true,
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
            if (data.followUp) {
              const latestGuard = await record<{ hourKey?: string; hourCount?: number; dayKey?: string; dayCount?: number; consecutiveFailures?: number }>(tx as unknown as PrismaClient, 'settings:followups', {});
              const at = new Date(); const hourKey = at.toISOString().slice(0, 13); const dayKey = at.toISOString().slice(0, 10);
              await tx.operationRecord.upsert({ where: { id: 'settings:followups' }, create: { id: 'settings:followups', kind: 'SETTING', data: json({ hourKey, hourCount: 1, dayKey, dayCount: 1, consecutiveFailures: 0 }) }, update: { data: json({ ...latestGuard, hourKey, hourCount: (latestGuard.hourKey === hourKey ? latestGuard.hourCount ?? 0 : 0) + 1, dayKey, dayCount: (latestGuard.dayKey === dayKey ? latestGuard.dayCount ?? 0 : 0) + 1, consecutiveFailures: 0 }) } });
            }
          });
          if (!hasNext && data.labelTransition && data.kind !== 'reminder')
            this.whatsapp.notify(task.sessionId, 'labels');
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
            if (data.followUp) {
              const guard = await tx.operationRecord.findUnique({ where: { id: 'settings:followups' } });
              const latestGuard = guard?.data as { consecutiveFailures?: number; paused?: boolean } | undefined;
              const failures = (latestGuard?.consecutiveFailures ?? 0) + 1;
              await tx.operationRecord.upsert({ where: { id: 'settings:followups' }, create: { id: 'settings:followups', kind: 'SETTING', data: json({ consecutiveFailures: failures, paused: failures >= 3 }) }, update: { data: json({ ...latestGuard, consecutiveFailures: failures, paused: failures >= 3 }) } });
            }
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
