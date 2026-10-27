import { Router } from 'express';
import { z } from 'zod';
import type { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors.js';
import { json } from '../backups/validation.js';

export const labelRuleSchema = z
  .object({
    enabled: z.boolean().default(false),
    recordSale: z.boolean().default(false),
    askValue: z.boolean().default(true),
    fixedValueInCents: z.number().int().min(0).max(2_000_000_000).default(0),
    internalNote: z.string().trim().max(2000).default(''),
    pinConversation: z.boolean().default(false),
    investmentInCents: z.number().int().min(0).max(2_000_000_000).default(0),
  })
  .refine(
    (rule) => !rule.enabled || !rule.recordSale || rule.askValue || rule.fixedValueInCents > 0,
    'Informe o valor fixo ou peça o valor ao aplicar a etiqueta.',
  );
export type LabelRule = z.infer<typeof labelRuleSchema>;
export const labelActionInput = {
  confirmActions: z.boolean().optional(),
  saleValueInCents: z.number().int().positive().max(2_000_000_000).optional(),
};
const ruleKey = (sessionId: string, labelId: string) => `label-rule:${sessionId}:${labelId}`;
export async function getLabelRule(
  db: Pick<PrismaClient, 'operationRecord'> | Prisma.TransactionClient,
  sessionId: string,
  labelId: string,
) {
  const row = await db.operationRecord.findUnique({ where: { id: ruleKey(sessionId, labelId) } });
  return labelRuleSchema.parse(row?.data ?? {});
}
export async function applyLabelActions(
  tx: Prisma.TransactionClient,
  sessionId: string,
  conversationId: string,
  labelId: string,
  input: { confirmActions?: boolean; saleValueInCents?: number },
) {
  const rule = await getLabelRule(tx, sessionId, labelId);
  if (!rule.enabled || (!rule.recordSale && !rule.internalNote && !rule.pinConversation)) return;
  if (!input.confirmActions)
    throw new AppError(409, 'Esta etiqueta possui ações. Revise e confirme antes de aplicar.');
  if (rule.recordSale) {
    const value = rule.askValue ? input.saleValueInCents : rule.fixedValueInCents;
    if (!value || value < 1) throw new AppError(422, 'Informe o valor da venda para esta etiqueta.');
    const current = await tx.crmOpportunity.findUnique({ where: { conversationId } });
    await tx.crmOpportunity.upsert({
      where: { conversationId },
      create: { conversationId, status: 'WON', valueInCents: value, wonAt: new Date(), version: 1 },
      update: {
        status: 'WON',
        valueInCents: value,
        wonAt: current?.wonAt ?? new Date(),
        lostAt: null,
        version: { increment: 1 },
      },
    });
    const data = json({ sessionId, conversationId, labelId });
    await tx.operationRecord.upsert({
      where: { id: `label-sale:${conversationId}` },
      create: { id: `label-sale:${conversationId}`, kind: 'LABEL_SALE', data },
      update: { data },
    });
  }
  if (rule.pinConversation)
    await tx.conversation.update({ where: { id: conversationId }, data: { pinned: true } });
  if (rule.internalNote) {
    const id = `label-note:${conversationId}:${labelId}`;
    const data = json({
      sessionId,
      conversationId,
      text: rule.internalNote,
      author: 'Ação da etiqueta',
      sentAt: new Date().toISOString(),
    });
    await tx.operationRecord.upsert({
      where: { id },
      create: { id, kind: `INTERNAL_NOTE:${conversationId}`, data },
      update: {},
    });
  }
}
export function labelActionRoutes(db: PrismaClient) {
  const router = Router();
  const labelFor = async (sessionId: string, labelId: string) => {
    const label = await db.label.findFirst({
      where: { id: labelId, isDeleted: false, OR: [{ sessionId }, { sessionId: null }] },
    });
    if (!label) throw new AppError(404, 'Etiqueta indisponível nesta conexão.');
    return label;
  };
  router.get('/sessions/:sessionId/label-rules/:labelId', async (req, res) => {
    const sessionId = String(req.params.sessionId),
      labelId = String(req.params.labelId);
    await labelFor(sessionId, labelId);
    res.json(await getLabelRule(db, sessionId, labelId));
  });
  router.put('/sessions/:sessionId/label-rules/:labelId', async (req, res) => {
    if (res.locals.identity.role !== 'ADMIN')
      throw new AppError(403, 'Apenas administradores configuram ações e investimentos.');
    const sessionId = String(req.params.sessionId),
      labelId = String(req.params.labelId);
    await labelFor(sessionId, labelId);
    const rule = labelRuleSchema.parse(req.body);
    const data = json(rule);
    await db.operationRecord.upsert({
      where: { id: ruleKey(sessionId, labelId) },
      create: { id: ruleKey(sessionId, labelId), kind: 'LABEL_RULE', data },
      update: { data },
    });
    res.json({ saved: true });
  });
  router.get('/sessions/:sessionId/label-finance', async (req, res) => {
    const sessionId = String(req.params.sessionId);
    const [labels, links] = await Promise.all([
      db.label.findMany({
        where: { OR: [{ sessionId }, { sessionId: null }] },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      }),
      db.operationRecord.findMany({
        where: { kind: 'LABEL_SALE', data: { path: '$.sessionId', equals: sessionId } },
      }),
    ]);
    const attributions = links.map(
      (row) => row.data as unknown as { conversationId: string; labelId: string },
    );
    const won = await db.crmOpportunity.findMany({
      where: {
        conversationId: { in: attributions.map((x) => x.conversationId) },
        status: 'WON',
        conversation: { sessionId },
      },
      select: { conversationId: true, valueInCents: true },
    });
    const sales = new Map(won.map((x) => [x.conversationId, x.valueInCents]));
    const items = await Promise.all(
      labels.map(async (label) => {
        const rule = await getLabelRule(db, sessionId, label.id);
        const selected = attributions.filter((x) => x.labelId === label.id && sales.has(x.conversationId));
        const revenueInCents = selected.reduce((sum, x) => sum + (sales.get(x.conversationId) ?? 0), 0);
        return {
          id: label.id,
          name: label.name,
          color: label.color,
          archived: label.isDeleted,
          rule,
          sales: selected.length,
          revenueInCents,
          roiPercent:
            rule.investmentInCents > 0
              ? (100 * (revenueInCents - rule.investmentInCents)) / rule.investmentInCents
              : null,
        };
      }),
    );
    res.json({ items: items.filter((x) => !x.archived || x.sales > 0) });
  });
  return router;
}
