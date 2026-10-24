import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { BackupService } from '../src/modules/backups/backup.service.js';
const source = process.argv[2];
if (!source) throw new Error('Informe o caminho do backup JSON para validar em um banco temporário.');
const directory = await mkdtemp(join(tmpdir(), 'noctua-backup-check-'));
const databaseUrl = `file:${join(directory, 'test.db').replace(/\\/g, '/')}`;
const db = new PrismaClient({ datasourceUrl: databaseUrl });
try {
  execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL('../../../node_modules/prisma/build/index.js', import.meta.url)),
      'migrate',
      'deploy',
      '--schema',
      fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url)),
    ],
    { env: { ...process.env, DATABASE_URL: databaseUrl, RUST_LOG: 'info' }, stdio: 'pipe' },
  );
  const session = await db.whatsappSession.create({ data: { name: 'Validação isolada' } });
  const input: unknown = JSON.parse((await readFile(resolve(source), 'utf8')).replace(/^\uFEFF/, ''));
  const service = new BackupService(db);
  const result = await service.import(input, 'validacao.json', { sessionId: session.id });
  const media = await db.storedFile.aggregate({ _max: { byteLength: true }, _sum: { byteLength: true } });
  const duplicate = await service.import(input, 'validacao.json', { sessionId: session.id });
  console.log(
    JSON.stringify(
      {
        report: result,
        largestMediaBytes: media._max.byteLength,
        totalMediaBytes: media._sum.byteLength,
        duplicate: duplicate.duplicate,
        actions: await db.macroAction.count(),
        queuedSchedules: await db.deliveryTask.count(),
        activeBatches: await db.operationRecord.count({
          where: { kind: 'BATCH', data: { path: '$.status', equals: 'ACTIVE' } },
        }),
      },
      null,
      2,
    ),
  );
} finally {
  await db.$disconnect();
  await rm(directory, { recursive: true, force: true });
}
