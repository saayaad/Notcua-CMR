import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { BackupService } from '../src/modules/backups/backup.service.js';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { decodeBase64 } from '../src/modules/backups/validation.js';

const directory = await mkdtemp(join(tmpdir(), 'noctua-test-'));
const db = new PrismaClient({ datasourceUrl: `file:${join(directory, 'test.db').replace(/\\/g, '/')}` });
const copyDb = new PrismaClient({ datasourceUrl: `file:${join(directory, 'copy.db').replace(/\\/g, '/')}` });
const service = new BackupService(db);
const fixture = JSON.parse(
  await readFile(new URL('../../../examples/ZV_backup.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const prismaCli = fileURLToPath(new URL('../../../node_modules/prisma/build/index.js', import.meta.url));
const schema = fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url));

before(async () => {
  for (const filename of ['test.db', 'copy.db']) {
    execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy', '--schema', schema], {
      env: {
        ...process.env,
        RUST_LOG: 'info',
        DATABASE_URL: `file:${join(directory, filename).replace(/\\/g, '/')}`,
      },
      stdio: 'pipe',
    });
  }
  await db.$connect();
  await copyDb.$connect();
});
after(async () => {
  await db.$disconnect();
  await copyDb.$disconnect();
  await rm(directory, { recursive: true, force: true });
});

test('importa todos os módulos, decodifica mídia e converte segundos de macros', async () => {
  const report = await service.import(fixture, 'teste.json');
  assert.equal(report.duplicate, false);
  assert.deepEqual(report.counts, {
    assets: 2,
    files: 1,
    labels: 1,
    contacts: 1,
    macros: 1,
    funnels: 1,
    flows: 1,
  });
  const file = await db.storedFile.findFirstOrThrow();
  assert.equal(Buffer.from(file.data).toString(), 'Noctua');
  const action = await db.macroAction.findFirstOrThrow({ where: { type: 'TEXT' } });
  assert.equal(action.waitMs, 1000);
  assert.equal(action.composingMs, 2000);
  assert.equal((await db.flowNode.findMany()).length, 4);
  assert.deepEqual(
    (await db.importBatch.findUniqueOrThrow({ where: { id: report.batchId } })).payload,
    fixture,
  );
});

test('reimportação é idempotente mesmo com outra ordem das chaves', async () => {
  const reverse = Object.fromEntries(Object.entries(fixture).reverse());
  assert.equal((await service.import(reverse)).duplicate, true);
  assert.equal(await db.asset.count(), 2);
  assert.equal(await db.flowVersion.count(), 1);
});

test('referência inválida desfaz arquivos, etiquetas e ativos da transação', async () => {
  const counts = [
    await db.asset.count(),
    await db.storedFile.count(),
    await db.label.count(),
    await db.importBatch.count(),
  ];
  await assert.rejects(
    service.import({
      messages: [{ id: 'rollback', text: 'texto' }],
      labels: [{ id: 'rollback-label', name: 'Rollback' }],
      objectsList: [{ id: 'rollback-file', base64: 'YWJj' }],
      funnels: [{ id: 'bad', name: 'Falha', itemsSequence: [{ itemId: 'ausente', type: 'message' }] }],
    }),
    /ausente/,
  );
  assert.deepEqual(
    [
      await db.asset.count(),
      await db.storedFile.count(),
      await db.label.count(),
      await db.importBatch.count(),
    ],
    counts,
  );
});

test('exportação pode ser importada em outro banco preservando relações e bytes', async () => {
  const exported = JSON.parse(JSON.stringify(await service.export())) as unknown;
  const report = await new BackupService(copyDb).import(exported);
  assert.equal(report.counts.assets, 2);
  assert.equal(await copyDb.contactLabel.count(), 1);
  assert.equal(await copyDb.funnelItem.count(), 1);
  assert.equal(await copyDb.flowNode.count(), 4);
  assert.equal(Buffer.from((await copyDb.storedFile.findFirstOrThrow()).data).toString(), 'Noctua');
});

test('aceita macros isoladas como array e objectsList em mapa', async () => {
  const macro = { id: 'isolada', name: 'Isolada', acao: [{ type: 'txt', text: 'Oi' }] };
  assert.equal((await service.import([macro])).format, 'respostasRapidasAcao');
  const report = await service.import({
    ZV_backup: {
      docs: [{ id: 'doc-map', objectId: 'mapa' }],
      objectsList: { mapa: 'data:text/plain;base64,bWFwYQ==' },
    },
  });
  assert.equal(report.counts.files, 1);
});

test('rejeita Base64 inválido, IDs duplicados, nós órfãos e tipos incompatíveis', async () => {
  assert.throws(() => decodeBase64('%%invalido'), /Base64/);
  await assert.rejects(
    service.import({
      messages: [
        { id: 'dup', text: 'a' },
        { id: 'dup', text: 'b' },
      ],
    }),
    /duplicado/,
  );
  await assert.rejects(
    service.import({
      flows: [
        { id: 'bad-flow', name: 'Bad', nodes: [{ id: 'start', type: 'start', nextNodeIds: ['missing'] }] },
      ],
    }),
    /inexistente/,
  );
  await assert.rejects(
    service.import({
      funnels: [
        { id: 'bad-type', name: 'Bad', itemsSequence: [{ itemId: 'msg-boas-vindas', type: 'audio' }] },
      ],
    }),
    /incompatível/,
  );
});

test('HTTP: health, importação, exportação, original, mídia, erros e autenticação', async () => {
  const app = createApp(db);
  await request(app).get('/health').expect(200);
  const imported = await request(app).post('/api/backups/import').send(fixture).expect(200);
  assert.equal(imported.body.duplicate, true);
  await request(app).get('/api/backups/export').expect(200).expect('Content-Type', /json/);
  const original = await request(app)
    .get(`/api/backups/imports/${imported.body.batchId}/original`)
    .expect(200);
  assert.deepEqual(original.body, fixture);
  const file = await db.storedFile.findFirstOrThrow({ where: { mimeType: 'text/plain' } });
  await request(app)
    .get(`/api/files/${file.id}`)
    .expect(200)
    .expect('Content-Disposition', /attachment/);
  await request(app).post('/api/backups/import').send({ invalid: true }).expect(422);
  await request(app)
    .post('/api/backups/import')
    .set('Content-Type', 'application/json')
    .send('{bad')
    .expect(400);
  await request(app).get('/api/files/missing').expect(404);
  env.API_TOKEN = 'token-de-teste';
  try {
    await request(app).get('/api/backups/export').expect(401);
    await request(app).get('/api/backups/export').set('Authorization', 'Bearer token-de-teste').expect(200);
  } finally {
    env.API_TOKEN = '';
  }
});
