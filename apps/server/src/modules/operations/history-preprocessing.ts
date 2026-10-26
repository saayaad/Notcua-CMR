import { Router } from 'express';
import { z } from 'zod';
import type { PrismaClient, Prisma } from '@prisma/client';
import type { MessagingService } from '../attendance/messaging.service.js';
import { AppError } from '../../shared/errors.js';
import { preprocessMedia } from './ai-media.js';
import { record } from './records.js';

export function historyPreprocessingRoutes(db: PrismaClient, messaging: MessagingService) {
  const router = Router();
  router.post('/sessions/:sessionId/history-preprocessing', async (req, res) => {
    const input = z.object({
      conversationIds: z.array(z.string().min(1).max(200)).min(1).max(100),
      consent: z.literal(true), cursor: z.string().max(200).optional(),
      snapshot: z.iso.datetime().optional(),
    }).parse(req.body);
    const sessionId = String(req.params.sessionId);
    const ids = [...new Set(input.conversationIds)];
    const count = await db.conversation.count({ where: { sessionId, id: { in: ids } } });
    if (count !== ids.length) throw new AppError(404, 'Uma das conversas não está disponível nesta conexão.');
    const snapshot = input.snapshot ?? new Date().toISOString();
    const where: Prisma.ChatMessageWhereInput = {
      conversationId: { in: ids }, asViewOnce: false, sentAt: { lte: new Date(snapshot) },
      OR: ['audio', 'image', 'video', 'document', 'sticker', 'ptv'].map(type => ({ type: { contains: type } })),
    };
    const [total, message] = await Promise.all([
      db.chatMessage.count({ where }),
      db.chatMessage.findFirst({ where: { ...where, ...(input.cursor ? { id: { gt: input.cursor } } : {}) }, orderBy: { id: 'asc' } }),
    ]);
    if (!message) { res.json({ total, done: true, snapshot }); return; }
    const cached = await record<{ text?: string } | null>(db, `ai-media:${message.id}`, null);
    let status = cached?.text ? 'CACHED' : 'ANALYZED';
    let error: string | undefined;
    let fatal = false;
    try {
      if (!cached?.text) await preprocessMedia(db, messaging, sessionId, message.conversationId, message.id);
    } catch (cause) {
      status = 'UNAVAILABLE';
      error = cause instanceof AppError ? cause.message : 'Não foi possível analisar esta mídia.';
      fatal = !(cause instanceof AppError) || [401, 403, 429, 500, 502, 503].includes(cause.status) || /Configure a chave|modelo de análise de mídias/.test(error);
    }
    res.json({ total, done: false, snapshot, nextCursor: message.id, fatal,
      item: { id: message.id, conversationId: message.conversationId, type: message.type, status, error } });
  });
  return router;
}
