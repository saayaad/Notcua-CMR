import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { createSqliteClient } from '../src/database/sqlite-client.js';
import { makeEventBuffer, type AnyMessageContent, type WAMessage } from '@whiskeysockets/baileys';
import { pino } from 'pino';
import request from 'supertest';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
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
import { BackupService } from '../src/modules/backups/backup.service.js';
import { AiWorker } from '../src/modules/operations/ai.worker.js';
import { FlowEngine } from '../src/modules/flows/flow.engine.js';
import { FlowService } from '../src/modules/flows/flow.service.js';
import { InactivityWorker } from '../src/modules/operations/inactivity.js';
import { aiControl, requestsHuman, setAiControl } from '../src/modules/operations/ai-control.js';
import { generateSuggestion } from '../src/modules/operations/ai.service.js';
import { aiUsage, meteredCall, providerResponse } from '../src/modules/operations/ai-provider.js';
import { preprocessMedia } from '../src/modules/operations/ai-media.js';
import { SyncService } from '../src/modules/whatsapp/sync.service.js';
import { inflateRawSync } from 'node:zlib';
class FakeSocket implements WhatsappSocket {
  lookupCalls = 0;
  lookupFails = false;
  async onWhatsApp(...numbers: string[]) {
    this.lookupCalls++;
    if (this.lookupFails) throw new Error('Consulta indisponível');
    return numbers.filter(phone => phone.endsWith('1')).map(phone => ({ jid: `${phone}@s.whatsapp.net`, exists: true }));
  }
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
const db = createSqliteClient(url);
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
  // These fixtures explicitly represent an operation with AI tools enabled.
  await putRecord(db, 'settings:features', 'FEATURES', { aiEnabled: true });
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
test('validação consulta sem enviar, reutiliza cache, separa ausência de falha e isola conexão', async () => {
  const url = `/api/operations/sessions/${sessionId}/validate-numbers`;
  const sends = socket.sends.length;
  const before = socket.lookupCalls;
  const result = await request(app).post(url).send({ phoneNumbers: ['5511999990001', '5511999990002'] }).expect(200);
  assert.deepEqual(result.body.items.map((item: any) => item.status), ['REGISTERED', 'NOT_REGISTERED']);
  assert.equal(socket.lookupCalls, before + 2);
  const cached = await request(app).post(url).send({ phoneNumbers: ['5511999990001'] }).expect(200);
  assert.equal(cached.body.items[0].cached, true);
  assert.equal(socket.lookupCalls, before + 2);
  socket.lookupFails = true;
  try {
    const failed = await request(app).post(url).send({ phoneNumbers: ['5511999990003', '5511999990004'] }).expect(200);
    assert.equal(failed.body.items.length, 1);
    assert.equal(failed.body.items[0].status, 'UNKNOWN');
    assert.equal(failed.body.inconclusive, true);
  } finally { socket.lookupFails = false; }
  await request(app).post(`/api/operations/sessions/${otherSession}/validate-numbers`).send({ phoneNumbers: ['5511999990001'] }).expect(409);
  await request(app).post(url).send({ phoneNumbers: ['número inválido'] }).expect(422);
  assert.equal(socket.sends.length, sends);
});

test('XLS binário legado preserva nome acentuado, telefone numérico e linha de duplicata', async () => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ['Exportação antiga'], [], ['Telefone', 'Nome'],
    [5511999991234, 'João de teste'], ['+55 11 99999-1234', 'Duplicado'],
  ]), 'Contatos');
  const bytes = XLSX.write(book, { type: 'buffer', bookType: 'biff8' }) as Buffer;
  assert.equal(bytes.subarray(0, 4).toString('hex'), 'd0cf11e0');
  const preview = await contacts.preview({ filename: 'contatos.xls', base64: bytes.toString('base64') });
  assert.equal(preview.items.length, 1);
  assert.equal(preview.items[0]!.name, 'João de teste');
  assert.equal(preview.items[0]!.phoneNumber, '5511999991234');
  assert.equal(preview.rejected[0]!.row, 5);
});

test('CSV reconhece separador após título, ignora vírgulas entre aspas e informa linha original', async () => {
  const csv = 'Relatório de teste\nNome;Telefone;Observações\n"Cliente, teste";+55 11 99999-1234;Primeiro\nDuplicado;5511999991234;Segundo\n';
  const preview = await contacts.preview({ filename: 'irregular.csv', base64: Buffer.from(csv).toString('base64') });
  assert.equal(preview.items.length, 1);
  assert.equal(preview.items[0]!.name, 'Cliente, teste');
  assert.equal(preview.rejected[0]!.row, 4);
  const book = new ExcelJS.Workbook();
  book.addWorksheet('Vazia');
  const bytes = await book.xlsx.writeBuffer();
  await assert.rejects(() => contacts.preview({ filename: 'vazia.xlsx', base64: Buffer.from(bytes).toString('base64') }), /planilha está vazia/);
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
test('pós-envio remove etiqueta sem destino, preserva os outros vínculos e sincroniza uma única alteração', async () => {
  const chat = await makeContact('5511777770198');
  const source = await db.label.create({ data: {
    id: 'label:transition-source', name: 'Remover ao concluir', sessionId, whatsappId: '777',
  } });
  await db.contactLabel.create({ data: { contactId: chat.contactId, labelId: source.id } });
  const beforeLabels = await db.contactLabel.count({ where: { contactId: chat.contactId } });
  const batch = await draft([chat.id], {
    kind: 'text', text: 'Teste de remoção', labelTransition: { fromLabelId: source.id },
  });
  const tasks = await request(app).get(`/api/operations/sessions/${sessionId}/batches/${batch.id}/tasks`).expect(200);
  assert.equal(tasks.body.items[0].contact.phoneNumber, '5511777770198');
  const otherTasks = await request(app).get(`/api/operations/sessions/${otherSession}/batches/${batch.id}/tasks`).expect(200);
  assert.equal(otherTasks.body.items.length, 0);
  assert.ok(await db.contactLabel.findUnique({ where: {
    contactId_labelId: { contactId: chat.contactId, labelId: source.id },
  } }));
  await request(app).put(`/api/operations/sessions/${sessionId}/batches/${batch.id}`)
    .send({ status: 'ACTIVE' }).expect(200);
  const beforeSends = socket.sends.length;
  await worker.flush();
  await worker.flush();
  assert.equal(socket.sends.length, beforeSends + 1);
  assert.equal(await db.contactLabel.count({ where: { contactId: chat.contactId } }), beforeLabels - 1);
  assert.equal(await db.contactLabel.findUnique({ where: {
    contactId_labelId: { contactId: chat.contactId, labelId: source.id },
  } }), null);
  const jobs = await db.scheduledJob.findMany({ where: { type: 'WHATSAPP_SET_LABEL' } });
  const changes = jobs.filter((job) => {
    const data = job.payload as { contactId?: string; labelId?: string; active?: boolean };
    return data.contactId === chat.contactId && data.labelId === source.id && data.active === false;
  });
  assert.equal(changes.length, 1);
  const wrongScope = await db.label.create({ data: {
    id: 'label:transition-other-session', name: 'Outra conexão', sessionId: otherSession,
  } });
  for (const labelTransition of [{ fromLabelId: wrongScope.id }, {}]) {
    await request(app).post(`/api/operations/sessions/${sessionId}/batches`).send({
      name: 'Inválido', mode: 'SCHEDULE', audience: { conversationIds: [chat.id] },
      delivery: { kind: 'text', text: 'Não enviar', labelTransition },
    }).expect(422);
  }
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
test('fila ativa no servidor executa sem requisição do painel', async () => {
  const chat = await makeContact('5511777770098');
  const item = await draft([chat.id], { kind: 'text', text: 'Fila automática' });
  await request(app)
    .put(`/api/operations/sessions/${sessionId}/batches/${item.id}`)
    .send({ status: 'ACTIVE' })
    .expect(200);
  const automatic = new DeliveryWorker(db, whatsapp, messaging, sequences);
  const before = socket.sends.length;
  try {
    await automatic.start();
    const deadline = Date.now() + 5000;
    let status = '';
    while (Date.now() < deadline) {
      status = (await db.deliveryTask.findFirstOrThrow({ where: { batchId: item.id } })).status;
      if (status === 'COMPLETED') break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(socket.sends.length, before + 1);
    assert.equal(status, 'COMPLETED');
  } finally {
    await automatic.stop();
  }
});

test('macros criadas executam texto, espera, etiqueta e atribuição em ordem', async () => {
  const chat = await makeContact('5511777770007');
  const label = await db.label.findFirstOrThrow({ where: { sessionId } });
  const removedLabel = await db.label.create({
    data: { id: 'macro-remove-label-test', name: 'Etiqueta para remover', sessionId },
  });
  await db.contactLabel.create({ data: { contactId: chat.contactId, labelId: removedLabel.id } });
  const result = await request(app)
    .post('/api/operations/macros')
    .send({
      name: 'Macro fictícia',
      actions: [
        { type: 'TEXT', text: 'Olá #nome', delayMs: 0, composingMs: 0 },
        { type: 'UTILITY', command: 'WAIT', delayMs: 0 },
        { type: 'ADD_LABEL', labelId: label.id, delayMs: 0 },
        { type: 'REMOVE_LABEL', labelId: removedLabel.id, delayMs: 0 },
        { type: 'UTILITY', command: 'TRANSFER', target: 'operador@example.com', delayMs: 0 },
      ],
    })
    .expect(201);
  const before = socket.sends.length;
  await sequences.enqueue(sessionId, chat.id, 'MACRO', result.body.id, 'macro-operations-test');
  for (let i = 0; i < 6; i++) await sequences.flush();
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
  assert.equal(await db.contactLabel.count({ where: { contactId: chat.contactId, labelId: removedLabel.id } }), 0);
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

test('chaves Gemini permitem cadastrar, editar, ordenar, desativar e excluir sem expor os valores', async () => {
  const previous = await db.operationRecord.findUnique({ where: { id: 'integration:ai' } });
  const previousKeyFile = env.WHATSAPP_KEY_FILE;
  env.WHATSAPP_KEY_FILE = join(dir, 'keys-manager-test.key');
  const primary = 'test-gemini-primary-not-real-0001';
  const replacement = 'test-gemini-replacement-not-real-0002';
  try {
    await putRecord(db, 'integration:ai', 'INTEGRATION', {
      provider: 'gemini', model: 'mock-model', instructions: '', knowledge: '', style: '', enabled: false,
    });
    await request(app).put('/api/operations/ai/keys/primary').send({ apiKey: primary }).expect(200);
    const first = await request(app).post('/api/operations/ai/keys').send({ label: 'Chave A', apiKey: primary }).expect(201);
    const second = await request(app).post('/api/operations/ai/keys').send({ label: 'Chave B', apiKey: replacement }).expect(201);
    await putRecord(db, `ai-key-quota:${first.body.id}`, 'STATE', { until: Date.now() + 60000 });
    await request(app).put(`/api/operations/ai/keys/${first.body.id}`).send({ label: 'Chave A editada', apiKey: replacement }).expect(200);
    assert.equal(await db.operationRecord.findUnique({ where: { id: `ai-key-quota:${first.body.id}` } }), null);
    await request(app).put('/api/operations/ai/keys/order').send({ ids: [second.body.id, first.body.id] }).expect(200);
    await request(app).put('/api/operations/ai/keys/order').send({ ids: [first.body.id, first.body.id] }).expect(422);
    await request(app).patch(`/api/operations/ai/keys/${first.body.id}`).send({ enabled: false }).expect(200);
    const listing = await request(app).get('/api/operations/ai/keys').expect(200);
    assert.deepEqual(listing.body.items.map((item: { id: string }) => item.id), [second.body.id, first.body.id]);
    assert.equal(listing.body.items[1].label, 'Chave A editada');
    assert.equal(listing.body.items[1].enabled, false);
    assert.equal(listing.body.primary.configured, true);
    assert.ok(!JSON.stringify(listing.body).includes(primary));
    assert.ok(!JSON.stringify(listing.body).includes(replacement));
    const stored = await db.operationRecord.findUniqueOrThrow({ where: { id: 'integration:ai' } });
    assert.ok(!JSON.stringify(stored.data).includes(primary));
    assert.ok(!JSON.stringify(stored.data).includes(replacement));
    const removal = await request(app).delete('/api/operations/ai/keys/primary').expect(200);
    assert.equal(removal.body.hasOtherActiveKey, true);
    for (const keyId of [first.body.id, second.body.id])
      await request(app).delete(`/api/operations/ai/keys/${keyId}`).expect(200);
    const empty = await request(app).get('/api/operations/ai/keys').expect(200);
    assert.equal(empty.body.items.length, 0);
    assert.equal(empty.body.primary.configured, false);
  } finally {
    env.WHATSAPP_KEY_FILE = previousKeyFile;
    if (previous) await putRecord(db, previous.id, previous.kind, previous.data);
    else await db.operationRecord.deleteMany({ where: { id: 'integration:ai' } });
  }
});

test('modelos de marca d’água validam tamanho, posição, selo local e modelo ativo', async () => {
  const value = { enabledByDefault: false, activeId: 'marca-teste', marks: [{ id: 'marca-teste', name: 'Teste', text: 'Amostra', opacity: 42, position: 'center' }] };
  const result = await request(app).put('/api/operations/settings/watermarks').send(value).expect(200);
  assert.equal(result.body.marks[0].size, 100);
  await request(app).put('/api/operations/settings/watermarks').send({ ...value, activeId: 'inexistente' }).expect(422);
  await request(app).put('/api/operations/settings/watermarks').send({ ...value, marks: [{ ...value.marks[0], size: 999 }] }).expect(422);
  await request(app).put('/api/operations/settings/watermarks').send({ ...value, marks: [{ ...value.marks[0], imageData: 'https://externo.example/selo.png' }] }).expect(422);
});

test('catálogo Gemini pagina, filtra modelos de geração e rejeita número de projeto como modelo', async () => {
  const originalKeyFile = env.WHATSAPP_KEY_FILE;
  const originalFetch = globalThis.fetch;
  const previous = await db.operationRecord.findUnique({ where: { id: 'integration:ai' } });
  env.WHATSAPP_KEY_FILE = join(dir, 'models-test.key');
  try {
    const body = { provider: 'gemini', apiKey: 'fake-catalog-key', model: 'models/gemini-test', instructions: '', knowledge: '', style: '', enabled: false };
    await request(app).put('/api/operations/ai').send({ ...body, model: '1355654808' }).expect(422);
    await request(app).put('/api/operations/ai').send(body).expect(200);
    const saved = await request(app).get('/api/operations/ai').expect(200);
    assert.equal(saved.body.model, 'gemini-test');
    let calls = 0;
    globalThis.fetch = async (input, options) => {
      const url = new URL(String(input));
      assert.equal(url.hostname, 'generativelanguage.googleapis.com');
      assert.equal(new Headers(options?.headers).get('x-goog-api-key'), 'fake-catalog-key');
      calls++;
      const data = calls === 1 ? {
        models: [
          { name: 'models/gemini-test', displayName: 'Gemini teste', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/embedding-test', supportedGenerationMethods: ['embedContent'] },
        ], nextPageToken: 'pagina2',
      } : { models: [{ name: 'models/gemini-test-fast', supportedGenerationMethods: ['generateContent'] }] };
      if (calls === 2) assert.equal(url.searchParams.get('pageToken'), 'pagina2');
      return new Response(JSON.stringify(data), { status: 200 });
    };
    const result = await request(app).get('/api/operations/ai/models').expect(200);
    assert.equal(calls, 2);
    assert.deepEqual(result.body.models.map((model: { id: string }) => model.id), ['gemini-test', 'gemini-test-fast']);
    assert.ok(!JSON.stringify(result.body).includes('fake-catalog-key'));
  } finally {
    globalThis.fetch = originalFetch;
    env.WHATSAPP_KEY_FILE = originalKeyFile;
    if (previous) await db.operationRecord.upsert({ where: { id: previous.id }, create: { ...previous, data: previous.data! }, update: { data: previous.data! } });
    else await db.operationRecord.deleteMany({ where: { id: 'integration:ai' } });
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
  const pinned=listing.body.items.find((item:{id:string})=>item.id===chat.id);
  assert.equal(pinned?.pinned,true);
  assert.equal(pinned?.assignedTo,'local');
  const mine = await request(app)
    .get(`/api/attendance/sessions/${sessionId}/conversations?filter=mine`)
    .expect(200);
  assert.equal(mine.body.total, 1);
  assert.equal(mine.body.items[0].id, chat.id);
});

test('distribuição por rodízio usa operadores ativos e online e respeita departamento', async () => {
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
  await putRecord(db, 'team:offline@example.com', 'TEAM', {
    email: 'offline@example.com', active: true, department: 'Especial',
  });
  for (const email of ['ana@example.com', 'beto@example.com']) {
    await putRecord(db, `presence:${email}`, 'TEAM_PRESENCE', {
      email, seenAt: new Date().toISOString(),
    });
  }
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
  assert.ok(['ana@example.com', 'beto@example.com'].includes(one.assignedTo));
  assert.ok(['ana@example.com', 'beto@example.com'].includes(two.assignedTo));
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
test('importação extrai telefone misturado com texto, exige DDD e cria lista segmentável', async () => {
  const preview = await contacts.preview({
    filename: 'irregular.csv',
    areaCode: '11',
    base64: Buffer.from(
      'Nome;WhatsApp\nAna;Whats: (11) 98888-1122\nBia;98888-1123\nDuas opções;11988881124 / 11988881125',
    ).toString('base64'),
  });
  assert.equal(preview.items.length, 2);
  assert.equal(preview.items[1]!.phoneNumber, '5511988881123');
  const withoutArea = await contacts.preview({
    filename: 'local.csv',
    base64: Buffer.from('Nome;Telefone\nBia;98888-1123').toString('base64'),
  });
  assert.equal(withoutArea.items.length, 0);
  const imported = await contacts.import(sessionId, {
    items: preview.items,
    listName: 'Lista fictícia',
    extraTag: 'Lista teste nova',
  });
  const list = await record<{ conversationIds: string[] }>(db, imported.listId!, { conversationIds: [] });
  const label = await db.label.findFirstOrThrow({ where: { name: 'Lista teste nova', sessionId } });
  await db.conversation.update({
    where: { id: list.conversationIds[0]! },
    data: { lastMessageAt: new Date() },
  });
  const and = await request(app)
    .post(`/api/operations/sessions/${sessionId}/audience`)
    .send({ listId: imported.listId, labelId: label.id, inactiveDays: 10, match: 'AND' })
    .expect(200);
  const or = await request(app)
    .post(`/api/operations/sessions/${sessionId}/audience`)
    .send({ listId: imported.listId, labelId: label.id, inactiveDays: 10, match: 'OR' })
    .expect(200);
  assert.equal(and.body.count, 1);
  assert.equal(or.body.count, 2);
  await request(app)
    .post(`/api/operations/sessions/${otherSession}/audience`)
    .send({ listId: imported.listId })
    .expect(404);
});

test('público combina várias listas e etiquetas com inatividade e seleção manual', async () => {
  const first = await makeContact('5511888810001', 'Público A');
  const second = await makeContact('5511888810002', 'Público B');
  const third = await makeContact('5511888810003', 'Público C');
  const firstLabel = await db.label.create({ data: { id: 'audience-label-a', sessionId, name: 'Público A' } });
  const secondLabel = await db.label.create({ data: { id: 'audience-label-b', sessionId, name: 'Público B' } });
  await db.contactLabel.createMany({ data: [
    { contactId: first.contactId, labelId: firstLabel.id },
    { contactId: second.contactId, labelId: secondLabel.id },
  ] });
  await db.conversation.updateMany({
    where: { id: { in: [first.id, third.id] } },
    data: { lastMessageAt: new Date(Date.now() - 12 * 86400000) },
  });
  await db.conversation.update({
    where: { id: second.id }, data: { lastMessageAt: new Date() },
  });
  const listIds = ['lead-list:audience-a', 'lead-list:audience-b'];
  await putRecord(db, listIds[0]!, 'LEAD_LIST', { sessionId, conversationIds: [first.id] });
  await putRecord(db, listIds[1]!, 'LEAD_LIST', { sessionId, conversationIds: [second.id, third.id] });
  const base = { listIds, labelIds: [firstLabel.id, secondLabel.id], inactiveDays: 10 };
  const url = `/api/operations/sessions/${sessionId}/audience`;
  const and = await request(app).post(url).send({ ...base, match: 'AND' }).expect(200);
  assert.deepEqual(and.body.items.map((item: { id: string }) => item.id), [first.id]);
  const or = await request(app).post(url).send({ ...base, match: 'OR' }).expect(200);
  assert.equal(or.body.count, 3);
  const selected = await request(app).post(url).send({ ...base, match: 'OR', conversationIds: [second.id] }).expect(200);
  assert.deepEqual(selected.body.items.map((item: { id: string }) => item.id), [second.id]);
});

test('sequência de campanha congela recursos, preserva ordem e aplica pausa por lote', async () => {
  const chat = await makeContact('5511777770031', 'Pessoa Sequência');
  const asset = await db.asset.create({
    data: { id: 'sequence-frozen', name: 'Segunda', kind: 'MESSAGE', text: 'Segundo original' },
  });
  const created = await request(app)
    .post(`/api/operations/sessions/${sessionId}/batches`)
    .send({
      name: 'Sequência fictícia',
      mode: 'CAMPAIGN',
      audience: { conversationIds: [chat.id] },
      delivery: {
        kind: 'sequence',
        steps: [
          { kind: 'text', text: '{{saudacao}}, {{nome}}!', waitSeconds: 0 },
          { kind: 'asset', assetId: asset.id, waitSeconds: 0 },
          { kind: 'text', text: 'Terceiro', waitSeconds: 0 },
        ],
      },
      minSeconds: 1,
      maxSeconds: 1,
      pauseEvery: 2,
      pauseSeconds: 300,
    })
    .expect(201);
  await db.asset.update({ where: { id: asset.id }, data: { text: 'Mudança posterior' } });
  const batchId = created.body.id as string;
  await request(app)
    .put(`/api/operations/sessions/${sessionId}/batches/${batchId}`)
    .send({ status: 'ACTIVE' })
    .expect(200);
  const before = socket.sends.length;
  await worker.flush();
  await worker.flush();
  assert.equal(socket.sends.length, before + 1);
  assert.match(
    (socket.sends.at(-1) as { text: string }).text,
    /^(Bom dia|Boa tarde|Boa noite), Pessoa Sequência!$/,
  );
  let batch = await record<Batch>(db, batchId, created.body);
  await putRecord(db, batchId, 'BATCH', { ...batch, nextAllowedAt: new Date(0).toISOString() });
  await worker.flush();
  assert.equal((socket.sends.at(-1) as { text: string }).text, 'Segundo original');
  batch = await record<Batch>(db, batchId, created.body);
  assert.ok(new Date(batch.nextAllowedAt!).getTime() > Date.now() + 295000);
  assert.equal(batch.sentCount, 2);
  await putRecord(db, batchId, 'BATCH', { ...batch, nextAllowedAt: new Date(0).toISOString() });
  await worker.flush();
  assert.equal((socket.sends.at(-1) as { text: string }).text, 'Terceiro');
  assert.equal((await record<Batch>(db, batchId, created.body)).status, 'COMPLETED');
});

async function aiTest(run: () => Promise<void>) {
  const keyFile = env.WHATSAPP_KEY_FILE;
  const fetch = globalThis.fetch;
  env.WHATSAPP_KEY_FILE = join(dir, 'extended-ai.key');
  try {
    await run();
  } finally {
    globalThis.fetch = fetch;
    env.WHATSAPP_KEY_FILE = keyFile;
    await putRecord(db, 'integration:ai', 'INTEGRATION', { enabled: false });
  }
}
async function configureAi(extra: object = {}) {
  await request(app)
    .put('/api/operations/ai')
    .send({
      apiKey: 'chave-ficticia',
      provider: 'openai',
      model: 'modelo-ficticio',
      instructions: 'Não inventar preços.',
      knowledge: 'Exemplo',
      style: 'Cordial',
      enabled: false,
      dailyLimit: 5000,
      ...extra,
    })
    .expect(200);
}
async function inbound(chatId: string, text: string) {
  const message = await db.chatMessage.create({
    data: { conversationId: chatId, direction: 'INBOUND', text, sentAt: new Date() },
  });
  await db.flowInboxEvent.create({
    data: {
      messageId: message.id,
      conversationId: chatId,
      receivedAt: new Date(),
      processedAt: new Date(),
      outcome: 'no-trigger',
    },
  });
  return message;
}

test('assumir durante geração impede envio da IA e mantém pausa após mensagem manual', async () =>
  aiTest(async () => {
    const chat = await makeContact('5511777770032');
    await configureAi({ enabled: true });
    const message = await inbound(chat.id, 'Qual o próximo passo?');
    globalThis.fetch = async () => {
      await request(app)
        .post(`/api/attendance/sessions/${sessionId}/conversations/${chat.id}/send`)
        .send({ kind: 'text', text: 'Sou o atendente humano.', requestId: 'manual-during-ai' })
        .expect(201);
      return new Response(
        JSON.stringify({
          output: [{ content: [{ type: 'output_text', text: 'Não deve enviar' }] }],
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      );
    };
    const before = socket.sends.length;
    const ai = new AiWorker(db, whatsapp, messaging);
    await ai.flush();
    await ai.stop();
    assert.equal(socket.sends.length, before + 1);
    assert.equal((await aiControl(db, chat.id)).paused, true);
    assert.equal(
      (await record<{ status: string }>(db, `ai-run:${message.id}`, { status: '' })).status,
      'HELD',
    );
  }));

test('pedido por humano e mensagem pelo celular pausam a IA; histórico antigo não pausa', async () => {
  assert.equal(requestsHuman('Gostaria de falar com uma pessoa'), true);
  assert.equal(requestsHuman('Quero saber os preços'), false);
  const sync = new SyncService(db, silentPublisher);
  const chat = await makeContact('5511777770033');
  const jid = '5511777770033@s.whatsapp.net';
  await sync.messagesUpsert(
    sessionId,
    [
      {
        key: { id: 'human-old', remoteJid: jid, fromMe: true },
        message: { conversation: 'Mensagem antiga' },
        messageTimestamp: Math.floor(Date.now() / 1000),
      },
    ],
    false,
  );
  assert.equal((await aiControl(db, chat.id)).paused, false);
  await sync.messagesUpsert(
    sessionId,
    [
      {
        key: { id: 'human-request', remoteJid: jid, fromMe: false },
        message: { conversation: 'Quero falar com um atendente' },
        messageTimestamp: Math.floor(Date.now() / 1000),
      },
    ],
    true,
  );
  assert.equal((await aiControl(db, chat.id)).paused, true);
  await setAiControl(db, chat.id, false, 'Retomada');
  await sync.messagesUpsert(
    sessionId,
    [
      {
        key: { id: 'human-mobile', remoteJid: jid, fromMe: true },
        message: { conversation: 'Eu assumo' },
        messageTimestamp: Math.floor(Date.now() / 1000),
      },
    ],
    true,
  );
  assert.equal((await aiControl(db, chat.id)).paused, true);
});

test('provedores Claude e Gemini contabilizam tokens e limites bloqueiam antes da chamada', async () =>
  aiTest(async () => {
    const chat = await makeContact('5511777770034');
    let calls = 0;
    for (const provider of ['anthropic', 'gemini']) {
      await configureAi({ provider });
      globalThis.fetch = async (url, options) => {
        calls++;
        const body = JSON.parse(String(options?.body));
        assert.equal(String(url).includes('chave-ficticia'), false);
        if (provider === 'anthropic') {
          assert.equal(body.messages[0].role, 'user');
          return new Response(
            JSON.stringify({
              content: [{ type: 'text', text: 'Claude fictício' }],
              usage: { input_tokens: 12, output_tokens: 8 },
            }),
          );
        }
        assert.ok(body.systemInstruction);
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: 'Gemini fictício' }] } }],
            usageMetadata: { promptTokenCount: 14, candidatesTokenCount: 6, thoughtsTokenCount: 2 },
          }),
        );
      };
      const result = await generateSuggestion(db, chat.id, 'Sugira.');
      assert.match(result.text, /fictício/);
    }
    assert.equal(calls, 2);
    const usage = await aiUsage(db);
    assert.ok(usage.todayTokens >= 42);
    await configureAi({ dailyTokenLimit: 1 });
    await assert.rejects(generateSuggestion(db, chat.id, 'Sugira.'), /Limite diário/);
    assert.equal(calls, 2);
    await configureAi({ monthlyBudget: 0.000001, inputPrice: 1, outputPrice: 1 });
    await assert.rejects(generateSuggestion(db, chat.id, 'Sugira.'), /Orçamento mensal/);
    assert.equal(calls, 2);
  }));

test('cache de IA exige revisão e impede reutilizar nome de outro cliente', async () =>
  aiTest(async () => {
    await configureAi();
    const first = await makeContact('5511777770061', 'Joana Exemplo');
    const second = await makeContact('5511777770062', 'Pedro Exemplo');
    const third = await makeContact('5511777770063', 'Ana Exemplo');
    for (const chat of [first, second, third])
      await db.chatMessage.create({ data: { conversationId: chat.id, direction: 'INBOUND', text: 'Como funciona mascote?', sentAt: new Date() } });
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return new Response(JSON.stringify({
        output: [{ content: [{ type: 'output_text', text: calls === 1 ? 'Oi, Joana! Podemos conversar sobre o mascote.' : 'Resposta nova.' }] }],
        usage: { input_tokens: 12, output_tokens: 8 },
      }));
    };
    const task = 'Responda à última mensagem do cliente.';
    const wasCached = (result: Awaited<ReturnType<typeof generateSuggestion>>) => 'cached' in result && result.cached === true;
    assert.equal(wasCached(await generateSuggestion(db, first.id, task)), false);
    assert.equal(wasCached(await generateSuggestion(db, second.id, task)), false);
    assert.equal(calls, 2);
    const cache = await request(app).get('/api/operations/economy/cache').expect(200);
    const entry = cache.body.items.find((item: { sourceConversationId?: string }) => item.sourceConversationId === first.id);
    assert.ok(entry);
    assert.equal(entry.approvedAt, undefined);
    await request(app).put(`/api/operations/economy/cache/${entry.id}`)
      .send({ answer: 'Oi, Joana! Podemos conversar sobre o mascote.', approve: true }).expect(422);
    await request(app).put(`/api/operations/economy/cache/${entry.id}`)
      .send({ answer: 'Podemos conversar sobre o mascote.', approve: true }).expect(200);
    const reused = await generateSuggestion(db, third.id, task);
    assert.equal(wasCached(reused), true);
    assert.equal(reused.text, 'Podemos conversar sobre o mascote.');
    assert.equal(calls, 2);
    await request(app).put(`/api/operations/economy/cache/${entry.id}`)
      .send({ answer: 'Resposta em revisão.' }).expect(200);
    assert.equal(wasCached(await generateSuggestion(db, third.id, task)), false);
    assert.equal(calls, 3);
  }));

test('conhecimento aprovado conserva contexto cliente e ordem do vendedor', async () =>
  aiTest(async () => {
    const chat = await makeContact('5511777770035');
    await db.chatMessage.createMany({
      data: [
        {
          id: 'knowledge-later',
          conversationId: chat.id,
          direction: 'OUTBOUND',
          text: 'Primeiro confirmo sua necessidade.',
          sentAt: new Date('2026-01-01T10:01:00Z'),
        },
        {
          id: 'knowledge-first',
          conversationId: chat.id,
          direction: 'INBOUND',
          text: 'Quero um orçamento especial.',
          sentAt: new Date('2026-01-01T10:00:00Z'),
        },
      ],
    });
    await request(app)
      .post(`/api/operations/sessions/${sessionId}/contacts/${chat.id}/knowledge`)
      .expect(200);
    const knowledge = await record<{ turns: { role: string }[] }>(db, `knowledge:${chat.id}`, { turns: [] });
    assert.deepEqual(
      knowledge.turns.map((turn) => turn.role),
      ['user', 'assistant'],
    );
    await configureAi();
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(String(options?.body));
      assert.match(body.instructions, /user: Quero um orçamento especial/);
      assert.match(body.instructions, /assistant: Primeiro confirmo/);
      return new Response(
        JSON.stringify({
          output: [{ content: [{ type: 'output_text', text: 'Sugestão' }] }],
          usage: { input_tokens: 15, output_tokens: 3 },
        }),
      );
    };
    await generateSuggestion(db, chat.id, 'Orçamento especial');
  }));

test('transcrição de áudio e descrição de vídeo entram no contexto da sugestão', async () =>
  aiTest(async () => {
    const chat = await makeContact('5511777770064');
    const audio = await db.storedFile.create({ data: { sha256: 'd'.repeat(64), filename: 'fala.ogg', mimeType: 'audio/ogg', byteLength: 5, data: Buffer.from('audio') } });
    const video = await db.storedFile.create({ data: { sha256: 'e'.repeat(64), filename: 'cena.mp4', mimeType: 'video/mp4', byteLength: 5, data: Buffer.from('video') } });
    const first = await db.chatMessage.create({ data: { conversationId: chat.id, direction: 'INBOUND', type: 'audioMessage', fileId: audio.id, sentAt: new Date('2026-01-01T10:00:00Z') } });
    const second = await db.chatMessage.create({ data: { conversationId: chat.id, direction: 'INBOUND', type: 'videoMessage', fileId: video.id, sentAt: new Date('2026-01-01T10:01:00Z') } });
    await configureAi({ provider: 'openai', mediaModel: 'modelo-midia-ficticio', transcriptionModel: 'modelo-audio-ficticio' });
    globalThis.fetch = async (url, options) => {
      assert.match(String(url), /audio\/transcriptions/);
      assert.equal((options?.body as FormData).get('model'), 'modelo-audio-ficticio');
      return new Response(JSON.stringify({ text: 'Transcrição fictícia do áudio.' }));
    };
    assert.equal((await preprocessMedia(db, messaging, sessionId, chat.id, first.id)).text, 'Transcrição fictícia do áudio.');
    await configureAi({ provider: 'gemini', mediaModel: 'modelo-midia-ficticio' });
    let suggestionInput = '';
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(String(options?.body));
      if (body.contents[0].parts[1]?.inlineData) {
        assert.equal(body.contents[0].parts[1].inlineData.data, Buffer.from('video').toString('base64'));
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Descrição fictícia do vídeo.' }] } }] }));
      }
      suggestionInput = body.contents[0].parts[0].text;
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Sugestão fictícia.' }] } }] }));
    };
    assert.equal((await preprocessMedia(db, messaging, sessionId, chat.id, second.id)).text, 'Descrição fictícia do vídeo.');
    await generateSuggestion(db, chat.id, 'Sugira uma resposta.');
    assert.match(suggestionInput, /Transcrição fictícia do áudio/);
    assert.match(suggestionInput, /Descrição fictícia do vídeo/);
  }));

test('análise de mídia usa conteúdo explícito, cache e impede visualização única', async () =>
  aiTest(async () => {
    const chat = await makeContact('5511777770036');
    const file = await db.storedFile.create({
      data: {
        sha256: 'a'.repeat(64),
        filename: 'imagem.png',
        mimeType: 'image/png',
        byteLength: 3,
        data: Buffer.from('png'),
      },
    });
    const message = await db.chatMessage.create({
      data: { conversationId: chat.id, direction: 'INBOUND', type: 'imageMessage', fileId: file.id },
    });
    await configureAi({ provider: 'gemini', mediaModel: 'modelo-ficticio' });
    let calls = 0;
    globalThis.fetch = async (_url, options) => {
      calls++;
      const body = JSON.parse(String(options?.body));
      assert.equal(body.contents[0].parts[1].inlineData.data, Buffer.from('png').toString('base64'));
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'Descrição fictícia.' }] } }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
        }),
      );
    };
    assert.equal(
      (await preprocessMedia(db, messaging, sessionId, chat.id, message.id)).text,
      'Descrição fictícia.',
    );
    await preprocessMedia(db, messaging, sessionId, chat.id, message.id);
    assert.equal(calls, 1);
    await db.chatMessage.update({ where: { id: message.id }, data: { asViewOnce: true } });
    await assert.rejects(
      preprocessMedia(db, messaging, sessionId, chat.id, message.id),
      /visualização única/,
    );
    assert.equal(calls, 1);
  }));

test('recusa explícita do provedor libera reserva; falha incerta mantém estimativa conservadora', async () => {
  const settings = { enabled: false, model: 'teste', instructions: '', knowledge: '', style: '', dailyLimit: 100, maxOutputTokens: 100, inputPrice: 1, outputPrice: 1 };
  const id = 'budget-rejection-test';
  const before = await aiUsage(db);
  await assert.rejects(() => meteredCall(db, settings, id, 'reply', 50, async () => {
    await providerResponse(new Response('{}', { status: 403 }));
    return { result: '' };
  }), /HTTP 403/);
  const rejected = await db.operationRecord.findFirstOrThrow({ where: { kind: 'AI_USAGE', data: { path: '$.conversationId', equals: id } } });
  assert.equal((rejected.data as any).status, 'REJECTED');
  assert.equal((rejected.data as any).estimatedCost, 0);
  const after = await aiUsage(db);
  assert.equal(after.todayTokens, before.todayTokens);
  assert.equal(after.unconfirmed, before.unconfirmed);
  const uncertainId = 'budget-timeout-test';
  await assert.rejects(() => meteredCall(db, settings, uncertainId, 'reply', 50, async () => {
    throw new Error('Timeout simulado');
  }), /Timeout/);
  const uncertain = await db.operationRecord.findFirstOrThrow({ where: { kind: 'AI_USAGE', data: { path: '$.conversationId', equals: uncertainId } } });
  assert.equal((uncertain.data as any).status, 'UNCONFIRMED');
  assert.equal((uncertain.data as any).inputTokens, 50);
  assert.equal((uncertain.data as any).outputTokens, 100);
});

test('falha da geração envia contingência uma vez, pausa e avisa atendente', async () =>
  aiTest(async () => {
    const chat = await makeContact('5511777770037');
    await configureAi({ enabled: true, fallbackText: 'Nossa equipe vai continuar o atendimento.' });
    await inbound(chat.id, 'Preciso de informações');
    globalThis.fetch = async () => new Response('{}', { status: 503 });
    const before = socket.sends.length;
    const ai = new AiWorker(db, whatsapp, messaging);
    await ai.flush();
    await ai.flush();
    await ai.stop();
    assert.equal(socket.sends.length, before + 1);
    assert.equal((socket.sends.at(-1) as { text: string }).text, 'Nossa equipe vai continuar o atendimento.');
    assert.equal((await aiControl(db, chat.id)).paused, true);
  }));

test('ordem das etiquetas persiste, aparece no CRM e rejeita outra conexão sem alterar a lista', async () => {
  const a = await db.label.create({ data: { id: 'reorder-a', name: 'Ordem A', sessionId, position: 900 } });
  const b = await db.label.create({ data: { id: 'reorder-b', name: 'Ordem B', sessionId, position: 901 } });
  const foreign = await db.label.create({
    data: { id: 'reorder-foreign', name: 'Outra conexão', sessionId: otherSession },
  });
  const url = `/api/operations/sessions/${sessionId}/label-order`;
  await request(app)
    .put(url)
    .send({ ids: [b.id, a.id] })
    .expect(200);
  const listed = await request(app).get(`/api/whatsapp/sessions/${sessionId}/labels`).expect(200);
  assert.deepEqual(
    listed.body.items.slice(0, 2).map((label: { id: string }) => label.id),
    [b.id, a.id],
  );
  const board = await request(app).get(`/api/crm/sessions/${sessionId}/board`).expect(200);
  const columns = board.body.columns.filter((column: { labelId: string | null }) => column.labelId);
  assert.deepEqual(
    columns.slice(0, 2).map((column: { labelId: string }) => column.labelId),
    [b.id, a.id],
  );
  await request(app)
    .put(url)
    .send({ ids: [a.id, foreign.id] })
    .expect(422);
  await request(app)
    .put(url)
    .send({ ids: [a.id, a.id] })
    .expect(422);
  assert.equal((await db.label.findUniqueOrThrow({ where: { id: b.id } })).position, 0);
});

test('receita do CRM conta somente vendas ganhas, não duplica campanhas e preserva investimento', async () => {
  const chat = await makeContact('5511888877791', 'Venda fictícia');
  const before = socket.sends.length;
  await db.crmOpportunity.create({ data: { conversationId: chat.id, title: 'Venda de teste', valueInCents: 10000, status: 'WON', wonAt: new Date(), version: 1 } });
  const first = await draft([chat.id], { kind: 'text', text: 'Não ativar: teste financeiro' });
  const second = await draft([chat.id], { kind: 'text', text: 'Não ativar: segunda campanha' });
  const base = `/api/operations/sessions/${sessionId}/batches`;
  await request(app).put(`${base}/${first.id}`).send({ investmentInCents: 2000, attributedRevenueInCents: 99999 }).expect(200);
  await request(app).put(`${base}/${first.id}/revenue`).send({ conversationIds: [chat.id] }).expect(200);
  await request(app).put(`${base}/${first.id}/revenue`).send({ conversationIds: [chat.id] }).expect(200);
  const readFirst = async () => (await request(app).get(base).expect(200)).body.items.find((item: any) => item.id === first.id);
  let financial = await readFirst();
  assert.equal(financial.attributedRevenueInCents, 10000);
  assert.equal(financial.manualRevenueInCents, 99999);
  assert.equal(financial.revenueSource, 'CRM');
  assert.equal(financial.crmSales, 1);
  assert.equal(financial.investmentInCents, 2000);
  const overview = await request(app).get(`/api/operations/sessions/${sessionId}/overview`).expect(200);
  assert.equal(overview.body.campaignFinance.revenueInCents, 10000);
  assert.equal(overview.body.campaignFinance.investmentInCents, 2000);
  assert.equal(overview.body.campaignFinance.roiPercent, 400);
  assert.equal(overview.body.campaignFinance.sales, 1);
  await request(app).put(`${base}/${second.id}/revenue`).send({ conversationIds: [chat.id] }).expect(409);
  await request(app).get(`/api/operations/sessions/${otherSession}/batches/${first.id}/revenue`).expect(404);
  await db.crmOpportunity.update({ where: { conversationId: chat.id }, data: { valueInCents: 15000 } });
  assert.equal((await readFirst()).attributedRevenueInCents, 15000);
  await db.crmOpportunity.update({ where: { conversationId: chat.id }, data: { status: 'OPEN' } });
  assert.equal((await readFirst()).attributedRevenueInCents, 0);
  await request(app).put(`${base}/${second.id}/revenue`).send({ conversationIds: [chat.id] }).expect(422);
  await putRecord(db, first.id, 'BATCH', { ...first, investmentInCents: 0 });
  financial = await readFirst();
  assert.equal(financial.investmentInCents, 2000, 'a execução não pode sobrescrever o financeiro');
  await request(app).put(`${base}/${first.id}/revenue`).send({ conversationIds: [] }).expect(200);
  await db.crmOpportunity.update({ where: { conversationId: chat.id }, data: { status: 'WON' } });
  await request(app).put(`${base}/${second.id}/revenue`).send({ conversationIds: [chat.id] }).expect(200);
  await request(app).put(`${base}/${first.id}`).send({ revenueSource: 'MANUAL' }).expect(200);
  assert.equal((await readFirst()).attributedRevenueInCents, 99999);
  assert.equal(socket.sends.length, before);
});

test('financeiro rejeita agendamento e atualização mista sem alterar execução', async () => {
  const chat = await makeContact('5511888877792', 'Agendamento fictício');
  const scheduled = await draft(
    [chat.id],
    { kind: 'text', text: 'Não enviar: teste financeiro' },
    'SCHEDULE',
    new Date(Date.now() + 3_600_000).toISOString(),
  );
  const base = `/api/operations/sessions/${sessionId}/batches/${scheduled.id}`;
  const before = socket.sends.length;
  await request(app).put(base).send({ investmentInCents: 2000 }).expect(422);
  await request(app).put(base).send({ status: 'PAUSED', investmentInCents: 2000 }).expect(422);
  assert.equal(await db.operationRecord.count({ where: { id: `campaign-finance:${scheduled.id}` } }), 0);
  assert.equal((await record<Batch>(db, scheduled.id, scheduled)).status, 'DRAFT');
  assert.equal(socket.sends.length, before);
});

function unzipEntries(bytes: Buffer) {
  const files = new Map<string, string>();
  for (let at = 0; at + 46 <= bytes.length; at++) {
    if (bytes.readUInt32LE(at) !== 0x02014b50) continue;
    const size = bytes.readUInt32LE(at + 20),
      nameLength = bytes.readUInt16LE(at + 28),
      extra = bytes.readUInt16LE(at + 30),
      comment = bytes.readUInt16LE(at + 32),
      offset = bytes.readUInt32LE(at + 42);
    const name = bytes.subarray(at + 46, at + 46 + nameLength).toString();
    const begin = offset + 30 + bytes.readUInt16LE(offset + 26) + bytes.readUInt16LE(offset + 28);
    const content = bytes.subarray(begin, begin + size);
    files.set(name, (bytes.readUInt16LE(at + 10) === 8 ? inflateRawSync(content) : content).toString());
    at += 45 + nameLength + extra + comment;
  }
  return files;
}
test('pré-processamento de histórico exige consentimento, isola conexão, reutiliza cache e respeita snapshot', async () => {
  const chat = await makeContact('5511777770048');
  const file = await db.storedFile.create({ data: { sha256: 'b'.repeat(64), filename: 'teste.png', mimeType: 'image/png', data: Buffer.from('png'), byteLength: 3 } });
  const first = await db.chatMessage.create({ data: { id: 'preprocess-a', direction: 'INBOUND', conversationId: chat.id, type: 'imageMessage', fileId: file.id } });
  await db.chatMessage.create({ data: { id: 'preprocess-b-private', direction: 'INBOUND', conversationId: chat.id, type: 'audioMessage', asViewOnce: true } });
  await putRecord(db, `ai-media:${first.id}`, 'AI_MEDIA', { text: 'Descrição salva para exportação.' });
  const url = `/api/operations/sessions/${sessionId}/history-preprocessing`;
  await request(app).post(url).send({ conversationIds: [chat.id] }).expect(422);
  await request(app).post(`/api/operations/sessions/${otherSession}/history-preprocessing`).send({ conversationIds: [chat.id], consent: true }).expect(404);
  const page = await request(app).post(url).send({ conversationIds: [chat.id], consent: true }).expect(200);
  assert.equal(page.body.total, 1);
  assert.equal(page.body.item.status, 'CACHED');
  assert.equal(page.body.nextCursor, first.id);
  await db.chatMessage.create({ data: { id: 'preprocess-z-new', direction: 'INBOUND', conversationId: chat.id, type: 'imageMessage', sentAt: new Date(new Date(page.body.snapshot).getTime() + 1000) } });
  const end = await request(app).post(url).send({ conversationIds: [chat.id], consent: true, cursor: page.body.nextCursor, snapshot: page.body.snapshot }).expect(200);
  assert.equal(end.body.done, true);
  assert.equal(end.body.total, 1);
});

test('pré-processamento gera análise, reaproveita resultado e interrompe após recusa do provedor', async () => aiTest(async () => {
  const chat = await makeContact('5511777770049');
  const file = await db.storedFile.create({ data: { sha256: 'c'.repeat(64), filename: 'imagem.png', mimeType: 'image/png', data: Buffer.from('png'), byteLength: 3 } });
  const first = await db.chatMessage.create({ data: { id: 'preprocess-real-a', direction: 'INBOUND', conversationId: chat.id, type: 'imageMessage', fileId: file.id } });
  const second = await db.chatMessage.create({ data: { id: 'preprocess-real-b', direction: 'INBOUND', conversationId: chat.id, type: 'imageMessage', fileId: file.id } });
  await configureAi({ provider: 'gemini', mediaModel: 'modelo-ficticio' });
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Descrição visual de teste.' }] } }], usageMetadata: { promptTokenCount: 8, candidatesTokenCount: 5 } }));
  };
  const url = `/api/operations/sessions/${sessionId}/history-preprocessing`;
  const body = { conversationIds: [chat.id], consent: true };
  const analyzed = await request(app).post(url).send(body).expect(200);
  assert.equal(analyzed.body.item.id, first.id);
  assert.equal(analyzed.body.item.status, 'ANALYZED');
  assert.equal((await record<any>(db, `ai-media:${first.id}`, null)).text, 'Descrição visual de teste.');
  const cached = await request(app).post(url).send(body).expect(200);
  assert.equal(cached.body.item.status, 'CACHED');
  assert.equal(calls, 1);
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ error: { message: 'Projeto indisponível' } }), { status: 403 }); };
  const refused = await request(app).post(url).send({ ...body, cursor: first.id }).expect(200);
  assert.equal(refused.body.item.id, second.id);
  assert.equal(refused.body.fatal, true);
  assert.equal(refused.body.item.status, 'UNAVAILABLE');
  assert.equal(calls, 2);
}));

test('exportação estruturada ordena por horário, separa papéis e protege CSV', async () => {
  const chat = await makeContact('5511777770038');
  await db.chatMessage.createMany({
    data: [
      {
        id: 'export-z-first',
        conversationId: chat.id,
        direction: 'INBOUND',
        text: '=formula',
        sentAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: 'export-a-second',
        conversationId: chat.id,
        direction: 'OUTBOUND',
        text: 'Resposta depois',
        sentAt: new Date('2026-01-01T00:01:00Z'),
      },
    ],
  });
  const exported = await request(app)
    .get(`/api/operations/sessions/${sessionId}/history-export?ids=${chat.id}`)
    .buffer(true)
    .parse((res, callback) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => callback(null, Buffer.concat(chunks)));
    })
    .expect(200);
  const files = unzipEntries(exported.body);
  const turns = files
    .get('dialogo.jsonl')!
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.deepEqual(
    turns.map((turn) => turn.role),
    ['user', 'assistant'],
  );
  assert.equal(turns[0].content, '=formula');
  assert.match(files.get('dialogo.csv')!, /'=formula/);
  assert.ok(files.has('conversa.jsonl'));
  assert.ok(files.has('dialogo.txt'));
  await request(app)
    .get(`/api/operations/sessions/${otherSession}/history-export?ids=${chat.id}`)
    .expect(404);
});

test('campanha congela as variações por destinatário e nunca envia ao salvar',async()=>{const first=await makeContact('5511888877701','Primeiro');const second=await makeContact('5511888877702','Segundo');const before=socket.sends.length;const result=await draft([first.id,second.id],{kind:'text',text:'Base {{nome}}',textVariations:['Olá {{nome}}, opção A','Olá {{nome}}, opção B']});const tasks=await db.deliveryTask.findMany({where:{batchId:result.id},orderBy:{conversationId:'asc'}});const texts=tasks.map((task)=>(task.payload as {snapshot:{text:string}}).snapshot.text);assert.equal(new Set(texts).size,2);assert.ok(texts.every((text)=>text.includes('{{nome}}')));assert.equal(socket.sends.length,before);});
test('transferência para setor valida a fila, pode ser aceita e não envia WhatsApp',async()=>{const chat=await makeContact('5511888877703','Setor');await putRecord(db,'settings:departments','SETTINGS',{items:[{name:'Comercial',label:''}]});const before=socket.sends.length;await request(app).post(`/api/operations/toolbox/sessions/${sessionId}/transfers`).send({conversationId:chat.id,target:'Inexistente',targetType:'DEPARTMENT',note:''}).expect(422);const created=await request(app).post(`/api/operations/toolbox/sessions/${sessionId}/transfers`).send({conversationId:chat.id,target:'Comercial',targetType:'DEPARTMENT',note:'Acompanhamento'}).expect(201);assert.equal(created.body.department,'Comercial');assert.equal(created.body.targetType,'DEPARTMENT');await request(app).put(`/api/operations/toolbox/sessions/${sessionId}/transfers/${created.body.id}`).send({status:'ACCEPTED'}).expect(200);assert.equal(socket.sends.length,before);});
test('diretório fornece avatar e presença recente sem expor dados de integração',async()=>{await putRecord(db,'team:presence@example.com','TEAM',{email:'presence@example.com',name:'Presença',department:'Comercial',role:'MEMBER',active:true,avatar:''});await putRecord(db,'presence:presence@example.com','TEAM_PRESENCE',{email:'presence@example.com',seenAt:new Date().toISOString()});const result=await request(app).get('/api/operations/directory').expect(200);assert.equal(result.body.items.find((item:{email:string})=>item.email==='presence@example.com').online,true);assert.ok(result.body.departments.some((item:{name:string})=>item.name==='Comercial'));assert.equal(result.body.encryptedKey,undefined);});

test('ações de etiqueta exigem confirmação, registram venda sem duplicar e calculam retorno por etiqueta', async()=>{
  const chat=await makeContact('5511888800611','Venda etiqueta fictícia');
  const label=await db.label.create({data:{id:'paid-rule-test',sessionId,name:'Pagamento concluído'}});
  const base=`/api/operations/sessions/${sessionId}`;
  const apply=`/api/attendance/sessions/${sessionId}/conversations/${chat.id}/labels/${label.id}`;
  const before=socket.sends.length;
  await request(app).put(`${base}/label-rules/${label.id}`).send({enabled:true,recordSale:true,askValue:true,internalNote:'Venda registrada no teste',pinConversation:true,investmentInCents:2000}).expect(200);
  await request(app).put(apply).send({active:true}).expect(409);
  assert.equal(await db.contactLabel.count({where:{contactId:chat.contactId,labelId:label.id}}),0);
  await request(app).put(apply).send({active:true,confirmActions:true}).expect(422);
  await request(app).put(apply).send({active:true,confirmActions:true,saleValueInCents:10000}).expect(200);
  await request(app).put(apply).send({active:true}).expect(200);
  let row=(await request(app).get(`${base}/label-finance`).expect(200)).body.items.find((x:{id:string})=>x.id===label.id);
  assert.equal(row.sales,1);assert.equal(row.revenueInCents,10000);assert.equal(row.roiPercent,400);
  assert.equal((await db.conversation.findUniqueOrThrow({where:{id:chat.id}})).pinned,true);
  assert.equal(await db.operationRecord.count({where:{id:`label-note:${chat.id}:${label.id}`}}),1);
  const second=await db.label.create({data:{id:'paid-second-rule-test',sessionId,name:'Outra classificação financeira'}});
  await request(app).put(`${base}/label-rules/${second.id}`).send({enabled:true,recordSale:true,askValue:false,fixedValueInCents:12000}).expect(200);
  await request(app).put(`/api/attendance/sessions/${sessionId}/conversations/${chat.id}/labels/${second.id}`).send({active:true,confirmActions:true}).expect(200);
  const financial=(await request(app).get(`${base}/label-finance`).expect(200)).body.items;
  assert.equal(financial.find((x:{id:string})=>x.id===label.id).sales,0);
  assert.equal(financial.find((x:{id:string})=>x.id===second.id).sales,1);
  assert.equal(financial.find((x:{id:string})=>x.id===second.id).revenueInCents,12000);
  await db.crmOpportunity.update({where:{conversationId:chat.id},data:{status:'OPEN'}});
  row=(await request(app).get(`${base}/label-finance`).expect(200)).body.items.find((x:{id:string})=>x.id===label.id);
  assert.equal(row.sales,0);assert.equal(row.revenueInCents,0);
  await request(app).get(`/api/operations/sessions/${otherSession}/label-rules/${label.id}`).expect(404);
  assert.equal(socket.sends.length,before);
});
test('filtros de resposta e ordenação consideram todos os leads antes de paginar', async()=>{
  const chats=[];
  for(let i=0;i<3;i++){
    const chat=await makeContact(`551188880062${i}`,'FiltroRespostaTeste '+i);chats.push(chat);
    const date=new Date(Date.now()-(3-i)*60_000);
    await db.conversation.update({where:{id:chat.id},data:{lastMessageAt:date}});
    await db.chatMessage.create({data:{conversationId:chat.id,direction:i===2?'OUTBOUND':'INBOUND',status:'SENT',text:'Conteúdo fictício',sentAt:date}});
    if(i===1) await db.chatMessage.create({data:{conversationId:chat.id,direction:'OUTBOUND',status:'SENT',text:'Resposta anterior',sentAt:new Date(date.getTime()-1000)}});
  }
  const base=`/api/attendance/sessions/${sessionId}/conversations?search=FiltroRespostaTeste&pageSize=1`;
  const recent=await request(app).get(`${base}&sort=recent`).expect(200);
  assert.equal(recent.body.total,3);assert.equal(recent.body.items[0].id,chats[2]!.id);
  const ours=await request(app).get(`${base}&response=ours&sort=waiting&page=2`).expect(200);
  assert.equal(ours.body.total,2);assert.equal(ours.body.items[0].id,chats[1]!.id);
  const never=await request(app).get(`${base}&response=never`).expect(200);
  assert.equal(never.body.total,1);assert.equal(never.body.items[0].id,chats[0]!.id);
  const client=await request(app).get(`${base}&response=client`).expect(200);
  assert.equal(client.body.total,1);assert.equal(client.body.items[0].id,chats[2]!.id);
});
test('Kanban confirma ações de etiqueta e desfaz movimentação sem valor obrigatório',async()=>{
  const chat=await makeContact('5511888800631','Venda Kanban fictícia');
  const source=await db.contactLabel.findFirstOrThrow({where:{contactId:chat.contactId}});
  const label=await db.label.create({data:{id:'paid-kanban-rule-test',sessionId,name:'Venda no Kanban'}});
  await request(app).put(`/api/operations/sessions/${sessionId}/label-rules/${label.id}`).send({enabled:true,recordSale:true,askValue:true}).expect(200);
  const body={conversationId:chat.id,sourceLabelId:source.labelId,targetLabelId:label.id,version:0};
  await request(app).post(`/api/crm/sessions/${sessionId}/move`).send(body).expect(409);
  assert.equal(await db.contactLabel.count({where:{contactId:chat.contactId,labelId:label.id}}),0);
  await request(app).post(`/api/crm/sessions/${sessionId}/move`).send({...body,confirmActions:true,saleValueInCents:9000}).expect(200);
  const won=await db.crmOpportunity.findUniqueOrThrow({where:{conversationId:chat.id}});
  assert.equal(won.status,'WON');assert.equal(won.valueInCents,9000);
});

test('macro importada usa mídia Base64 como áudio de voz no conector fictício', async () => {
  const ffmpeg = createRequire(import.meta.url)('ffmpeg-static') as string;
  const wav = execFileSync(ffmpeg, [
    '-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=660:duration=0.15',
    '-c:a', 'pcm_s16le', '-f', 'wav', 'pipe:1',
  ], { windowsHide: true });
  const report = await new BackupService(db).import({
    respostasRapidasAcao: [{
      id: 'imported-audio-macro-test', name: 'Áudio importado',
      acao: [{
        type: 'media', filename: 'amostra.wav', mimeType: 'audio/wav',
        base64: `data:audio/wav;base64,${wav.toString('base64')}`,
        aguarde: 0, composing: 0,
      }],
    }],
  }, 'macro-audio-ficticia.json');
  assert.equal(report.counts.macros, 1);
  const action = await db.macroAction.findFirstOrThrow({ where: { macroId: 'imported-audio-macro-test' } });
  assert.ok(action.fileId);
  const chat = await makeContact('5511888800641', 'Cliente de macro fictício');
  const before = socket.sends.length;
  const run = await sequences.enqueue(sessionId, chat.id, 'MACRO', 'imported-audio-macro-test', 'imported-audio-macro-request');
  await sequences.flush();
  assert.equal(socket.sends.length, before + 1);
  const sent = socket.sends.at(-1) as { audio?: Buffer; mimetype?: string; ptt?: boolean };
  assert.ok(Buffer.isBuffer(sent.audio));
  assert.equal(sent.mimetype, 'audio/ogg; codecs=opus');
  assert.equal(sent.ptt, true);
  assert.equal((await db.sequenceRun.findUniqueOrThrow({ where: { id: run.id } })).status, 'COMPLETED');
});
