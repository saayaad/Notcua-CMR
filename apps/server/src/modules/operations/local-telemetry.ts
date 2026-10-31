import { Router, type RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { PrismaClient } from '@prisma/client';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { json } from '../backups/validation.js';

export const localTelemetryEnabled = () =>
  env.NODE_ENV !== 'production' && env.AUTH_MODE === 'local' && process.env.AUDIT_LOCAL_TELEMETRY === '1';

// Observe only the already specified CRM campaign-attribution operation.
// No URL, session/contact ID, body, token or error message enters this event.
export function attributionTelemetry(db: PrismaClient): RequestHandler {
  return (req, res, next) => {
    if (
      localTelemetryEnabled() &&
      req.method === 'PUT' &&
      /^\/sessions\/[^/]+\/batches\/[^/]+\/revenue$/.test(req.path)
    ) {
      const started = performance.now();
      res.once('finish', () => {
        const data = json({
          category: 'campaign.attribution',
          source: 'CRM',
          occurredAt: new Date().toISOString(),
          result: res.statusCode < 400 ? 'SUCCESS' : 'ERROR',
          status: res.statusCode,
          durationMs: Math.max(0, Math.round(performance.now() - started)),
        });
        void db.operationRecord
          .create({ data: { id: `audit-telemetry:${randomUUID()}`, kind: 'AUDIT_LOCAL_TELEMETRY', data } })
          .catch(() => console.error('Não foi possível gravar a telemetria fictícia local.'));
      });
    }
    next();
  };
}

export function localTelemetryRoutes(db: PrismaClient) {
  const router = Router();
  router.get('/', async (_req, res) => {
    if (!localTelemetryEnabled()) throw new AppError(403, 'Telemetria de auditoria local desativada.');
    if (res.locals.identity?.role !== 'ADMIN')
      throw new AppError(403, 'Esta ação exige acesso de administrador.');
    const rows = await db.operationRecord.findMany({
      where: { kind: 'AUDIT_LOCAL_TELEMETRY' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ items: rows.map((row) => row.data), externalDestinations: 0 });
  });
  return router;
}
