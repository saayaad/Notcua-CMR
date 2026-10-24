import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { PrismaClient } from '@prisma/client';
import { env } from './config/env.js';
import { authenticate, configureAuthorization } from './http/auth.js';
import { errorHandler } from './http/errors.js';
import { backupRoutes } from './modules/backups/backup.routes.js';
import { AppError } from './shared/errors.js';
import { fileURLToPath } from 'node:url';
import { trustedOrigin } from './config/origins.js';
import { whatsappRoutes } from './modules/whatsapp/whatsapp.routes.js';
import type { WhatsappService } from './modules/whatsapp/whatsapp.service.js';
import { existsSync } from 'node:fs';
import { attendanceRoutes } from './modules/attendance/attendance.routes.js';
import { MessagingService } from './modules/attendance/messaging.service.js';
import { FlowEngine } from './modules/flows/flow.engine.js';
import { flowRoutes } from './modules/flows/flow.routes.js';
import { crmRoutes } from './modules/crm/crm.routes.js';
import { SequenceService } from './modules/attendance/sequence.service.js';
import { operationsRoutes } from './modules/operations/operations.routes.js';

export function createApp(
  db: PrismaClient,
  whatsapp?: WhatsappService,
  sequences?: SequenceService,
  outbound?: MessagingService,
  flows?: FlowEngine,
) {
  const app = express();
  configureAuthorization(db);
  app.disable('x-powered-by');
  app.use(
    helmet({
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      contentSecurityPolicy: {
        directives: {
          upgradeInsecureRequests: null,
          connectSrc: [
            "'self'",
            'https://*.googleapis.com',
            'https://*.firebaseio.com',
            'https://*.firebaseapp.com',
          ],
          frameSrc: ["'self'", 'https://*.firebaseapp.com', 'https://accounts.google.com'],
          mediaSrc: ["'self'", 'blob:', 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        },
      },
    }),
  );
  app.use(
    cors({
      origin: (origin, callback) => callback(null, trustedOrigin(origin)),
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Backup-Name'],
    }),
  );
  app.get('/', (_req, res) => {
    res.redirect('/atendimento');
  });
  app.get('/api/public/runtime', (_req, res) => res.json({ authMode: env.AUTH_MODE }));
  app.get('/whatsapp', (_req, res) => {
    res.sendFile(fileURLToPath(new URL('../public/connection.html', import.meta.url)));
  });
  app.use('/connection-assets', express.static(fileURLToPath(new URL('../public', import.meta.url))));
  const webRoot = fileURLToPath(new URL('../../web/dist/', import.meta.url));
  app.get('/atendimento', (_req, res) => {
    if (existsSync(`${webRoot}/index.html`)) res.sendFile(`${webRoot}/index.html`);
    else res.redirect('http://127.0.0.1:5173/atendimento');
  });
  app.use('/assets', express.static(`${webRoot}/assets`));
  app.get('/health', async (_req, res) => {
    await db.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', service: 'noctua-server', stage: 5 });
  });
  app.use(
    '/api',
    (req, _res, next) => {
      if (!trustedOrigin(req.headers.origin)) throw new AppError(403, 'Origem não autorizada.');
      next();
    },
    authenticate,
  );
  app.use(express.json({ limit: `${env.BODY_LIMIT_MB}mb` }));
  app.use('/api/backups', backupRoutes(db));
  if (whatsapp) app.use('/api/whatsapp', whatsappRoutes(db, whatsapp));
  if (whatsapp) app.use('/api/crm', crmRoutes(db, whatsapp));
  if (whatsapp) {
    const messaging = outbound ?? new MessagingService(db, whatsapp);
    app.use('/api/operations', operationsRoutes(db, whatsapp, messaging));
    app.use('/api/automation', flowRoutes(db, whatsapp, flows ?? new FlowEngine(db, whatsapp, messaging)));
    app.use(
      '/api/attendance',
      attendanceRoutes(db, whatsapp, sequences ?? new SequenceService(db, whatsapp, messaging), messaging),
    );
  }
  app.get('/api/files/:id', async (req, res) => {
    const file = await db.storedFile.findUnique({ where: { id: req.params.id } });
    if (!file) throw new AppError(404, 'Arquivo não encontrado.');
    res.attachment(file.filename).type(file.mimeType).send(Buffer.from(file.data));
  });
  app.use((_req, _res, next) => next(new AppError(404, 'Rota não encontrada.')));
  app.use(errorHandler);
  return app;
}
