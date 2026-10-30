import { mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { auditDir, assertAuditPath, databaseUrl, root } from './audit-paths.mjs';

assertAuditPath(auditDir);
await rm(auditDir, { recursive: true, force: true });
await mkdir(auditDir, { recursive: true });

const env = { ...process.env, DATABASE_URL: databaseUrl, RUST_LOG: 'info', NODE_ENV: 'test' };
const prisma = join(root, 'node_modules', 'prisma', 'build', 'index.js');
const migration = spawnSync(
  process.execPath,
  [prisma, 'migrate', 'deploy', '--schema', join(root, 'apps', 'server', 'prisma', 'schema.prisma')],
  { cwd: root, env, stdio: 'inherit' },
);
if (migration.status !== 0) process.exit(migration.status ?? 1);

const seed = spawnSync(process.execPath, [join(root, 'e2e', 'scripts', 'audit-seed.mjs')], {
  cwd: root,
  env,
  stdio: 'inherit',
});
process.exitCode = seed.status ?? 1;
