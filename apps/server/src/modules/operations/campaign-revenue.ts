import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../../shared/errors.js';
import { json } from '../backups/validation.js';
import type { Batch } from './delivery.worker.js';
import { record } from './records.js';

type Finance = {
  sessionId: string;
  investmentInCents: number;
  manualRevenueInCents: number;
  revenueSource: 'MANUAL' | 'CRM';
};
type Attribution = { sessionId: string; campaignId: string; conversationId: string };
export const financeKey = (id: string) => `campaign-finance:${id}`;
const attributionKey = (id: string) => `campaign-attribution:${id}`;
export const defaultFinance = (batch: Batch): Finance => ({
  sessionId: batch.sessionId,
  investmentInCents: batch.investmentInCents ?? 0,
  manualRevenueInCents: batch.attributedRevenueInCents ?? 0,
  revenueSource: 'MANUAL',
});

export async function campaignRevenue(db: PrismaClient, sessionId: string) {
  const rows = await db.operationRecord.findMany({
    where: { kind: 'CAMPAIGN_ATTRIBUTION', data: { path: '$.sessionId', equals: sessionId } },
  });
  const links = rows.map((row) => row.data as unknown as Attribution);
  const sales = await db.crmOpportunity.findMany({
    where: {
      status: 'WON',
      conversationId: { in: links.map((item) => item.conversationId) },
      conversation: { sessionId },
    },
    select: { conversationId: true, valueInCents: true },
  });
  const saleMap = new Map(sales.map((item) => [item.conversationId, item.valueInCents]));
  const totals = new Map<string, { revenue: number; sales: number }>();
  for (const link of links) {
    const value = saleMap.get(link.conversationId);
    if (value === undefined) continue;
    const total = totals.get(link.campaignId) ?? { revenue: 0, sales: 0 };
    total.revenue += value;
    total.sales++;
    totals.set(link.campaignId, total);
  }
  const configurations = await db.operationRecord.findMany({
    where: { kind: 'CAMPAIGN_FINANCE', data: { path: '$.sessionId', equals: sessionId } },
  });
  const batches = await db.operationRecord.findMany({
    where: { kind: 'BATCH', data: { path: '$.sessionId', equals: sessionId } },
    select: { id: true, data: true },
  });
  const owned = new Set(
    batches.filter((row) => (row.data as unknown as Batch).mode === 'CAMPAIGN').map((row) => row.id),
  );
  const summary = {
    revenueInCents: 0,
    investmentInCents: 0,
    sales: 0,
    campaigns: 0,
    roiPercent: null as number | null,
  };
  for (const row of configurations) {
    const finance = row.data as unknown as Finance;
    const batchId = row.id.slice('campaign-finance:'.length);
    if (finance.revenueSource !== 'CRM' || !owned.has(batchId)) continue;
    summary.campaigns++;
    summary.investmentInCents += finance.investmentInCents;
    summary.revenueInCents += totals.get(batchId)?.revenue ?? 0;
    summary.sales += totals.get(batchId)?.sales ?? 0;
  }
  if (summary.investmentInCents > 0)
    summary.roiPercent =
      (100 * (summary.revenueInCents - summary.investmentInCents)) / summary.investmentInCents;
  return {
    totals,
    summary,
    configurations: new Map(configurations.map((row) => [row.id, row.data as unknown as Finance])),
  };
}

export function campaignRevenueRoutes(db: PrismaClient) {
  const router = Router();
  const batchFor = async (sessionId: string, campaignId: string) => {
    const batch = await record<Batch | null>(db, campaignId, null);
    if (!batch || batch.sessionId !== sessionId || batch.mode !== 'CAMPAIGN')
      throw new AppError(404, 'Campanha não encontrada nesta conexão.');
    return batch;
  };
  router.get('/sessions/:sessionId/batches/:batchId/revenue', async (req, res) => {
    const sessionId = String(req.params.sessionId);
    const campaignId = String(req.params.batchId);
    await batchFor(sessionId, campaignId);
    const [opportunities, records] = await Promise.all([
      db.crmOpportunity.findMany({
        where: { conversation: { sessionId }, status: 'WON' },
        include: { conversation: { select: { contact: { select: { name: true } } } } },
        orderBy: { wonAt: 'desc' },
      }),
      db.operationRecord.findMany({
        where: { kind: 'CAMPAIGN_ATTRIBUTION', data: { path: '$.sessionId', equals: sessionId } },
      }),
    ]);
    const links = records.map((row) => row.data as unknown as Attribution);
    const map = new Map(links.map((item) => [item.conversationId, item.campaignId]));
    const wonIds = new Set(opportunities.map((item) => item.conversationId));
    res.json({
      items: opportunities.map((item) => ({
        conversationId: item.conversationId,
        name: item.conversation.contact.name,
        title: item.title,
        valueInCents: item.valueInCents,
        campaignId: map.get(item.conversationId) ?? null,
      })),
      selectedIds: links
        .filter((item) => item.campaignId === campaignId && wonIds.has(item.conversationId))
        .map((item) => item.conversationId),
    });
  });
  router.put('/sessions/:sessionId/batches/:batchId/revenue', async (req, res) => {
    if (res.locals.identity.role !== 'ADMIN')
      throw new AppError(403, 'Apenas administradores podem atribuir vendas.');
    const sessionId = String(req.params.sessionId);
    const campaignId = String(req.params.batchId);
    const { conversationIds } = z
      .object({ conversationIds: z.array(z.string().min(1).max(200)).max(5000) })
      .parse(req.body);
    const selected = [...new Set(conversationIds)];
    const selectedSet = new Set(selected);
    const batch = await batchFor(sessionId, campaignId);
    await db.$transaction(
      async (tx) => {
        const owned = await tx.crmOpportunity.count({
          where: { conversationId: { in: selected }, status: 'WON', conversation: { sessionId } },
        });
        if (owned !== selected.length)
          throw new AppError(422, 'Selecione somente vendas ganhas desta conexão.');
        const records = await tx.operationRecord.findMany({
          where: { kind: 'CAMPAIGN_ATTRIBUTION', data: { path: '$.sessionId', equals: sessionId } },
        });
        for (const row of records) {
          const link = row.data as unknown as Attribution;
          if (selectedSet.has(link.conversationId) && link.campaignId !== campaignId)
            throw new AppError(
              409,
              'Uma venda já pertence a outra campanha. Remova o vínculo anterior antes de atribuí-la novamente.',
            );
          if (link.campaignId === campaignId && !selectedSet.has(link.conversationId))
            await tx.operationRecord.delete({ where: { id: row.id } });
        }
        for (const conversationId of selected) {
          const data = json({ sessionId, campaignId, conversationId });
          await tx.operationRecord.upsert({
            where: { id: attributionKey(conversationId) },
            create: { id: attributionKey(conversationId), kind: 'CAMPAIGN_ATTRIBUTION', data },
            update: { data },
          });
        }
        const previous = await tx.operationRecord.findUnique({ where: { id: financeKey(campaignId) } });
        const data = json({ ...((previous?.data as object) ?? defaultFinance(batch)), revenueSource: 'CRM' });
        await tx.operationRecord.upsert({
          where: { id: financeKey(campaignId) },
          create: { id: financeKey(campaignId), kind: 'CAMPAIGN_FINANCE', data },
          update: { data },
        });
      },
      { timeout: 30_000 },
    );
    res.json({ saved: true });
  });
  return router;
}
