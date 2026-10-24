import { Router } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import type { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { CrmService } from './crm.service.js';

export function crmRoutes(db: PrismaClient, whatsapp: WhatsappService) {
  const router = Router();
  const service = new CrmService(db, whatsapp);
  const id = z.string().min(1).max(200);
  router.use('/sessions/:sessionId', async (req, _res, next) => {
    await whatsapp.snapshot(id.parse(req.params.sessionId));
    next();
  });
  router.get('/sessions/:sessionId/board', async (req, res) => {
    res.json(await service.board(id.parse(req.params.sessionId), req.query));
  });
  router.get('/sessions/:sessionId/metrics', async (req, res) => {
    const days = z.coerce
      .number()
      .pipe(z.union([z.literal(7), z.literal(30), z.literal(90)]))
      .default(30)
      .parse(req.query.days);
    res.json(await service.metrics(id.parse(req.params.sessionId), days));
  });
  router.post('/sessions/:sessionId/move', async (req, res) => {
    res.json(await service.move(id.parse(req.params.sessionId), req.body));
  });
  router.put('/sessions/:sessionId/opportunities/:conversationId', async (req, res) => {
    res.json(
      await service.saveOpportunity(
        id.parse(req.params.sessionId),
        id.parse(req.params.conversationId),
        req.body,
      ),
    );
  });
  router.post('/sessions/:sessionId/labels', async (req, res) => {
    res.status(201).json(await service.label(id.parse(req.params.sessionId), null, req.body));
  });
  router.put('/sessions/:sessionId/labels/:labelId', async (req, res) => {
    res.json(await service.label(id.parse(req.params.sessionId), id.parse(req.params.labelId), req.body));
  });
  router.delete('/sessions/:sessionId/labels/:labelId', async (req, res) => {
    res.json(await service.deleteLabel(id.parse(req.params.sessionId), id.parse(req.params.labelId)));
  });
  router.post('/sessions/:sessionId/retry-sync', async (req, res) => {
    res.json(await service.retrySync(id.parse(req.params.sessionId)));
  });
  return router;
}
