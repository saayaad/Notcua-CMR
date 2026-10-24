import { Router } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import type { WhatsappService } from '../whatsapp/whatsapp.service.js';
import type { FlowEngine } from './flow.engine.js';
import { FlowService } from './flow.service.js';

export function flowRoutes(db: PrismaClient, whatsapp: WhatsappService, engine: FlowEngine) {
  const router = Router();
  const service = new FlowService(db, whatsapp);
  const id = z.string().min(1).max(200);
  router.use('/sessions/:sessionId', async (req, _res, next) => {
    await whatsapp.snapshot(id.parse(req.params.sessionId));
    next();
  });
  router.get('/sessions/:sessionId/flows', async (req, res) => {
    res.json(await service.list(id.parse(req.params.sessionId), req.query.archived === 'true'));
  });
  router.post('/sessions/:sessionId/flows', async (req, res) => {
    res.status(201).json(await service.create(id.parse(req.params.sessionId), req.body));
  });
  router.get('/sessions/:sessionId/flows/:flowId', async (req, res) => {
    res.json(await service.get(id.parse(req.params.sessionId), id.parse(req.params.flowId)));
  });
  router.put('/sessions/:sessionId/flows/:flowId/draft', async (req, res) => {
    res.json(await service.save(id.parse(req.params.sessionId), id.parse(req.params.flowId), req.body));
  });
  router.post('/sessions/:sessionId/flows/:flowId/publish', async (req, res) => {
    res.json(await service.publish(id.parse(req.params.sessionId), id.parse(req.params.flowId), req.body));
  });
  router.put('/sessions/:sessionId/flows/:flowId/settings', async (req, res) => {
    res.json(await service.configure(id.parse(req.params.sessionId), id.parse(req.params.flowId), req.body));
  });
  router.post('/sessions/:sessionId/flows/:flowId/simulate', async (req, res) => {
    res.json(await service.simulate(id.parse(req.params.sessionId), id.parse(req.params.flowId), req.body));
  });
  router.post('/sessions/:sessionId/flows/:flowId/launch', async (req, res) => {
    const body = z.object({ conversationId: id }).parse(req.body);
    res
      .status(202)
      .json(
        await engine.launch(id.parse(req.params.sessionId), id.parse(req.params.flowId), body.conversationId),
      );
  });
  router.get('/sessions/:sessionId/runs', async (req, res) => {
    res.json(
      await service.runs(
        id.parse(req.params.sessionId),
        req.query.conversationId ? id.parse(req.query.conversationId) : undefined,
        req.query.flowId ? id.parse(req.query.flowId) : undefined,
      ),
    );
  });
  router.post('/sessions/:sessionId/runs/:runId/cancel', async (req, res) => {
    res.json(await engine.cancel(id.parse(req.params.sessionId), id.parse(req.params.runId)));
  });
  return router;
}
