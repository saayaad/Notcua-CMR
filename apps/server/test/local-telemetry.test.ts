import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import express from 'express';
import request from 'supertest';
import { createSqliteClient } from '../src/database/sqlite-client.js';
import { env } from '../src/config/env.js';
import { errorHandler } from '../src/http/errors.js';
import { campaignRevenueRoutes } from '../src/modules/operations/campaign-revenue.js';
import { localTelemetryRoutes } from '../src/modules/operations/local-telemetry.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
await mkdir(join(root, '.audit/tmp'), { recursive: true });
const directory = await mkdtemp(join(root, '.audit/tmp/telemetry-'));
const url = `file:${join(directory, 'test.db').replace(/\\/g, '/')}`;
const db = createSqliteClient(url);
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.locals.identity = { role: req.header('x-audit-role') ?? 'ADMIN' };
  next();
});
app.use('/operations', campaignRevenueRoutes(db));
app.use('/telemetry', localTelemetryRoutes(db));
app.use(errorHandler);
let conversationId = '';
const endpoint = '/operations/sessions/audit-telemetry/batches/audit-campaign/revenue';
before(async () => {
  execFileSync(
    process.execPath,
    [
      join(root, 'node_modules/prisma/build/index.js'),
      'migrate',
      'deploy',
      '--schema',
      join(root, 'apps/server/prisma/schema.prisma'),
    ],
    { env: { ...process.env, RUST_LOG: 'info', DATABASE_URL: url }, stdio: 'pipe', windowsHide: true },
  );
  await db.whatsappSession.create({ data: { id: 'audit-telemetry', name: 'Telemetria fictícia' } });
  const contact = await db.contact.create({
    data: { name: 'Pessoa fictícia', phoneNumber: '5511000000001' },
  });
  const chat = await db.conversation.create({
    data: {
      sessionId: 'audit-telemetry',
      contactId: contact.id,
      opportunity: { create: { status: 'WON', valueInCents: 1000 } },
    },
  });
  conversationId = chat.id;
  await db.operationRecord.create({
    data: { id: 'audit-campaign', kind: 'BATCH', data: { sessionId: 'audit-telemetry', mode: 'CAMPAIGN' } },
  });
});
after(async () => {
  delete process.env.AUDIT_LOCAL_TELEMETRY;
  await db.$disconnect();
  await rm(directory, { recursive: true, force: true });
});

test('REQ-401: atribuição CRM gera eventos locais mínimos de sucesso/erro com duração e sem dados pessoais', async () => {
  process.env.AUDIT_LOCAL_TELEMETRY = '1';
  await request(app)
    .put(endpoint)
    .send({ conversationIds: [conversationId] })
    .expect(200);
  await request(app)
    .put(endpoint)
    .send({ conversationIds: ['foreign-conversation'] })
    .expect(422);
  await request(app).put(endpoint).set('x-audit-role', 'MEMBER').send({ conversationIds: [] }).expect(403);
  for (
    let i = 0;
    i < 100 && (await db.operationRecord.count({ where: { kind: 'AUDIT_LOCAL_TELEMETRY' } })) !== 3;
    i++
  )
    await new Promise((resolve) => setTimeout(resolve, 20));
  const read = await request(app).get('/telemetry').expect(200);
  assert.equal(read.body.items.length, 3);
  assert.equal(read.body.externalDestinations, 0);
  assert.deepEqual(read.body.items.map((item: { status: number }) => item.status).sort(), [200, 403, 422]);
  for (const event of read.body.items) {
    assert.deepEqual(Object.keys(event).sort(), [
      'category',
      'durationMs',
      'occurredAt',
      'result',
      'source',
      'status',
    ]);
    assert.equal(event.category, 'campaign.attribution');
    assert.equal(event.source, 'CRM');
    assert.ok(Number.isFinite(Date.parse(event.occurredAt)));
    assert.ok(Number.isFinite(event.durationMs) && event.durationMs >= 0);
    assert.equal(event.result, event.status === 200 ? 'SUCCESS' : 'ERROR');
    assert.ok(!JSON.stringify(event).includes(conversationId));
  }
  await request(app).get('/telemetry').set('x-audit-role', 'MEMBER').expect(403);
  const reopened = createSqliteClient(url);
  try {
    assert.equal(await reopened.operationRecord.count({ where: { kind: 'AUDIT_LOCAL_TELEMETRY' } }), 3);
  } finally {
    await reopened.$disconnect();
  }
  assert.equal(await db.chatMessage.count(), 0);
  const directory = join(process.env.AUDIT_EVIDENCE_ROOT ?? join(root, 'REVISAO/evidencias'), 'REQ-401');
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, 'local-telemetry.json'),
    JSON.stringify(
      {
        req: 'REQ-401',
        result: 'APROVADO-LOCAL-PARCIAL',
        events: read.body.items,
        persistenceReopened: true,
        externalDestinations: 0,
        remainingDecision:
          'Eventos CTWA/referral, destino/autenticação e contrato de webhook não especificados; nenhuma integração externa implementada.',
      },
      null,
      2,
    ),
  );
});

test('REQ-401: flag desativada e production não registram nem expõem telemetria', async () => {
  const before = await db.operationRecord.count({ where: { kind: 'AUDIT_LOCAL_TELEMETRY' } });
  delete process.env.AUDIT_LOCAL_TELEMETRY;
  await request(app)
    .put(endpoint)
    .send({ conversationIds: [conversationId] })
    .expect(200);
  await request(app).get('/telemetry').expect(403);
  const previous = env.NODE_ENV;
  try {
    env.NODE_ENV = 'production';
    process.env.AUDIT_LOCAL_TELEMETRY = '1';
    await request(app)
      .put(endpoint)
      .send({ conversationIds: [conversationId] })
      .expect(200);
    await request(app).get('/telemetry').expect(403);
  } finally {
    env.NODE_ENV = previous;
  }
  assert.equal(await db.operationRecord.count({ where: { kind: 'AUDIT_LOCAL_TELEMETRY' } }), before);
});
