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
  const sourceTask = await tx.deliveryTask.findUnique({ where: { id: taskId } });
  if (!sourceTask || sourceTask.sessionId !== sessionId || sourceTask.conversationId !== conversationId) return false;
  const delivery = sourceTask.payload as unknown as Delivery;
  if (!delivery.cta || normalizeCampaignKeyword(delivery.cta.keyword) !== keyword) return false;
  const campaign = await tx.operationRecord.findUnique({ where: { id: sourceTask.batchId } });
  const batch = campaign?.data as unknown as Batch | undefined;
  if (campaign?.kind !== 'BATCH' || batch?.mode !== 'CAMPAIGN' || batch.status === 'CANCELLED') return false;
  const batchId = `cta:${sourceTask.batchId}:${conversationId}`;
  const existing = await tx.operationRecord.findUnique({ where: { id: batchId }, select: { id: true } });
  if (existing) return true;
  const replyBatch: Batch = {
    name: `Resposta à CTA · ${batch.name}`,
    sessionId, status: 'ACTIVE', mode: 'SCHEDULE', minSeconds: 1, maxSeconds: 1,
    count: 1, sentCount: 0, createdAt: new Date().toISOString(),
  };
  await tx.operationRecord.create({ data: { id: batchId, kind: 'BATCH', data: json(replyBatch) } });
  await tx.deliveryTask.create({
    data: {
      batchId, sessionId, conversationId,
      payload: json({ kind: 'text', snapshot: { kind: 'text', text: delivery.cta.replyText } }),
      runAt: new Date(),
    },
  });
  return true;
}
