import { randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors.js';
import type { WhatsappService } from './whatsapp.service.js';

const id = (req: Request) => z.string().min(1).max(200).parse(req.params.id);
const pagination = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});
const settingsSchema = z.object({
  autoLabelFirstMessage: z.boolean(),
  firstMessageLabelId: z.string().min(1).nullable(),
  timezone: z.literal('America/Sao_Paulo').default('America/Sao_Paulo'),
});
const labelSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#8B5CF6'),
  description: z.string().max(500).default(''),
});

export function whatsappRoutes(db: PrismaClient, service: WhatsappService) {
  const router = Router();
  router.get('/sessions', async (_req, res) => {
    res.json({ items: await service.list() });
  });
  router.post('/sessions', async (req, res) => {
    const body = z.object({ name: z.string().trim().min(1).max(100) }).parse(req.body);
    res.status(201).json(await service.create(body.name));
  });
  router.use('/sessions/:id', async (req, _res, next) => {
    await service.snapshot(id(req));
    next();
  });
  router.get('/sessions/:id', async (req, res) => {
    res.json(await service.snapshot(id(req)));
  });
  router.post('/sessions/:id/connect', async (req, res) => {
    res.status(202).json(await service.connect(id(req)));
  });
  router.post('/sessions/:id/disconnect', async (req, res) => {
    res.json(await service.disconnect(id(req)));
  });
  router.post('/sessions/:id/logout', async (req, res) => {
    res.json(await service.disconnect(id(req), true));
  });
  router.post('/sessions/:id/resync-labels', async (req, res) => {
    res.status(202).json(await service.resync(id(req)));
  });
  router.get('/sessions/:id/settings', async (req, res) => {
    const sessionId = id(req);
    res.json(await db.sessionSettings.upsert({ where: { sessionId }, create: { sessionId }, update: {} }));
  });
  router.put('/sessions/:id/settings', async (req, res) => {
    const sessionId = id(req);
    const data = settingsSchema.parse(req.body);
    if (data.autoLabelFirstMessage && !data.firstMessageLabelId)
      throw new AppError(422, 'Escolha uma etiqueta para ativar a regra.');
    if (data.firstMessageLabelId) {
      const label = await db.label.findUnique({ where: { id: data.firstMessageLabelId } });
      if (!label || label.isDeleted || (label.sessionId && label.sessionId !== sessionId))
        throw new AppError(422, 'Etiqueta inexistente ou de outra sessão.');
    }
    res.json(
      await db.sessionSettings.upsert({ where: { sessionId }, create: { sessionId, ...data }, update: data }),
    );
  });
  router.get('/sessions/:id/labels', async (req, res) => {
    res.json({
      items: await db.label.findMany({
        where: { isDeleted: false, OR: [{ sessionId: id(req) }, { sessionId: null }] },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
        include: { _count: { select: { contacts: true } } },
      }),
    });
  });
  router.post('/sessions/:id/labels', async (req, res) => {
    const data = labelSchema.parse(req.body);
    const label = await db.label.create({
      data: { id: `local:${randomUUID()}`, sessionId: id(req), createReason: 'Criado no Noctua', ...data },
    });
    res.status(201).json(label);
  });
  router.get('/sessions/:id/summary', async (req, res) => {
    const sessionId = id(req);
    const [conversations, messages, labels, labelJobs] = await Promise.all([
      db.conversation.count({ where: { sessionId } }),
      db.chatMessage.count({ where: { conversation: { sessionId } } }),
      db.label.count({ where: { sessionId, isDeleted: false, whatsappId: { not: null } } }),
      db.scheduledJob.findMany({
        where: { type: 'WHATSAPP_ADD_LABEL', status: { in: ['QUEUED', 'RUNNING', 'FAILED'] } },
        select: { payload: true, status: true },
      }),
    ]);
    const jobs = labelJobs.filter(
      (job) =>
        job.payload &&
        typeof job.payload === 'object' &&
        !Array.isArray(job.payload) &&
        job.payload.sessionId === sessionId,
    );
    res.json({
      conversations,
      messages,
      labels,
      pendingLabelJobs: jobs.filter((job) => job.status !== 'FAILED').length,
      failedLabelJobs: jobs.filter((job) => job.status === 'FAILED').length,
    });
  });
  router.get('/sessions/:id/conversations', async (req, res) => {
    const { page, pageSize } = pagination.parse(req.query);
    const where = { sessionId: id(req) };
    const [items, total] = await Promise.all([
      db.conversation.findMany({
        where,
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          contact: { include: { labels: { include: { label: true } } } },
          messages: {
            take: 1,
            orderBy: { sentAt: 'desc' },
            select: { id: true, text: true, caption: true, type: true, sentAt: true, direction: true },
          },
        },
      }),
      db.conversation.count({ where }),
    ]);
    res.json({ items, total, page, pageSize });
  });
  router.get('/sessions/:id/conversations/:conversationId/messages', async (req, res) => {
    const conversationId = z.string().min(1).parse(req.params.conversationId);
    const chat = await db.conversation.findFirst({ where: { id: conversationId, sessionId: id(req) } });
    if (!chat) throw new AppError(404, 'Conversa não encontrada nesta sessão.');
    const { page, pageSize } = pagination.parse(req.query);
    const items = await db.chatMessage.findMany({
      where: { conversationId },
      orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        whatsappMessageId: true,
        text: true,
        caption: true,
        type: true,
        direction: true,
        status: true,
        sentAt: true,
        isPtt: true,
        isPtv: true,
        asViewOnce: true,
      },
    });
    res.json({ items, page, pageSize });
  });
  return router;
}
