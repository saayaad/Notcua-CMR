import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import type { WhatsappService } from '../whatsapp/whatsapp.service.js';
import type { FlowEngine } from '../flows/flow.engine.js';
import { AppError } from '../../shared/errors.js';
import { record, putRecord } from './records.js';
export interface InactivityRule {
  name: string;
  sessionId: string;
  flowId: string;
  labelId: string;
  inactiveMinutes: number;
  enabled: boolean;
}
export function inactivityRoutes(db: PrismaClient, whatsapp: WhatsappService) {
  const router = Router({ mergeParams: true });
  router.get('/', async (req, res) => {
    const sessionId = String((req.params as { sessionId?: string }).sessionId);
    await whatsapp.snapshot(sessionId);
    const rows = await db.operationRecord.findMany({
      where: { kind: 'INACTIVITY_RULE' },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      items: rows
        .filter((row) => (row.data as unknown as InactivityRule).sessionId === sessionId)
        .map((row) => ({ id: row.id, ...(row.data as object) })),
    });
  });
  router.post('/', async (req, res) => {
    if (res.locals.identity.role !== 'ADMIN')
      throw new AppError(403, 'Esta ação exige acesso de administrador.');
    const sessionId = String((req.params as { sessionId?: string }).sessionId);
    await whatsapp.snapshot(sessionId);
    const input = z
      .object({
        name: z.string().trim().min(1).max(100),
        flowId: z.string().max(200),
        labelId: z.string().max(200).default(''),
        inactiveMinutes: z.number().int().min(1).max(5256000),
      })
      .parse(req.body);
    if (
      !(await db.flow.findFirst({ where: { id: input.flowId, sessionId, enabled: true, archived: false } }))
    )
      throw new AppError(422, 'Escolha um fluxo publicado e ativo.');
    if (
      input.labelId &&
      !(await db.label.findFirst({
        where: { id: input.labelId, isDeleted: false, OR: [{ sessionId }, { sessionId: null }] },
      }))
    )
      throw new AppError(422, 'Etiqueta indisponível nesta conexão.');
    const id = `inactivity:${randomUUID()}`;
    await putRecord(db, id, 'INACTIVITY_RULE', { ...input, sessionId, enabled: false });
    res.status(201).json({ id });
  });
  router.put('/:ruleId', async (req, res) => {
    if (res.locals.identity.role !== 'ADMIN')
      throw new AppError(403, 'Esta ação exige acesso de administrador.');
    const current = await record<InactivityRule | null>(db, String(req.params.ruleId), null);
    if (!current || current.sessionId !== String((req.params as { sessionId?: string }).sessionId))
      throw new AppError(404, 'Regra não encontrada.');
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
    await putRecord(db, String(req.params.ruleId), 'INACTIVITY_RULE', { ...current, enabled });
    res.json({ saved: true });
  });
  return router;
}
export class InactivityWorker {
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private work: Promise<void> = Promise.resolve();
  private cursors = new Map<string, string>();
  constructor(
    private db: PrismaClient,
    private flows: FlowEngine,
    private whatsapp: WhatsappService,
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
      }, 60000).unref();
  }
  async stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.work;
  }
  async flush() {
    const rules = await this.db.operationRecord.findMany({ where: { kind: 'INACTIVITY_RULE' } });
    for (const row of rules) {
      const rule = row.data as unknown as InactivityRule;
      if (!rule.enabled) continue;
      try {
        this.whatsapp.connectedSocket(rule.sessionId);
      } catch {
        continue;
      }
      const cursor = this.cursors.get(row.id);
      const chats = await this.db.conversation.findMany({
        where: {
          sessionId: rule.sessionId,
          status: 'OPEN',
          lastMessageAt: { lte: new Date(Date.now() - rule.inactiveMinutes * 60000) },
          ...(cursor ? { id: { gt: cursor } } : {}),
          contact: {
            isGroup: false,
            ...(rule.labelId ? { labels: { some: { labelId: rule.labelId } } } : {}),
          },
        },
        orderBy: { id: 'asc' },
        take: 100,
        include: { contact: true },
      });
      if (chats.length === 100) this.cursors.set(row.id, chats.at(-1)!.id);
      else this.cursors.delete(row.id);
      for (const chat of chats) {
        if ((chat.contact.metadata as { optOut?: boolean }).optOut) continue;
        const key = `idle-run:${row.id}:${chat.id}:${chat.lastMessageAt!.getTime()}`;
        if (await this.db.operationRecord.findUnique({ where: { id: key } })) continue;
        if (
          (await this.db.flowExecution.count({
            where: { conversationId: chat.id, status: { in: ['QUEUED', 'RUNNING', 'WAITING_INPUT'] } },
          })) ||
          (await this.db.sequenceRun.count({
            where: { conversationId: chat.id, status: { in: ['QUEUED', 'RUNNING'] } },
          }))
        )
          continue;
        await putRecord(this.db, key, 'INACTIVITY_RUN', {
          status: 'RUNNING',
          ruleId: row.id,
          conversationId: chat.id,
        });
        try {
          const run = await this.flows.launch(rule.sessionId, rule.flowId, chat.id);
          await putRecord(this.db, key, 'INACTIVITY_RUN', {
            status: 'COMPLETED',
            ruleId: row.id,
            runId: run.id,
            conversationId: chat.id,
          });
        } catch (error) {
          if (error instanceof AppError && error.status === 409)
            await this.db.operationRecord.delete({ where: { id: key } });
          else {
            await putRecord(this.db, key, 'INACTIVITY_RUN', {
              status: 'FAILED',
              ruleId: row.id,
              conversationId: chat.id,
            });
            await putRecord(this.db, `notice:${key}`, 'NOTICE', {
              title: 'Regra de inatividade não iniciou',
              text: error instanceof Error ? error.message : 'Confira o fluxo selecionado.',
              createdAt: new Date().toISOString(),
              read: false,
            });
          }
        }
      }
    }
  }
}
