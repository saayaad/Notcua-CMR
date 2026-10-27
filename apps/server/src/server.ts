import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { prisma } from './database/client.js';
import { createSqliteClient, initializeSqliteClient } from './database/sqlite-client.js';
import { env } from './config/env.js';
import { configureAuthorization } from './http/auth.js';
import { RealtimeHub } from './realtime/socket.js';
import {
  buildWorkspaceRuntime,
  createWorkspaceGateway,
  WorkspaceManager,
} from './modules/access/workspaces.js';

async function main() {
  await initializeSqliteClient(prisma);
  await prisma.$queryRaw`SELECT COUNT(*) FROM ImportBatch`;
  const serverRoot = fileURLToPath(new URL('../', import.meta.url));
  const platformDir = resolve(serverRoot, env.PLATFORM_DATA_DIR, 'platform');
  await mkdir(platformDir, { recursive: true, mode: 0o700 });
  const registryUrl = `file:${resolve(platformDir, 'access.db').replace(/\\/g, '/')}`;
  await promisify(execFile)(
    process.execPath,
    [
      resolve(serverRoot, '../../node_modules/prisma/build/index.js'),
      'migrate',
      'deploy',
      '--schema',
      resolve(serverRoot, 'prisma/schema.prisma'),
    ],
    { env: { ...process.env, DATABASE_URL: registryUrl, RUST_LOG: 'info' }, timeout: 120000 },
  );
  const registry = createSqliteClient(registryUrl);
  await initializeSqliteClient(registry);
  configureAuthorization(prisma, registry);
  const hub = new RealtimeHub();
  const owner = await buildWorkspaceRuntime(prisma, 'owner', hub, async () => {}, env.WHATSAPP_KEY_FILE);
  const workspaces = new WorkspaceManager(registry, owner, hub);
  const app = createWorkspaceGateway(
    registry,
    owner.app,
    (id) => workspaces.get(id),
    () => workspaces.reconcile(),
    undefined,
    prisma,
  );
  const http = createServer(app);
  const io = hub.attach(http, async (identity) =>
    (await workspaces.get(identity.workspaceId ?? 'owner')).whatsapp.list(),
  );
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 45000).unref();
    await workspaces.stop();
    await owner.stop();
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await Promise.all([registry.$disconnect(), prisma.$disconnect()]);
    clearTimeout(deadline);
  };
  process.once('SIGINT', () => {
    void stop();
  });
  process.once('SIGTERM', () => {
    void stop();
  });
  http.on('error', (error) => {
    console.error('Falha ao iniciar servidor:', error.message);
    void stop().finally(() => {
      process.exitCode = 1;
    });
  });
  http.listen(env.PORT, env.HOST, () => {
    console.log(`Noctua: http://${env.HOST}:${env.PORT}/atendimento · Chaves: /chaves`);
    void owner.whatsapp
      .restore()
      .catch(() => console.error('Não foi possível restaurar as sessões WhatsApp da operação original.'));
    void workspaces
      .start()
      .catch(() => console.error('Não foi possível iniciar a revisão das operações licenciadas.'));
  });
}
main().catch(async (error) => {
  console.error(
    'Não foi possível iniciar. Confira as migrações e a configuração do servidor.',
    error instanceof Error ? error.message : 'Erro interno',
  );
  await prisma.$disconnect();
  process.exitCode = 1;
});
