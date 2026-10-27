import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import express from 'express';
import request from 'supertest';
import { createSqliteClient } from '../src/database/sqlite-client.js';
import { toolboxRoutes } from '../src/modules/operations/toolbox.routes.js';
import { putRecord } from '../src/modules/operations/records.js';
import { errorHandler } from '../src/http/errors.js';

const directory = await mkdtemp(join(tmpdir(), 'noctua-transfer-review-'));
const url = `file:${join(directory, 'test.db').replace(/\\/g, '/')}`;
const db = createSqliteClient(url);
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  const actor = String(req.headers['x-test-actor'] || 'owner@example.com');
  res.locals.identity = {
    email: actor,
    uid: actor,
    role: actor === 'owner@example.com' ? 'ADMIN' : 'MEMBER',
  };
  next();
});
app.use('/tools', toolboxRoutes(db));
app.use(errorHandler);
let session = '',
  other = '';
const chat = async (sessionId = session) => {
  const contact = await db.contact.create({
    data: { name: 'Cliente fictício', phoneNumber: `5511999${Math.floor(Math.random() * 10000000)}` },
  });
  return db.conversation.create({ data: { contactId: contact.id, sessionId } });
};
const base = () => `/tools/sessions/${session}/transfers`;
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
  session = (await db.whatsappSession.create({ data: { name: 'Fictícia' } })).id;
  other = (await db.whatsappSession.create({ data: { name: 'Outra fictícia' } })).id;
  for (const [email, department] of [
    ['ana@example.com', 'Comercial'],
    ['beto@example.com', 'Financeiro'],
  ])
    await putRecord(db, `team:${email}`, 'TEAM', { email, department, active: true });
  await putRecord(db, 'settings:departments', 'SETTINGS', { items: [{ name: 'Comercial' }] });
});
after(async () => {
  await db.$disconnect();
  await rm(directory, { recursive: true, force: true });
});

test('somente destinatário aceita; aceite atribui responsável e não permite repetição', async () => {
  const conversation = await chat();
  const created = await request(app)
    .post(base())
    .send({ conversationId: conversation.id, target: 'ana@example.com', note: 'Nota fictícia' })
    .expect(201);
  const path = `${base()}/${created.body.id}`;
  await request(app)
    .put(path)
    .set('x-test-actor', 'beto@example.com')
    .send({ status: 'ACCEPTED' })
    .expect(403);
  await request(app)
    .put(path)
    .set('x-test-actor', 'ana@example.com')
    .send({ status: 'ACCEPTED' })
    .expect(200);
  assert.equal(
    (await db.conversation.findUniqueOrThrow({ where: { id: conversation.id } })).assignedTo,
    'ana@example.com',
  );
  await request(app)
    .put(path)
    .set('x-test-actor', 'ana@example.com')
    .send({ status: 'ACCEPTED' })
    .expect(409);
  const own = await request(app).get(base()).set('x-test-actor', 'ana@example.com').expect(200);
  assert.equal(own.body.items.find((r: { id: string }) => r.id === created.body.id).note, 'Nota fictícia');
  const stranger = await request(app).get(base()).set('x-test-actor', 'beto@example.com').expect(200);
  assert.equal(
    stranger.body.items.some((r: { id: string }) => r.id === created.body.id),
    false,
  );
});

test('fila permite aceite só do setor correto e recusa preserva responsável anterior', async () => {
  const conversation = await chat();
  const send = () =>
    request(app)
      .post(base())
      .send({
        conversationId: conversation.id,
        target: 'Comercial',
        targetType: 'DEPARTMENT',
        note: 'Setor fictício',
      });
  const created = await send().expect(201);
  await request(app)
    .put(`${base()}/${created.body.id}`)
    .set('x-test-actor', 'beto@example.com')
    .send({ status: 'ACCEPTED' })
    .expect(403);
  await request(app)
    .put(`${base()}/${created.body.id}`)
    .set('x-test-actor', 'ana@example.com')
    .send({ status: 'ACCEPTED' })
    .expect(200);
  assert.equal(
    (await db.conversation.findUniqueOrThrow({ where: { id: conversation.id } })).assignedTo,
    'ana@example.com',
  );
  const second = await send().expect(201);
  await request(app)
    .put(`${base()}/${second.body.id}`)
    .set('x-test-actor', 'ana@example.com')
    .send({ status: 'DECLINED' })
    .expect(200);
  assert.equal(
    (await db.conversation.findUniqueOrThrow({ where: { id: conversation.id } })).assignedTo,
    'ana@example.com',
  );
});

test('transferência rejeita conversa de outra conexão, alvo inexistente e pendência duplicada', async () => {
  const foreign = await chat(other);
  await request(app).post(base()).send({ conversationId: foreign.id, target: 'ana@example.com' }).expect(404);
  const conversation = await chat();
  await request(app)
    .post(base())
    .send({ conversationId: conversation.id, target: 'ausente@example.com' })
    .expect(422);
  await request(app)
    .post(base())
    .send({ conversationId: conversation.id, target: 'Setor inexistente', targetType: 'DEPARTMENT' })
    .expect(422);
  await request(app)
    .post(base())
    .send({ conversationId: conversation.id, target: 'ana@example.com' })
    .expect(201);
  await request(app)
    .post(base())
    .send({ conversationId: conversation.id, target: 'ana@example.com' })
    .expect(409);
});
