import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createSqliteClient } from '../src/database/sqlite-client.js';
import { makeEventBuffer } from '@whiskeysockets/baileys';
import { LabelAssociationType } from '@whiskeysockets/baileys/lib/Types/LabelAssociation.js';
import { pino } from 'pino';
import request from 'supertest';
import type { WhatsappSocket } from '../src/modules/whatsapp/socket-factory.js';
import { WhatsappService } from '../src/modules/whatsapp/whatsapp.service.js';
import { CredentialCipher } from '../src/modules/whatsapp/credential-cipher.js';
import { silentPublisher } from '../src/modules/whatsapp/whatsapp.types.js';
import { CrmService } from '../src/modules/crm/crm.service.js';
import { LabelOutbox } from '../src/modules/whatsapp/label-outbox.js';
import { SyncService } from '../src/modules/whatsapp/sync.service.js';
import { createApp } from '../src/app.js';

class CrmSocket implements WhatsappSocket {
  ev = makeEventBuffer(pino({ level: 'silent' }));
  user = { id: '5511000000000@s.whatsapp.net' };
  fail = false;
  changes: { label: string; active: boolean }[] = [];
  async end() {}
  async logout() {}
  async profilePictureUrl() {
    return undefined;
  }
  async resyncAppState() {}
  async addChatLabel(_jid: string, label: string) {
    if (this.fail) throw new Error('Offline');
    this.changes.push({ label, active: true });
  }
  async removeChatLabel(_jid: string, label: string) {
    if (this.fail) throw new Error('Offline');
    this.changes.push({ label, active: false });
  }
}
const directory = await mkdtemp(join(tmpdir(), 'noctua-crm-'));
const url = `file:${join(directory, 'crm.db').replace(/\\/g, '/')}`;
const db = createSqliteClient(url);
const socket = new CrmSocket();
const whatsapp = new WhatsappService(
  db,
  new CredentialCipher(randomBytes(32)),
  silentPublisher,
  () => socket,
);
const crm = new CrmService(db, whatsapp);
const sync = new SyncService(db, silentPublisher);
let connected = false;
const notices: string[] = [];
const outbox = new LabelOutbox(
  db,
  () => (connected ? socket : undefined),
  (id) => notices.push(id),
);
let sessionId = '';
let otherSession = '';
let one = '';
let two = '';
let empty = '';
let contactId = '';
let origin = '';
let target = '';
const version = async (id: string) =>
  (await db.crmOpportunity.findUnique({ where: { conversationId: id } }))?.version ?? 0;
const move = async (
  conversationId: string,
  sourceLabelId: string | null,
  targetLabelId: string | null,
  beforeConversationId: string | null = null,
) =>
  crm.move(sessionId, {
    conversationId,
    sourceLabelId,
    targetLabelId,
    beforeConversationId,
    version: await version(conversationId),
  });
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
    { env: { ...process.env, RUST_LOG: 'info', DATABASE_URL: url }, stdio: 'pipe' },
  );
  sessionId = (await whatsapp.create('CRM simulado')).id;
  otherSession = (await whatsapp.create('Outra conta')).id;
  origin = `wa:${sessionId}:1`;
  target = `wa:${sessionId}:2`;
  await db.label.createMany({
    data: [
      { id: origin, sessionId, name: 'Novo contato', whatsappId: '1' },
      { id: target, sessionId, name: 'Proposta', whatsappId: '2' },
      { id: 'extra', sessionId, name: 'VIP' },
      { id: 'foreign', sessionId: otherSession, name: 'Privada' },
    ],
  });
  const make = async (name: string, phone: string, labelIds: string[]) => {
    const contact = await db.contact.create({
      data: {
        name,
        phoneNumber: phone,
        whatsappJid: `${phone}@s.whatsapp.net`,
        labels: { create: labelIds.map((labelId) => ({ labelId })) },
      },
    });
    const chat = await db.conversation.create({
      data: { sessionId, contactId: contact.id, lastMessageAt: new Date(), unreadCount: 1 },
    });
    return { contact, chat };
  };
  const first = await make('Cliente Um', '5511000000001', [origin, 'extra']);
  one = first.chat.id;
  contactId = first.contact.id;
  two = (await make('Cliente Dois', '5511000000002', [origin])).chat.id;
  empty = (await make('Cliente Sem Etiqueta', '5511000000003', [])).chat.id;
  await db.conversation.create({ data: { sessionId: otherSession, contactId } });
  const group = await db.contact.create({ data: { name: 'Grupo', phoneNumber: 'group:1', isGroup: true } });
  await db.conversation.create({ data: { sessionId, contactId: group.id } });
  await db.chatMessage.createMany({
    data: [
      { conversationId: one, direction: 'INBOUND', status: 'READ', text: 'Olá' },
      { conversationId: one, direction: 'OUTBOUND', status: 'SENT', text: 'Oi' },
      { conversationId: one, direction: 'OUTBOUND', status: 'FAILED', text: 'Falha' },
    ],
  });
});
after(async () => {
  await outbox.stop();
  await whatsapp.shutdown();
  await db.$disconnect();
  await rm(directory, { recursive: true, force: true });
});

test('quadro usa etiquetas por conexão, representa múltiplos vínculos e não duplica indicadores', async () => {
  const board = await crm.board(sessionId, {});
  assert.equal(board.total, 3);
  assert.ok(!board.columns.some((column) => column.id === 'foreign'));
  assert.ok(board.columns.find((column) => column.id === origin)!.conversationIds.includes(one));
  assert.deepEqual(board.columns.find((column) => column.id === 'extra')!.conversationIds, [one]);
  assert.deepEqual(board.columns.find((column) => column.id === 'unlabelled')!.conversationIds, [empty]);
  const metrics = await crm.metrics(sessionId, 30);
  assert.equal(metrics.contacts, 3);
  assert.equal(metrics.inbound, 1);
  assert.equal(metrics.outbound, 1);
  assert.equal(metrics.conversion, 0);
});

test('REQ-008: mover cartão no Kanban persiste a etapa sem enviar mensagens', async () => {
  await move(one, origin, target);
  assert.equal(socket.changes.length, 0);
  const links = (await db.contactLabel.findMany({ where: { contactId } })).map((link) => link.labelId);
  assert.deepEqual(new Set(links), new Set([target, 'extra']));
  const persistedBoard = await crm.board(sessionId, {});
  assert.ok(
    persistedBoard.columns.find((column) => column.id === target)!.conversationIds.includes(one),
    'REQ-008: o cartão movido aparece na etapa destino após nova leitura',
  );
  await outbox.flush();
  assert.equal(socket.changes.length, 0);
  assert.equal((await crm.board(sessionId, {})).pendingSync, 2);
  await sync.labelAssociation(sessionId, {
    type: 'add',
    association: { type: LabelAssociationType.Chat, labelId: '1', chatId: '5511000000001@s.whatsapp.net' },
  });
  assert.equal(await db.contactLabel.count({ where: { contactId, labelId: origin } }), 0);
  connected = true;
  await outbox.flush();
  assert.deepEqual(socket.changes, [
    { label: '2', active: true },
    { label: '1', active: false },
  ]);
  assert.equal((await crm.board(sessionId, {})).pendingSync, 0);
  assert.ok(notices.includes(sessionId));
});

test('fusão em etapa já vinculada não duplica cartão e Sem etiqueta não apaga outros vínculos', async () => {
  await assert.rejects(move(one, target, null), /outras etiquetas/);
  const before = await version(one);
  await move(one, target, 'extra');
  assert.equal(await version(one), before + 1);
  const board = await crm.board(sessionId, {});
  assert.equal(
    board.columns.find((column) => column.id === 'extra')!.conversationIds.filter((id) => id === one).length,
    1,
  );
  await move(one, 'extra', null);
  assert.ok((await crm.board(sessionId, {})).columns[0]!.conversationIds.includes(one));
});

test('ordem é persistida, versões antigas são recusadas e escopo da conexão é obrigatório', async () => {
  await move(empty, null, origin);
  await move(one, null, origin, two);
  const ordered = (await crm.board(sessionId, {})).columns.find(
    (column) => column.id === origin,
  )!.conversationIds;
  assert.ok(ordered.indexOf(one) < ordered.indexOf(two));
  const old = await version(one);
  await move(one, origin, origin, null);
  await assert.rejects(
    crm.move(sessionId, { conversationId: one, sourceLabelId: origin, targetLabelId: target, version: old }),
    /outra atualização/,
  );
  await assert.rejects(move(one, origin, 'foreign'), /indisponível/);
  await assert.rejects(
    crm.saveOpportunity(otherSession, two, { title: '', valueInCents: 0, status: 'WON', version: 0 }),
    /não encontrada/,
  );
});

test('ganhos e perdas calculam valores/conversão uma vez por negociação; reabrir limpa o resultado', async () => {
  const save = async (id: string, status: string, valueInCents: number) =>
    crm.saveOpportunity(sessionId, id, {
      title: 'Contrato',
      valueInCents,
      status,
      version: await version(id),
    });
  await save(one, 'WON', 25000);
  await save(two, 'LOST', 10000);
  let metrics = await crm.metrics(sessionId, 30);
  assert.equal(metrics.wonValueInCents, 25000);
  assert.equal(metrics.won, 1);
  assert.equal(metrics.lost, 1);
  assert.equal(metrics.conversion, 50);
  const wonAt = (await db.crmOpportunity.findUniqueOrThrow({ where: { conversationId: one } })).wonAt;
  await save(one, 'WON', 30000);
  assert.deepEqual(
    (await db.crmOpportunity.findUniqueOrThrow({ where: { conversationId: one } })).wonAt,
    wonAt,
  );
  await save(one, 'OPEN', 30000);
  metrics = await crm.metrics(sessionId, 30);
  assert.equal(metrics.wonValueInCents, 0);
  assert.equal(metrics.openValueInCents, 30000);
  assert.equal((await db.crmOpportunity.findUniqueOrThrow({ where: { conversationId: one } })).wonAt, null);
});

test('falhas de etiqueta ficam visíveis; nova intenção substitui trabalho antigo e pode ser repetida', async () => {
  await outbox.flush();
  socket.fail = true;
  await move(one, origin, target);
  await db.scheduledJob.updateMany({ where: { status: 'QUEUED' }, data: { maxAttempts: 1 } });
  await outbox.flush();
  assert.ok((await crm.board(sessionId, {})).failedSync > 0);
  assert.ok((await crm.retrySync(sessionId)).queued > 0);
  await move(one, target, origin);
  socket.fail = false;
  await outbox.flush();
  assert.equal((await crm.board(sessionId, {})).failedSync, 0);
  assert.equal(await db.contactLabel.count({ where: { contactId, labelId: target } }), 0);
  assert.equal(await db.contactLabel.count({ where: { contactId, labelId: origin } }), 1);
  assert.ok(await db.scheduledJob.count({ where: { type: 'WHATSAPP_SET_LABEL', status: 'CANCELLED' } }));
});

test('CRUD de etapas protege etiquetas vinculadas/importadas e API valida entradas e detalhes do contato', async () => {
  const app = createApp(db, whatsapp);
  const created = await request(app)
    .post(`/api/crm/sessions/${sessionId}/labels`)
    .send({ name: 'Retorno', color: '#aabbcc', description: 'Ligar amanhã' })
    .expect(201);
  await request(app)
    .put(`/api/crm/sessions/${sessionId}/labels/${encodeURIComponent(created.body.id)}`)
    .send({ name: 'Retorno agendado', color: '#aa99cc' })
    .expect(200);
  await request(app)
    .delete(`/api/crm/sessions/${sessionId}/labels/${encodeURIComponent(created.body.id)}`)
    .expect(200);
  await request(app)
    .delete(`/api/crm/sessions/${sessionId}/labels/${encodeURIComponent(origin)}`)
    .expect(409);
  await request(app)
    .get(`/api/crm/sessions/${sessionId}/board?search=Cliente%20Dois`)
    .expect(200)
    .then((response) => assert.equal(response.body.total, 1));
  await request(app).get(`/api/crm/sessions/${sessionId}/metrics?days=30`).expect(200);
  await request(app).get(`/api/crm/sessions/${sessionId}/metrics?days=999`).expect(422);
  await request(app).get(`/api/attendance/sessions/${otherSession}/conversations/${two}`).expect(404);
  await request(app).get(`/api/attendance/sessions/${sessionId}/conversations/${one}`).expect(200);
  await request(app)
    .put(`/api/crm/sessions/${sessionId}/opportunities/${one}`)
    .send({ title: '', valueInCents: -1, status: 'WON', version: await version(one) })
    .expect(422);
});

test('alteração no atendimento substitui uma sincronização pendente do quadro', async () => {
  connected = false;
  await move(one, origin, target);
  const app = createApp(db, whatsapp);
  await request(app)
    .put(`/api/attendance/sessions/${sessionId}/conversations/${one}/labels/${encodeURIComponent(target)}`)
    .send({ active: false })
    .expect(200);
  connected = true;
  socket.changes = [];
  await outbox.flush();
  assert.ok(!socket.changes.some((change) => change.label === '2' && change.active));
  assert.equal(await db.contactLabel.count({ where: { contactId, labelId: target } }), 0);
});
