import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import express from 'express';
import request from 'supertest';
import { createSqliteClient } from '../src/database/sqlite-client.js';
import { setDatabasePaths } from '../src/database/paths.js';
import { safetyRoutes, assertResetIdle } from '../src/modules/operations/safety.routes.js';
import { putRecord } from '../src/modules/operations/records.js';
import { errorHandler } from '../src/http/errors.js';

const directory = await mkdtemp(join(tmpdir(), 'noctua-safety-review-'));
const url = `file:${join(directory, 'test.db').replace(/\\/g, '/')}`;
const db = createSqliteClient(url);
setDatabasePaths(db, { keyFile: join(directory, 'fictitious.key'), backupDir: join(directory, 'backups') });
let disconnected = 0;
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.locals.identity = {
    email: 'admin@example.com',
    role: req.headers['x-test-member'] ? 'MEMBER' : 'ADMIN',
  };
  next();
});
app.use(
  '/safety',
  safetyRoutes(db, {
    disconnect: async () => {
      disconnected++;
    },
  } as never),
);
app.use(errorHandler);
let session = '';
before(async () => {
  execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL('../../../node_modules/prisma/build/index.js', import.meta.url)),
      'migrate',
      'deploy',
      '--schema',
      fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url)),
    ],
    { env: { ...process.env, DATABASE_URL: url, RUST_LOG: 'info' }, stdio: 'pipe' },
  );
  session = (await db.whatsappSession.create({ data: { name: 'Fictícia', autoConnect: false } })).id;
  await db.contact.create({ data: { name: 'Cliente fictício', phoneNumber: '5511000000001' } });
  await db.asset.create({
    data: { id: 'fictitious-asset', name: 'Resposta fictícia', kind: 'MESSAGE', text: 'Exemplo' },
  });
  await putRecord(db, 'preferences:fictitious', 'SETTINGS', { theme: 'light' });
  await putRecord(db, 'access:fictitious', 'ACCESS_KEY', { test: true });
  await putRecord(db, 'ai-example:fictitious', 'AI_TRAINING', {
    prompt: 'Exemplo local',
    answer: 'Resposta fictícia',
  });
  const bytes = Buffer.from('Arquivo fictício de recuperação.');
  await db.storedFile.create({
    data: {
      sha256: 'fictitious-sha',
      filename: 'teste.txt',
      mimeType: 'text/plain',
      byteLength: bytes.length,
      data: bytes,
    },
  });
});
after(async () => {
  await db.$disconnect();
  await rm(directory, { recursive: true, force: true });
});

test('REQ-193: zona de segurança exige administrador, EXCLUIR e escolha explícita de backup', async () => {
  await request(app).post('/safety/backup').set('x-test-member', 'true').expect(403);
  await request(app)
    .post('/safety/reset')
    .set('x-test-member', 'true')
    .send({ confirmation: 'EXCLUIR', backupChoice: 'skip' })
    .expect(403);
  await request(app)
    .post('/safety/reset')
    .send({ confirmation: 'excluir', backupChoice: 'skip' })
    .expect(422);
  await request(app).post('/safety/reset').send({ confirmation: 'EXCLUIR' }).expect(422);
  await request(app)
    .post('/safety/reset')
    .send({ confirmation: 'EXCLUIR', backupChoice: 'downloaded', backupId: 'inexistente' })
    .expect(422);
  assert.equal(await db.contact.count(), 1);
  assert.equal(disconnected, 0);
});

test('conexão ativa bloqueia reset sem apagar os dados', async () => {
  await db.whatsappSession.update({ where: { id: session }, data: { status: 'CONNECTED' } });
  await request(app)
    .post('/safety/reset')
    .send({ confirmation: 'EXCLUIR', backupChoice: 'skip' })
    .expect(409);
  assert.equal(await db.contact.count(), 1);
  await db.whatsappSession.update({
    where: { id: session },
    data: { status: 'DISCONNECTED', autoConnect: false },
  });
});

test('fluxos, macros e funis em execução também impedem reset', async () => {
  for (const busy of ['flowExecution', 'macroExecution', 'funnelExecution']) {
    const repository = Object.fromEntries(
      [
        'whatsappSession',
        'deliveryTask',
        'sequenceRun',
        'scheduledJob',
        'flowExecution',
        'macroExecution',
        'funnelExecution',
      ].map((name) => [name, { count: async () => (name === busy ? 1 : 0) }]),
    );
    await assert.rejects(assertResetIdle(repository as never), /envios em andamento/);
  }
});

test('backup completo antecede reset e preserva registro de cópia e acesso', async () => {
  const backup = await request(app).post('/safety/backup').expect(200);
  assert.equal(backup.body.format, 'noctua-system');
  assert.equal(Buffer.from(backup.body.database, 'base64').subarray(0, 15).toString(), 'SQLite format 3');
  assert.ok(Buffer.from(backup.body.credentialKey, 'base64').length >= 32);
  assert.equal(backup.headers['cache-control'], 'no-store');
  const restoredFile = join(directory, 'restored.db');
  await writeFile(restoredFile, Buffer.from(backup.body.database, 'base64'));
  const restored = createSqliteClient(`file:${restoredFile.replace(/\\/g, '/')}`);
  try {
    assert.equal(await restored.contact.count(), 1);
    assert.equal(await restored.asset.count(), 1);
    assert.equal(
      Buffer.from((await restored.storedFile.findFirstOrThrow()).data).toString(),
      'Arquivo fictício de recuperação.',
    );
    assert.equal(
      (
        (await restored.operationRecord.findUniqueOrThrow({ where: { id: 'preferences:fictitious' } }))
          .data as { theme: string }
      ).theme,
      'light',
    );
    assert.equal(
      (
        (await restored.operationRecord.findUniqueOrThrow({ where: { id: 'ai-example:fictitious' } }))
          .data as { answer: string }
      ).answer,
      'Resposta fictícia',
    );
  } finally {
    await restored.$disconnect();
  }
  await request(app)
    .post('/safety/reset')
    .send({ confirmation: 'EXCLUIR', backupChoice: 'downloaded', backupId: backup.body.backupId })
    .expect(200);
  assert.equal(await db.contact.count(), 0);
  assert.equal(await db.asset.count(), 0);
  assert.equal(await db.whatsappSession.count(), 0);
  assert.equal(await db.operationRecord.count({ where: { kind: 'SYSTEM_BACKUP' } }), 1);
  assert.equal(await db.operationRecord.count({ where: { kind: 'ACCESS_KEY' } }), 1);
  assert.equal(await db.operationRecord.count({ where: { id: 'preferences:fictitious' } }), 0);
  assert.equal(await db.operationRecord.count({ where: { id: 'system:last-reset' } }), 1);
  assert.equal(disconnected, 1);
});
