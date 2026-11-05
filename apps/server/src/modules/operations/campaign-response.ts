import type { Prisma } from '@prisma/client';
import type { Batch, Delivery } from './delivery.worker.js';
import { json } from '../backups/validation.js';
import { queueLabelChange } from '../whatsapp/label-changes.js';

export function normalizeCampaignKeyword(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasKeyword(incoming: string, configured: string) {
  const text = ` ${normalizeCampaignKeyword(incoming)} `;
  const alternatives = configured.split(/[,;|\n]/).map(normalizeCampaignKeyword).filter(Boolean);
  return alternatives.some((keyword) => text.includes(` ${keyword} `));
}

async function assetSnapshot(tx: Prisma.TransactionClient, assetId: string) {
  const asset = await tx.asset.findUnique({ where: { id: assetId }, include: { file: true } });
  if (!asset || (asset.kind === 'MESSAGE' ? !asset.text?.trim() : !asset.file)) return null;
  const kind = asset.kind === 'MESSAGE'
    ? 'text'
    : asset.kind === 'AUDIO'
      ? 'audio'
      : asset.kind === 'DOCUMENT'
        ? 'document'
        : asset.file?.mimeType.startsWith('video/')
          ? 'video'
          : 'image';
  return {
    kind,
    ...(asset.text ? { text: asset.text } : {}),
    ...(asset.caption ? { caption: asset.caption } : {}),
    ...(asset.fileId ? { fileId: asset.fileId } : {}),
    isPtt: asset.isPtt,
    isPtv: asset.isPtv,
    asViewOnce: asset.asViewOnce,
  };
}

export async function queueCampaignResponse(
  tx: Prisma.TransactionClient,
  sessionId: string,
  conversationId: string,
  incomingText: string,
  receivedAt: Date,
): Promise<boolean> {
  const normalizedIncoming = normalizeCampaignKeyword(incomingText);
  if (!normalizedIncoming) return false;
  const conversation = await tx.conversation.findUnique({
    where: { id: conversationId },
    include: { contact: { select: { id: true, phoneNumber: true, whatsappJid: true, metadata: true, isGroup: true } } },
  });
  if (!conversation || conversation.sessionId !== sessionId || conversation.contact.isGroup ||
    (conversation.contact.metadata as { optOut?: boolean }).optOut) return false;

  const lastOutbound = await tx.chatMessage.findFirst({
    where: {
      conversationId,
      direction: 'OUTBOUND',
      status: { in: ['SENT', 'DELIVERED', 'READ'] },
      sentAt: { lte: new Date(receivedAt.getTime() + 2000) },
      type: { not: 'internalNote' },
    },
    orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
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
  const delivery = sourceTask.payload as unknown as Delivery & { defaultReplyText?: string };
  const ctas = delivery.ctas?.length ? delivery.ctas : delivery.cta ? [delivery.cta] : [];
  const ctaIndex = ctas.findIndex((cta) => hasKeyword(normalizedIncoming, cta.keyword));
  const campaign = await tx.operationRecord.findUnique({ where: { id: campaignId } });
  const batch = campaign?.data as unknown as Batch | undefined;
  if (campaign?.kind !== 'BATCH' || batch?.mode !== 'CAMPAIGN' ||
    ['CANCELLED', 'PAUSED'].includes(batch.status)) return false;

  const noticeId = `notice:campaign-response:${campaignId}:${conversationId}`;
  await tx.operationRecord.upsert({
    where: { id: noticeId },
    create: { id: noticeId, kind: 'NOTICE', data: json({ title: batch.name, text: `Resposta recebida de ${conversation.contact.phoneNumber} na campanha “${batch.name}”.`, conversationId, createdAt: receivedAt.toISOString(), read: false }) },
    update: {},
  });

  if (ctaIndex >= 0) {
    const cta = ctas[ctaIndex]!;
    const responseBatchId = `cta:${campaignId}:${conversationId}:${ctaIndex}`;
    if (await tx.operationRecord.findUnique({ where: { id: responseBatchId }, select: { id: true } })) return true;

    if (cta.labelId) {
      const label = await tx.label.findFirst({ where: { id: cta.labelId, isDeleted: false, OR: [{ sessionId }, { sessionId: null }] } });
      if (label) {
        const link = { contactId: conversation.contact.id, labelId: label.id };
        await tx.contactLabel.upsert({ where: { contactId_labelId: link }, create: link, update: {} });
        if (label.whatsappId) await queueLabelChange(tx, {
          sessionId, contactId: conversation.contact.id, labelId: label.id,
          jid: conversation.contact.whatsappJid ?? `${conversation.contact.phoneNumber}@s.whatsapp.net`,
          whatsappId: label.whatsappId, active: true,
        });
      }
    }

    const steps: { snapshot: Record<string, unknown>; waitSeconds: number }[] = [];
    if (cta.replyText?.trim()) steps.push({ snapshot: { kind: 'text', text: cta.replyText }, waitSeconds: 1 });
    if (cta.assetId) {
      const snapshot = await assetSnapshot(tx, cta.assetId);
      if (snapshot) steps.push({ snapshot, waitSeconds: 1 });
    }
    if (!steps.length) return true;
    const replyDelivery: Delivery = steps.length > 1
      ? { kind: 'sequence', steps, sourceCampaignId: campaignId }
      : { kind: 'text', snapshot: steps[0]?.snapshot ?? { kind: 'text', text: cta.replyText }, sourceCampaignId: campaignId };
    const responseBatch: Batch = {
      name: `Resposta à CTA ${cta.keyword} · ${batch.name}`,
      sessionId, status: 'ACTIVE', mode: 'SCHEDULE', minSeconds: 1, maxSeconds: 1,
      count: 1, sentCount: 0, createdAt: new Date().toISOString(),
      ...(replyDelivery.kind === 'sequence' ? { sequenceMode: true } : {}),
      ...(batch.sendWindow ? { sendWindow: batch.sendWindow } : {}),
    };
    await tx.operationRecord.create({ data: { id: responseBatchId, kind: 'BATCH', data: json(responseBatch) } });
    await tx.deliveryTask.create({
      data: { batchId: responseBatchId, sessionId, conversationId, payload: json(replyDelivery), runAt: new Date() },
    });
    return true;
  }

  const defaultReplyText = delivery.defaultReplyText?.trim();
  if (defaultReplyText) {
    const responseBatchId = `campaign-default:${campaignId}:${conversationId}`;
    if (!(await tx.operationRecord.findUnique({ where: { id: responseBatchId }, select: { id: true } }))) {
      const responseBatch: Batch = {
        name: `Resposta padrão · ${batch.name}`, sessionId, status: 'ACTIVE', mode: 'SCHEDULE',
        minSeconds: 1, maxSeconds: 1, count: 1, sentCount: 0, createdAt: new Date().toISOString(),
      };
      await tx.operationRecord.create({ data: { id: responseBatchId, kind: 'BATCH', data: json(responseBatch) } });
      await tx.deliveryTask.create({
        data: { batchId: responseBatchId, sessionId, conversationId, payload: json({ kind: 'text', sourceCampaignId: campaignId, snapshot: { kind: 'text', text: defaultReplyText } }), runAt: new Date() },
      });
    }
  }
  return true;
}
