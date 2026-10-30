import type { Prisma } from '@prisma/client';
import type { Batch, Delivery } from './delivery.worker.js';
import { json } from '../backups/validation.js';

export function normalizeCampaignKeyword(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

export async function queueCampaignResponse(
  tx: Prisma.TransactionClient,
  sessionId: string,
  conversationId: string,
  incomingText: string,
  receivedAt: Date,
): Promise<boolean> {
  const keyword = normalizeCampaignKeyword(incomingText);
  if (!keyword) return false;
  const contact = await tx.conversation.findUnique({
    where: { id: conversationId }, include: { contact: { select: { metadata: true, isGroup: true } } },
  });
  if (!contact || contact.sessionId !== sessionId || contact.contact.isGroup ||
    (contact.contact.metadata as { optOut?: boolean }).optOut) return false;
  const lastOutbound = await tx.chatMessage.findFirst({
    where: { conversationId, direction: 'OUTBOUND', status: { in: ['SENT', 'DELIVERED', 'READ'] },
      sentAt: { lte: new Date(receivedAt.getTime() + 2000) }, type: { not: 'internalNote' } },
    orderBy: [{ sentAt: 'desc' }, { id: 'desc' }], select: { id: true },
  });
  const taskId = /^out:delivery:([^:]+)(?::follow-up:\d+)?$/.exec(lastOutbound?.id ?? '')?.[1];
  if (!taskId) return false;
  const lastTask = await tx.deliveryTask.findUnique({ where: { id: taskId } });
  if (!lastTask || lastTask.sessionId !== sessionId || lastTask.conversationId !== conversationId) return false;
  const lastDelivery = lastTask.payload as unknown as Delivery;
  const campaignId = lastDelivery.sourceCampaignId ?? lastTask.batchId;
  const sourceTask = lastDelivery.sourceCampaignId
    ? await tx.deliveryTask.findFirst({ where: { batchId: campaignId, sessionId, conversationId } })
    : lastTask;
  if (!sourceTask) return false;
  const delivery = sourceTask.payload as unknown as Delivery;
  const ctas = delivery.ctas?.length ? delivery.ctas : delivery.cta ? [delivery.cta] : [];
  const ctaIndex = ctas.findIndex((cta) => normalizeCampaignKeyword(cta.keyword) === keyword);
  if (ctaIndex < 0) return false;
  const cta = ctas[ctaIndex]!;
  const campaign = await tx.operationRecord.findUnique({ where: { id: campaignId } });
  const batch = campaign?.data as unknown as Batch | undefined;
  if (campaign?.kind !== 'BATCH' || batch?.mode !== 'CAMPAIGN' ||
    ['CANCELLED', 'PAUSED'].includes(batch.status)) return false;
  const batchId = `cta:${campaignId}:${conversationId}${ctaIndex ? `:${ctaIndex}` : ''}`;
  const existing = await tx.operationRecord.findUnique({ where: { id: batchId }, select: { id: true } });
  if (existing) return true;
  const replyBatch: Batch = {
    name: `Resposta à CTA ${cta.keyword} · ${batch.name}`,
    sessionId, status: 'ACTIVE', mode: 'SCHEDULE', minSeconds: 1, maxSeconds: 1,
    count: 1, sentCount: 0, createdAt: new Date().toISOString(),
    ...(batch.sendWindow ? { sendWindow: batch.sendWindow } : {}),
  };
  await tx.operationRecord.create({ data: { id: batchId, kind: 'BATCH', data: json(replyBatch) } });
  await tx.deliveryTask.create({
    data: {
      batchId, sessionId, conversationId,
      payload: json({ kind: 'text', sourceCampaignId: campaignId,
        snapshot: { kind: 'text', text: cta.replyText } }),
      runAt: new Date(),
    },
  });
  return true;
}
