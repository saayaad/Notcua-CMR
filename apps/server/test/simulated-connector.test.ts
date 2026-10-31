import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import express from 'express';
import request from 'supertest';
import { createSqliteClient } from '../src/database/sqlite-client.js';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { SequenceService } from '../src/modules/attendance/sequence.service.js';
import { MessagingService } from '../src/modules/attendance/messaging.service.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
await mkdir(join(root, '.audit', 'tmp'), { recursive: true });
const directory = await mkdtemp(join(root, '.audit', 'tmp', 'simulated-connector-'));
const url = `file:${join(directory, 'test.db').replace(/\\/g, '/')}`;
const db = createSqliteClient(url);
const fakeWhatsapp = { snapshot: async () => ({}), notify() {}, connectedSocket: () => ({}) } as never;
const app = express();
app.use((req, res, next) => {
  if (req.header('x-audit-role'))
    res.locals.verifiedIdentity = {
      uid: 'audit-member',
      email: 'member@example.com',
      role: req.header('x-audit-role'),
      workspaceId: 'owner',
    };
  next();
});
app.use(createApp(db, fakeWhatsapp));
const sessionId = 'audit-connector-session';
const fixtures = [
  {
    req: 'REQ-461',
    action: {
      format: 'GROUP_INVITE',
      groupId: 'audit-group-exemplo',
      title: 'Grupo fictício',
      invitation: 'audit-invite-exemplo',
    },
  },
  { req: 'REQ-462', action: { format: 'VCARD', name: 'Pessoa Fictícia', phone: '5511000000001' } },
  {
    req: 'REQ-465',
    action: {
      format: 'INTERACTIVE_LIST',
      title: 'Opções fictícias',
      button: 'Escolher',
      rows: [
        { id: 'audit-1', title: 'Primeira opção' },
        { id: 'audit-2', title: 'Segunda opção' },
      ],
    },
  },
];

before(async () => {
  process.env.AUDIT_SIMULATED_CONNECTOR = '1';
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
  await db.whatsappSession.create({ data: { id: sessionId, name: 'Conector descartável fictício' } });
});
after(async () => {
  delete process.env.AUDIT_SIMULATED_CONNECTOR;
  await db.$disconnect();
  await rm(directory, { recursive: true, force: true });
});

for (const fixture of fixtures)
  test(`${fixture.req}: macro simulada valida formato, persiste, recusa duplicação conflitante e não envia`, async () => {
    const body = {
      name: fixture.req,
      actions: [{ type: 'SIMULATED', simulation: fixture.action, delayMs: 0 }],
    };
    const saved = await request(app).post('/api/operations/macros').send(body).expect(201);
    const read = await request(app)
      .get(`/api/operations/macros/${encodeURIComponent(saved.body.id)}`)
      .expect(200);
    assert.equal(read.body.actions[0].type, 'SIMULATED');
    assert.deepEqual(read.body.actions[0].simulation, fixture.action);
    const endpoint = `/api/operations/audit-connector/sessions/${sessionId}/macros/${encodeURIComponent(saved.body.id)}`;
    const requestId = `audit-${fixture.req}`;
    const result = await request(app).post(endpoint).send({ requestId }).expect(200);
    assert.equal(result.body.result, 'SIMULATED');
    assert.equal(result.body.externalMessages, 0);
    const payload = result.body.payloads[0];
    if (fixture.req === 'REQ-461')
      assert.equal(payload.groupInviteMessage.groupJid, 'audit-group-exemplo@g.us');
    if (fixture.req === 'REQ-462') {
      assert.match(payload.contacts.contacts[0].vcard, /^BEGIN:VCARD\r\nVERSION:3.0/);
      assert.match(payload.contacts.contacts[0].vcard, /TEL;TYPE=CELL;waid=5511000000001:\+5511000000001/);
    }
    if (fixture.req === 'REQ-465')
      assert.deepEqual(
        payload.listMessage.sections[0].rows.map((row: { rowId: string }) => row.rowId),
        ['audit-1', 'audit-2'],
      );
    const repeated = await request(app).post(endpoint).send({ requestId }).expect(200);
    assert.deepEqual(repeated.body, result.body);
    const reopened = createSqliteClient(url);
    try {
      const receipt = await reopened.operationRecord.findUniqueOrThrow({
        where: { id: `audit-connector:${sessionId}:${requestId}` },
      });
      assert.deepEqual(receipt.data, result.body);
    } finally {
      await reopened.$disconnect();
    }
    await request(app)
      .post(endpoint)
      .set('x-audit-role', 'MEMBER')
      .send({ requestId: 'audit-denied' })
      .expect(403);
    const malformed = {
      ...body,
      actions: [{ type: 'SIMULATED', simulation: { format: fixture.action.format } }],
    };
    await request(app)
      .put(`/api/operations/macros/${encodeURIComponent(saved.body.id)}`)
      .send(malformed)
      .expect(422);
    assert.deepEqual(
      (
        await request(app)
          .get(`/api/operations/macros/${encodeURIComponent(saved.body.id)}`)
          .expect(200)
      ).body.actions[0].simulation,
      fixture.action,
    );
    const changed = structuredClone(body);
    changed.actions[0]!.simulation = {
      ...fixture.action,
      ...(fixture.req === 'REQ-462' ? { name: 'Outra Pessoa' } : { title: 'Outro título' }),
    } as typeof fixture.action;
    await request(app)
      .put(`/api/operations/macros/${encodeURIComponent(saved.body.id)}`)
      .send(changed)
      .expect(200);
    await request(app).post(endpoint).send({ requestId }).expect(409);
    const evidence = join(root, 'REVISAO/evidencias', fixture.req);
    await mkdir(evidence, { recursive: true });
    await writeFile(
      join(evidence, 'simulated-connector.json'),
      JSON.stringify(
        {
          req: fixture.req,
          result: 'APROVADO-LOCAL',
          format: fixture.action.format,
          receipt: result.body,
          validations: [
            'schema',
            'reload-SQLite',
            'idempotency',
            'conflict-409',
            'member-403',
            'invalid-422-rollback',
          ],
          externalProof: 'Não comprova compatibilidade de aparelho/WhatsApp real.',
        },
        null,
        2,
      ),
    );
  });

test('REQ-461/462/465: formatos fictícios rejeitam dados reais, listas duplicadas e uso em produção', async () => {
  const create = (simulation: unknown) =>
    request(app)
      .post('/api/operations/macros')
      .send({ name: 'Inválida', actions: [{ type: 'SIMULATED', simulation }] });
  await create({ ...fixtures[0]!.action, invitation: 'token-real' }).expect(422);
  await create({ ...fixtures[1]!.action, phone: '5511999999999' }).expect(422);
  await create({
    ...fixtures[2]!.action,
    rows: [
      { id: 'same', title: 'A' },
      { id: 'same', title: 'B' },
    ],
  }).expect(422);
  const previous = env.NODE_ENV;
  try {
    env.NODE_ENV = 'production';
    assert.equal(
      (await request(app).get('/api/operations/audit-connector/capabilities')).body.simulated,
      false,
    );
    await create(fixtures[0]!.action).expect(403);
  } finally {
    env.NODE_ENV = previous;
  }
  delete process.env.AUDIT_SIMULATED_CONNECTOR;
  await create(fixtures[1]!.action).expect(403);
  process.env.AUDIT_SIMULATED_CONNECTOR = '1';
  assert.equal(await db.chatMessage.count(), 0);
  assert.equal(await db.whatsappAuthEntry.count(), 0);
});

test('REQ-461/462/465: execução normal da macro recusa o formato simulado antes de criar fila', async () => {
  const macro = await request(app)
    .post('/api/operations/macros')
    .send({ name: 'Somente local', actions: [{ type: 'SIMULATED', simulation: fixtures[0]!.action }] })
    .expect(201);
  const contact = await db.contact.create({
    data: {
      name: 'Pessoa fictícia',
      phoneNumber: '5511000000001',
      whatsappJid: '5511000000001@s.whatsapp.net',
    },
  });
  const conversation = await db.conversation.create({ data: { sessionId, contactId: contact.id } });
  const sequences = new SequenceService(db, fakeWhatsapp, new MessagingService(db, fakeWhatsapp));
  await assert.rejects(
    sequences.enqueue(sessionId, conversation.id, 'MACRO', macro.body.id, 'audit-normal-refused'),
    /conector de auditoria local/,
  );
  assert.equal(await db.sequenceRun.count(), 0);
});
