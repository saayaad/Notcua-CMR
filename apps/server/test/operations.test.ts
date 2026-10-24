import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { makeEventBuffer, type AnyMessageContent, type WAMessage } from '@whiskeysockets/baileys';
import { pino } from 'pino';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { createApp } from '../src/app.js';
import type { WhatsappSocket } from '../src/modules/whatsapp/socket-factory.js';
import { WhatsappService } from '../src/modules/whatsapp/whatsapp.service.js';
import { CredentialCipher } from '../src/modules/whatsapp/credential-cipher.js';
import { silentPublisher } from '../src/modules/whatsapp/whatsapp.types.js';
import { MessagingService } from '../src/modules/attendance/messaging.service.js';
import { SequenceService } from '../src/modules/attendance/sequence.service.js';
import { DeliveryWorker, type Batch } from '../src/modules/operations/delivery.worker.js';
import { ContactsService } from '../src/modules/operations/contacts.service.js';
import { putRecord, record } from '../src/modules/operations/records.js';
import { BusinessWorker } from '../src/modules/operations/business.worker.js';
import { env } from '../src/config/env.js';
import { authorizeToken } from '../src/http/auth.js';
import { createSystemBackup } from '../src/modules/operations/system-backups.js';
import { AiWorker } from '../src/modules/operations/ai.worker.js';
import { FlowEngine } from '../src/modules/flows/flow.engine.js';
import { FlowService } from '../src/modules/flows/flow.service.js';
import { InactivityWorker } from '../src/modules/operations/inactivity.js';
class FakeSocket implements WhatsappSocket {
  ev = makeEventBuffer(pino({ level: 'silent' }));
  user = { id: '5511000000000@s.whatsapp.net' };
  sends: AnyMessageContent[] = [];
  async end() {}
  async logout() {}
  async profilePictureUrl() {
    return undefined;
  }
  async resyncAppState() {}
  async addChatLabel() {}
  async sendPresenceUpdate() {}
  async sendMessage(
    jid: string,
    content: AnyMessageContent,
    options?: { messageId?: string },
  ): Promise<WAMessage> {
    this.sends.push(content);
    return {
      key: { id: options?.messageId, remoteJid: jid, fromMe: true },
      message: { conversation: 'text' in content ? content.text : 'Mídia fictícia' },
    };
  }
}
const dir = await mkdtemp(join(tmpdir(), 'noctua-operations-'));
const url = `file:${join(dir, 'test.db').replace(/\\/g, '/')}`;
const db = new PrismaClient({ datasourceUrl: url });
const socket = new FakeSocket();
const whatsapp = new WhatsappService(
  db,
  new CredentialCipher(randomBytes(32)),
  silentPublisher,
  () => socket,
);
const messaging = new MessagingService(db, whatsapp);
const sequences = new SequenceService(db, whatsapp, messaging);
const worker = new DeliveryWorker(db, whatsapp, messaging, sequences);
const contacts = new ContactsService(db);
const app = createApp(db, whatsapp, sequences, messaging);
let sessionId = '';
let otherSession = '';
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
  sessionId = (await whatsapp.create('Operação fictícia')).id;
  otherSession = (await whatsapp.create('Outra operação')).id;
  await whatsapp.connect(sessionId);
  socket.ev.emit('connection.update', { connection: 'open' });
  await whatsapp.idle(sessionId);
});
after(async () => {
  await worker.stop();
  await sequences.stop();
  await whatsapp.shutdown();
  await db.$disconnect();
  await rm(dir, { recursive: true, force: true });
});
async function makeContact(phoneNumber: string, name = 'Contato Fictício') {
  await contacts.import(sessionId, { items: [{ name, phoneNumber, tags: ['Teste'] }] });
  return db.conversation.findFirstOrThrow({ where: { sessionId, contact: { phoneNumber } } });
}
async function draft(conversationIds: string[], delivery: object, mode = 'CAMPAIGN', runAt?: string) {
  const result = await request(app)
    .post(`/api/operations/sessions/${sessionId}/batches`)
    .send({
      name: 'Teste fictício',
      mode,
      audience: { conversationIds },
      delivery,
      minSeconds: 15,
      maxSeconds: 45,
      runAt,
    })
    .expect(201);
  return result.body as Batch & { id: string };
}
test('CSV detecta colunas, normaliza DDI, informa duplicados e não grava durante a prévia', async () => {
  const csv =
    'Nome;Telefone;Etiquetas\nAna;(11) 99999-0000;Leads\nAna repetida;(11) 99999-0000;Leads\nSem número;abc;Leads';
  const result = await contacts.preview({
    filename: 'leads.csv',
    base64: Buffer.from(csv).toString('base64'),
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]!.phoneNumber, '5511999990000');
  assert.equal(result.rejected.length, 2);
  assert.equal(await db.contact.count(), 0);
});
test('Excel com título antes do cabeçalho é reconhecido e a importação é idempotente', async () => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Leads');
  sheet.addRow(['Lista de interessados']);
  sheet.addRow(['Cliente', 'WhatsApp', 'tags']);
  sheet.addRow(['Beatriz', '5511888880000', 'Novos']);
  const result = await contacts.preview({
    filename: 'leads.xlsx',
    base64: Buffer.from(await book.xlsx.writeBuffer()).toString('base64'),
  });
  assert.equal(result.items[0]!.name, 'Beatriz');
  await contacts.import(sessionId, { items: result.items, extraTag: 'Outubro' });
  await contacts.import(sessionId, { items: result.items, extraTag: 'Outubro' });
  const person = await db.contact.findUniqueOrThrow({
    where: { phoneNumber: '5511888880000' },
    include: { labels: true },
  });
  assert.equal(person.labels.length, 2);
  assert.equal(await db.conversation.count({ where: { contactId: person.id, sessionId } }), 1);
  assert.equal(socket.sends.length, 0);
});
test('campanha começa em rascunho, congela recurso, respeita intervalo e não repete envio', async () => {
  const a = await makeContact('5511777770001');
  const b = await makeContact('5511777770002');
  await db.asset.create({ data: { id: 'op-text', name: 'Texto', kind: 'MESSAGE', text: 'Original #nome' } });
  const item = await draft([a.id, b.id], { kind: 'asset', assetId: 'op-text' });
  const before = socket.sends.length;
  await worker.flush();
  assert.equal(socket.sends.length, before);
  await db.asset.update({ where: { id: 'op-text' }, data: { text: 'Alterado' } });
  await request(app)
    .put(`/api/operations/sessions/${sessionId}/batches/${item.id}`)
    .send({ status: 'ACTIVE' })
    .expect(200);
  await worker.flush();
  await worker.flush();
  assert.equal(socket.sends.length, before + 1);
  assert.deepEqual(socket.sends.at(-1), { text: 'Original Contato Fictício' });
  const current = await record<Batch>(db, item.id, item);
  await putRecord(db, item.id, 'BATCH', { ...current, nextAllowedAt: new Date(0).toISOString() });
  await worker.flush();
  await worker.flush();
  assert.equal(socket.sends.length, before + 2);
  assert.equal((await record<Batch>(db, item.id, item)).status, 'COMPLETED');
});
test('agendamento futuro e cancelamento impedem envios e preservam escopo da conexão', async () => {
  const chat = await makeContact('5511777770003');
  const item = await draft(
    [chat.id],
    { kind: 'text', text: 'Agendado' },
    'SCHEDULE',
    new Date(Date.now() + 3600000).toISOString(),
  );
  await request(app)
    .put(`/api/operations/sessions/${sessionId}/batches/${item.id}`)
    .send({ status: 'ACTIVE' })
    .expect(200);
  const before = socket.sends.length;
  await worker.flush();
  assert.equal(socket.sends.length, before);
  await request(app)
    .put(`/api/operations/sessions/${otherSession}/batches/${item.id}`)
    .send({ status: 'ACTIVE' })
    .expect(404);
  await request(app)
    .put(`/api/operations/sessions/${sessionId}/batches/${item.id}`)
    .send({ status: 'CANCELLED' })
    .expect(200);
  await db.deliveryTask.updateMany({ where: { batchId: item.id }, data: { runAt: new Date(0) } });
  await worker.flush();
  assert.equal(socket.sends.length, before);
});
test('lembrete interno produz aviso sem enviar ao WhatsApp, inclusive em contato opt-out', async () => {
  const chat = await makeContact('5511777770004');
  const item = await draft([chat.id], { kind: 'reminder', text: 'Retornar ligação' }, 'REMINDER');
  await request(app)
    .put(`/api/operations/sessions/${sessionId}/batches/${item.id}`)
    .send({ status: 'ACTIVE' })
    .expect(200);
  await db.contact.update({ where: { id: chat.contactId }, data: { metadata: { optOut: true } } });
  const before = socket.sends.length;
  await worker.flush();
  assert.equal(socket.sends.length, before);
  assert.equal(await db.operationRecord.count({ where: { kind: 'NOTICE' } }), 1);
});
test('saída de campanha após seleção impede envio e finaliza o lote', async () => {
  const chat = await makeContact('5511777770005');
  const item = await draft([chat.id], { kind: 'text', text: 'Não deve sair' });
  await request(app)
    .put(`/api/operations/sessions/${sessionId}/batches/${item.id}`)
    .send({ status: 'ACTIVE' })
    .expect(200);
  await db.contact.update({ where: { id: chat.contactId }, data: { metadata: { optOut: true } } });
  const before = socket.sends.length;
  await worker.flush();
  assert.equal(socket.sends.length, before);
  assert.equal((await record<Batch>(db, item.id, item)).status, 'COMPLETED');
});
test('reinício marca envio incerto como falha e não o reenvia', async () => {
  const chat = await makeContact('5511777770006');
  const item = await draft([chat.id], { kind: 'text', text: 'Incerto' });
  await db.deliveryTask.updateMany({ where: { batchId: item.id }, data: { status: 'RUNNING' } });
  const restarted = new DeliveryWorker(db, whatsapp, messaging, sequences);
  const before = socket.sends.length;
  try {
    await restarted.start();
    await restarted.flush();
    assert.equal(socket.sends.length, before);
    assert.equal((await db.deliveryTask.findFirstOrThrow({ where: { batchId: item.id } })).status, 'FAILED');
  } finally {
    await restarted.stop();
  }
});
test('macros criadas executam texto, espera, etiqueta e atribuição em ordem', async () => {
  const chat = await makeContact('5511777770007');
  const label = await db.label.findFirstOrThrow({ where: { sessionId } });
  const result = await request(app)
    .post('/api/operations/macros')
    .send({
      name: 'Macro fictícia',
      actions: [
        { type: 'TEXT', text: 'Olá #nome', delayMs: 0, composingMs: 0 },
        { type: 'UTILITY', command: 'WAIT', delayMs: 0 },
        { type: 'ADD_LABEL', labelId: label.id, delayMs: 0 },
        { type: 'UTILITY', command: 'TRANSFER', target: 'operador@example.com', delayMs: 0 },
      ],
    })
    .expect(201);
  const before = socket.sends.length;
  await sequences.enqueue(sessionId, chat.id, 'MACRO', result.body.id, 'macro-operations-test');
  for (let i = 0; i < 5; i++) await sequences.flush();
  assert.equal(socket.sends.length, before + 1);
  assert.equal(
    (await db.contact.findUniqueOrThrow({ where: { id: chat.contactId } })).metadata &&
      (
        (await db.contact.findUniqueOrThrow({ where: { id: chat.contactId } })).metadata as {
          assignedTo: string;
        }
      ).assignedTo,
    'operador@example.com',
  );
  assert.equal(await db.contactLabel.count({ where: { contactId: chat.contactId, labelId: label.id } }), 1);
});
test('perfil e anotações são preservados e o histórico é exportado como ZIP', async () => {
  const chat = await makeContact('5511777770008');
  await request(app)
    .put(`/api/operations/sessions/${sessionId}/contacts/${chat.id}`)
    .send({ company: 'Fictícia', email: 'exemplo@example.com' })
    .expect(200);
  await request(app)
    .post(`/api/operations/sessions/${sessionId}/contacts/${chat.id}/notes`)
    .send({ text: 'Anotação fictícia.' })
    .expect(200);
  const contact = await db.contact.findUniqueOrThrow({ where: { id: chat.contactId } });
  assert.equal((contact.metadata as { company: string }).company, 'Fictícia');
  assert.equal((contact.metadata as { notes: unknown[] }).notes.length, 1);
  const exported = await request(app)
    .get(`/api/operations/sessions/${sessionId}/contacts/${chat.id}/export`)
    .buffer(true)
    .parse((res, callback) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => callback(null, Buffer.concat(chunks)));
    })
    .expect(200);
  assert.equal(exported.body.subarray(0, 2).toString(), 'PK');
  assert.match(exported.headers['content-disposition'] ?? '', /\.zip/);
  await request(app).get(`/api/operations/sessions/${otherSession}/contacts/${chat.id}/export`).expect(404);
});
test('encerramento automático não fecha conversa quando a última mensagem é do cliente', async () => {
  const a = await makeContact('5511777770009');
  const b = await makeContact('5511777770010');
  const at = new Date(Date.now() - 3600000);
  await db.conversation.updateMany({ where: { id: { in: [a.id, b.id] } }, data: { lastMessageAt: at } });
  await db.chatMessage.create({
    data: { conversationId: a.id, direction: 'OUTBOUND', text: 'Retorno', sentAt: at },
  });
  await db.chatMessage.create({
    data: { conversationId: b.id, direction: 'INBOUND', text: 'Ainda aguardo', sentAt: at },
  });
  await putRecord(db, 'settings:business', 'SETTINGS', { autoCloseMinutes: 10 });
  await new BusinessWorker(db, whatsapp).flush();
  assert.equal((await db.conversation.findUniqueOrThrow({ where: { id: a.id } })).status, 'CLOSED');
  assert.equal((await db.conversation.findUniqueOrThrow({ where: { id: b.id } })).status, 'OPEN');
});
test('Firebase rejeita ausência de token sem usar a liberação do modo local', async () => {
  const previous = env.AUTH_MODE;
  try {
    env.AUTH_MODE = 'firebase';
    await assert.rejects(authorizeToken(undefined), /Entre na sua conta/);
  } finally {
    env.AUTH_MODE = previous;
  }
});

test('credencial de IA fica cifrada, sugestão é supervisionada e automação não repete a resposta', async () => {
  const originalKeyFile = env.WHATSAPP_KEY_FILE;
  const originalFetch = globalThis.fetch;
  env.WHATSAPP_KEY_FILE = join(dir, 'test-ai.key');
  const chat = await makeContact('5511777770011');
  let providerCalls = 0;
  globalThis.fetch = async (_input, options) => {
    providerCalls++;
    const input = JSON.parse(String(options?.body));
    assert.equal(input.store, false);
    assert.match(input.instructions, /Não invente preços/);
    return new Response(
      JSON.stringify({
        output: [{ content: [{ type: 'output_text', text: 'Sugestão fictícia para revisão.' }] }],
        usage: { input_tokens: 20, output_tokens: 10 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };
  try {
    await request(app)
      .put('/api/operations/ai')
      .send({
        apiKey: 'key-ficticia-sem-acesso',
        model: 'modelo-ficticio',
        instructions: 'Seja claro.',
        knowledge: 'Preço de teste: R$ 10.',
        style: 'Cordial',
        enabled: false,
      })
      .expect(200);
    const stored = await db.operationRecord.findUniqueOrThrow({ where: { id: 'integration:ai' } });
    assert.ok(!JSON.stringify(stored.data).includes('key-ficticia-sem-acesso'));
    const exposed = await request(app).get('/api/operations/ai').expect(200);
    assert.equal(exposed.body.configured, true);
    assert.equal(exposed.body.encryptedKey, undefined);
    const before = socket.sends.length;
    await request(app)
      .post(`/api/operations/sessions/${sessionId}/contacts/${chat.id}/ai`)
      .send({ task: 'Sugira uma resposta.', consent: true })
      .expect(200);
    assert.equal(providerCalls, 1);
    assert.equal(socket.sends.length, before);
    await request(app)
      .put('/api/operations/ai')
      .send({
        model: 'modelo-ficticio',
        instructions: 'Seja claro.',
        knowledge: 'Teste',
        style: 'Cordial',
        enabled: true,
        dailyLimit: 2,
      })
      .expect(200);
    const incoming = await db.chatMessage.create({
      data: { conversationId: chat.id, direction: 'INBOUND', text: 'Quero saber mais.', sentAt: new Date() },
    });
    await db.flowInboxEvent.create({
      data: {
        messageId: incoming.id,
        conversationId: chat.id,
        receivedAt: new Date(),
        processedAt: new Date(),
        outcome: 'no-trigger',
      },
    });
    const ai = new AiWorker(db, whatsapp, messaging);
    await ai.flush();
    await ai.flush();
    await ai.stop();
    assert.equal(providerCalls, 2);
    assert.equal(socket.sends.length, before + 1);
  } finally {
    globalThis.fetch = originalFetch;
    env.WHATSAPP_KEY_FILE = originalKeyFile;
  }
});

test('backup integral usa snapshot consistente e inclui a chave sem expor caminhos na listagem', async () => {
  const previous = env.WHATSAPP_KEY_FILE;
  env.WHATSAPP_KEY_FILE = join(dir, 'backup-test.key');
  try {
    const backup = await createSystemBackup(db, join(dir, 'snapshots'));
    const snapshot = new PrismaClient({ datasourceUrl: `file:${backup.database.replace(/\\/g, '/')}` });
    try {
      assert.ok((await snapshot.contact.count()) > 0);
    } finally {
      await snapshot.$disconnect();
    }
    const response = await request(app).get('/api/operations/system-backups').expect(200);
    assert.ok(response.body.items.some((item: { id: string }) => item.id === backup.id));
    assert.equal(response.body.items[0].database, undefined);
    assert.equal(response.body.items[0].key, undefined);
    const download = await request(app)
      .get(`/api/operations/system-backups/${encodeURIComponent(backup.id)}/download`)
      .expect(200);
    assert.match(String(download.headers['content-disposition']), /\.zip/);
    await rm(backup.key);
    await request(app)
      .get(`/api/operations/system-backups/${encodeURIComponent(backup.id)}/download`)
      .expect(404);
  } finally {
    env.WHATSAPP_KEY_FILE = previous;
  }
});

test('fixação e atribuição persistem na conversa e o filtro Minhas respeita o responsável', async () => {
  const chat = await makeContact('5511777770012');
  await request(app)
    .put(`/api/operations/sessions/${sessionId}/contacts/${chat.id}`)
    .send({ pinned: true, assignedTo: 'local' })
    .expect(200);
  const listing = await request(app).get(`/api/attendance/sessions/${sessionId}/conversations`).expect(200);
  assert.equal(listing.body.items[0].id, chat.id);
  const mine = await request(app)
    .get(`/api/attendance/sessions/${sessionId}/conversations?filter=mine`)
    .expect(200);
  assert.equal(mine.body.total, 1);
  assert.equal(mine.body.items[0].id, chat.id);
});

test('distribuição por rodízio usa operadores ativos e respeita departamento', async () => {
  await putRecord(db, 'team:ana@example.com', 'TEAM', {
    email: 'ana@example.com',
    active: true,
    department: 'Especial',
  });
  await putRecord(db, 'team:beto@example.com', 'TEAM', {
    email: 'beto@example.com',
    active: true,
    department: 'Especial',
  });
  const a = await makeContact('5511777770013');
  const b = await makeContact('5511777770014');
  await db.contact.updateMany({
    where: { id: { in: [a.contactId, b.contactId] } },
    data: { metadata: { department: 'Especial' } },
  });
  await putRecord(db, 'settings:business', 'SETTINGS', { distribution: true });
  await new BusinessWorker(db, whatsapp).flush();
  const one = await db.conversation.findUniqueOrThrow({ where: { id: a.id } });
  const two = await db.conversation.findUniqueOrThrow({ where: { id: b.id } });
  assert.ok(one.assignedTo);
  assert.ok(two.assignedTo);
  assert.notEqual(one.assignedTo, two.assignedTo);
  await putRecord(db, 'settings:business', 'SETTINGS', {});
});

test('inatividade fica pausada até ativar, inicia uma vez e aceita agendamento de fluxo', async () => {
  const service = new FlowService(db, whatsapp);
  const engine = new FlowEngine(db, whatsapp, messaging);
  const flow = await service.create(sessionId, { name: 'Fluxo de retorno fictício' });
  const saved = await service.save(sessionId, flow.id, {
    name: flow.name,
    revision: flow.revision,
    graph: {
      nodes: [
        {
          id: 's',
          type: 'start',
          position: { x: 0, y: 0 },
          data: { triggerMode: 'manual', nextNodeIds: ['t'] },
        },
        {
          id: 't',
          type: 'text',
          position: { x: 300, y: 0 },
          data: { itemId: 'op-text', simulationDelay: 0 },
        },
      ],
    },
  });
  const published = await service.publish(sessionId, flow.id, { revision: saved.revision });
  await service.configure(sessionId, flow.id, { revision: published.revision, enabled: true });
  const chat = await makeContact('5511777770015');
  await db.conversation.update({
    where: { id: chat.id },
    data: { lastMessageAt: new Date(Date.now() - 86400000) },
  });
  await db.label.create({ data: { id: 'idle-only', sessionId, name: 'Retorno' } });
  await db.contactLabel.create({ data: { labelId: 'idle-only', contactId: chat.contactId } });
  const rule = await request(app)
    .post(`/api/operations/sessions/${sessionId}/inactivity-rules`)
    .send({ name: 'Retorno', flowId: flow.id, labelId: 'idle-only', inactiveMinutes: 60 })
    .expect(201);
  const idle = new InactivityWorker(db, engine, whatsapp);
  await idle.flush();
  assert.equal(await db.flowExecution.count({ where: { conversationId: chat.id } }), 0);
  await request(app)
    .put(`/api/operations/sessions/${sessionId}/inactivity-rules/${rule.body.id}`)
    .send({ enabled: true })
    .expect(200);
  await idle.flush();
  await idle.flush();
  assert.equal(await db.flowExecution.count({ where: { conversationId: chat.id } }), 1);
  await engine.flush();
  await idle.stop();
  const scheduledChat = await makeContact('5511777770016');
  const batch = await draft([scheduledChat.id], { kind: 'flow', flowId: flow.id }, 'SCHEDULE');
  await request(app)
    .put(`/api/operations/sessions/${sessionId}/batches/${batch.id}`)
    .send({ status: 'ACTIVE' })
    .expect(200);
  await worker.flush();
  assert.equal(await db.flowExecution.count({ where: { conversationId: scheduledChat.id } }), 1);
  await engine.stop();
});

test('editar macro importada preserva o arquivo original e suas opções', async () => {
  const file = await db.storedFile.create({
    data: {
      sha256: 'f'.repeat(64),
      filename: 'exemplo.pdf',
      mimeType: 'application/pdf',
      byteLength: 4,
      data: Buffer.from('%PDF'),
    },
  });
  const macro = await db.macro.create({
    data: {
      id: 'imported-macro',
      name: 'Importada',
      actions: {
        create: {
          position: 0,
          type: 'MEDIA',
          fileId: file.id,
          payload: { type: 'media', base64: 'JVBERg==', mimeType: 'application/pdf' },
        },
      },
    },
  });
  const loaded = await request(app).get(`/api/operations/macros/${macro.id}`).expect(200);
  assert.equal(loaded.body.actions[0].type, 'IMPORTED');
  await request(app)
    .put(`/api/operations/macros/${macro.id}`)
    .send({ name: 'Importada editada', actions: [{ ...loaded.body.actions[0], delayMs: 1000 }] })
    .expect(200);
  const action = await db.macroAction.findFirstOrThrow({ where: { macroId: macro.id } });
  assert.equal(action.fileId, file.id);
  assert.equal(action.waitMs, 1000);
});
