import express, { type Express } from 'express';
import cors from 'cors';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { PrismaClient } from '@prisma/client';
import { env } from '../../config/env.js';
import { trustedOrigin } from '../../config/origins.js';
import { createSqliteClient, initializeSqliteClient } from '../../database/sqlite-client.js';
import { setDatabasePaths } from '../../database/paths.js';
import { authorizeAccount, authorizeToken, configureAuthorization, type Identity } from '../../http/auth.js';
import { errorHandler } from '../../http/errors.js';
import { AppError } from '../../shared/errors.js';
import { createApp } from '../../app.js';
import { RealtimeHub } from '../../realtime/socket.js';
import { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { CredentialCipher } from '../whatsapp/credential-cipher.js';
import { MessagingService } from '../attendance/messaging.service.js';
import { SequenceService } from '../attendance/sequence.service.js';
import { FlowEngine } from '../flows/flow.engine.js';
import { DeliveryWorker } from '../operations/delivery.worker.js';
import { BusinessWorker } from '../operations/business.worker.js';
import { AiWorker } from '../operations/ai.worker.js';
import { BackupWorker } from '../operations/system-backups.js';
import { InactivityWorker } from '../operations/inactivity.js';
import { AccessService, type AccessWorkspace } from './access.service.js';
import { accessRoutes } from './access.routes.js';

const serverRoot = fileURLToPath(new URL('../../../', import.meta.url));
class LicensedMessaging extends MessagingService {
  constructor(
    db: PrismaClient,
    whatsapp: WhatsappService,
    private readonly check: () => Promise<void>,
  ) {
    super(db, whatsapp);
  }
  override async send(
    sessionId: string,
    conversationId: string,
    raw: unknown,
    beforeSend?: () => Promise<void>,
  ) {
    await this.check();
    return super.send(sessionId, conversationId, raw, async () => {
      await this.check();
      await beforeSend?.();
    });
  }
  override async presence(
    sessionId: string,
    conversationId: string,
    type: 'composing' | 'recording' | 'paused',
  ) {
    await this.check();
    return super.presence(sessionId, conversationId, type);
  }
}
export interface WorkspaceRuntime {
  app: Express;
  whatsapp: WhatsappService;
  stop: () => Promise<void>;
}
export async function buildWorkspaceRuntime(
  db: PrismaClient,
  id: string,
  hub: RealtimeHub,
  check: () => Promise<void>,
  keyFile: string,
) {
  const whatsapp = new WhatsappService(db, await CredentialCipher.load(keyFile), hub.scope(id));
  const messaging = new LicensedMessaging(db, whatsapp, check);
  const sequences = new SequenceService(db, whatsapp, messaging);
  const flows = new FlowEngine(db, whatsapp, messaging);
  const deliveries = new DeliveryWorker(db, whatsapp, messaging, sequences, flows);
  const business = new BusinessWorker(db, whatsapp);
  const ai = new AiWorker(db, whatsapp, messaging, check);
  const backups = new BackupWorker(db);
  const inactivity = new InactivityWorker(db, flows, whatsapp);
  const app = createApp(db, whatsapp, sequences, messaging, flows, { workspaceId: id, configureAuth: false });
  await sequences.start();
  await flows.start();
  await deliveries.start();
  business.start();
  ai.start();
  backups.start();
  inactivity.start();
  let stopped = false;
  return {
    app,
    whatsapp,
    stop: async () => {
      if (stopped) return;
      stopped = true;
      await Promise.all([
        flows.stop(),
        deliveries.stop(),
        business.stop(),
        ai.stop(),
        backups.stop(),
        inactivity.stop(),
        sequences.stop(),
      ]);
      await whatsapp.shutdown();
    },
  } satisfies WorkspaceRuntime;
}
export class WorkspaceManager {
  private readonly active = new Map<string, Promise<WorkspaceRuntime>>();
  private readonly access: AccessService;
  private timer?: ReturnType<typeof setInterval>;
  constructor(
    private readonly registry: PrismaClient,
    private readonly owner: WorkspaceRuntime,
    private readonly hub: RealtimeHub,
    private readonly directory = resolve(serverRoot, env.PLATFORM_DATA_DIR, 'workspaces'),
  ) {
    this.access = new AccessService(registry);
  }
  async get(id = 'owner'): Promise<WorkspaceRuntime> {
    if (id === 'owner') return this.owner;
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new AppError(403, 'Operação inválida.');
    await this.access.assertActive(id);
    let pending = this.active.get(id);
    if (!pending) {
      pending = this.create(id).catch((error) => {
        this.active.delete(id);
        throw error;
      });
      this.active.set(id, pending);
    }
    return pending;
  }
  private async create(id: string) {
    const directory = resolve(this.directory, id);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const databaseUrl = `file:${resolve(directory, 'workspace.db').replace(/\\/g, '/')}`;
    await promisify(execFile)(
      process.execPath,
      [
        resolve(serverRoot, '../../node_modules/prisma/build/index.js'),
        'migrate',
        'deploy',
        '--schema',
        resolve(serverRoot, 'prisma/schema.prisma'),
      ],
      { env: { ...process.env, DATABASE_URL: databaseUrl, RUST_LOG: 'info' }, timeout: 120000 },
    );
    await this.access.assertActive(id);
    const db = createSqliteClient(databaseUrl);
    setDatabasePaths(db, {
      keyFile: resolve(directory, 'credentials.key'),
      backupDir: resolve(directory, 'backups'),
    });
    await initializeSqliteClient(db);
    try {
      const runtime = await buildWorkspaceRuntime(
        db,
        id,
        this.hub,
        () => this.access.assertActive(id),
        resolve(directory, 'credentials.key'),
      );
      await runtime.whatsapp.restore();
      return {
        ...runtime,
        stop: async () => {
          await runtime.stop();
          await db.$disconnect();
        },
      };
    } catch (error) {
      await db.$disconnect();
      throw error;
    }
  }
  async reconcile() {
    for (const [id, runtime] of this.active) {
      try {
        await this.access.assertActive(id);
      } catch {
        this.hub.disconnectWorkspace(id);
        await (await runtime).stop();
        this.active.delete(id);
      }
    }
  }
  async start() {
    const rows = await this.registry.operationRecord.findMany({ where: { kind: 'ACCESS_WORKSPACE' } });
    for (const row of rows) {
      const workspace = row.data as unknown as AccessWorkspace;
      if (!workspace.revokedAt && new Date(workspace.expiresAt).getTime() > Date.now())
        await this.get(workspace.id).catch(() => {
          console.error('Não foi possível preparar uma operação licenciada.');
        });
    }
    this.timer = setInterval(() => {
      void this.reconcile().catch(() => console.error('Falha ao revisar validade das operações.'));
    }, 15000).unref();
  }
  async stop() {
    if (this.timer) clearInterval(this.timer);
    await Promise.all([...this.active.values()].map(async (runtime) => (await runtime).stop()));
    this.active.clear();
  }
}
export function createWorkspaceGateway(
  registry: PrismaClient,
  ownerApp: Express,
  resolveWorkspace: (id: string) => Promise<WorkspaceRuntime>,
  onChanged: () => Promise<void>,
  verify = authorizeToken,
  ownerDb = registry,
) {
  configureAuthorization(ownerDb, registry);
  const app = express();
  app.use(
    cors({
      origin: (origin, done) => done(null, trustedOrigin(origin)),
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Backup-Name'],
    }),
  );
  app.use((req, _res, next) => {
    if (!trustedOrigin(req.headers.origin)) throw new AppError(403, 'Origem não autorizada.');
    next();
  });
  app.use(
    '/api/access',
    express.json({ limit: '64kb' }),
    accessRoutes(registry, undefined, onChanged, (account) => authorizeAccount(account, ownerDb, registry)),
  );
  app.use(async (req, res, next) => {
    if (!req.path.startsWith('/api/') || req.path === '/api/public/runtime') return ownerApp(req, res, next);
    const identity: Identity = await verify(req.headers.authorization?.replace(/^Bearer /, ''));
    const workspace = await resolveWorkspace(identity.workspaceId ?? 'owner');
    res.locals.verifiedIdentity = identity;
    workspace.app(req, res, next);
  });
  app.use(errorHandler);
  return app;
}
