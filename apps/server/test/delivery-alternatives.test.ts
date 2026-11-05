import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createSqliteClient } from '../src/database/sqlite-client.js';
import { makeEventBuffer, type AnyMessageContent, type WAMessage } from '@whiskeysockets/baileys';
import { pino } from 'pino';
import type { WhatsappSocket } from '../src/modules/whatsapp/socket-factory.js';
import { WhatsappService } from '../src/modules/whatsapp/whatsapp.service.js';
import { CredentialCipher } from '../src/modules/whatsapp/credential-cipher.js';
import { silentPublisher } from '../src/modules/whatsapp/whatsapp.types.js';
import { MessagingService } from '../src/modules/attendance/messaging.service.js';
import { SequenceService } from '../src/modules/attendance/sequence.service.js';
import { DeliveryWorker, type Batch } from '../src/modules/operations/delivery.worker.js';
import { ContactsService } from '../src/modules/operations/contacts.service.js';
import { putRecord, record } from '../src/modules/operations/records.js';
import { env } from '../src/config/env.js';
import request from 'supertest';
import { createApp } from '../src/app.js';
class FakeSocket implements WhatsappSocket {
  lookupCalls = 0;
  lookupFails = false;
  registeredPhones = new Set<string>();
  async onWhatsApp(...numbers: string[]) {
    this.lookupCalls++;
    if (this.lookupFails) throw new Error('Consulta indisponível');
    return numbers
      .filter((phone) => phone.endsWith('1') || this.registeredPhones.has(phone))
      .map((phone) => ({ jid: `${phone}@s.whatsapp.net`, exists: true }));
  }
  ev = makeEventBuffer(pino({ level: 'silent' }));
  user = { id: '5511000000000@s.whatsapp.net' };
  sends: AnyMessageContent[] = [];
  presenceUpdates: Array<{ type: string; jid?: string }> = [];
  async end() {}
  async logout() {}
  async profilePictureUrl() {
    return undefined;
  }
  async resyncAppState() {}
  async addChatLabel() {}
  async sendPresenceUpdate(type: string, jid?: string) {
    this.presenceUpdates.push({ type, jid });
  }
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

let sessionId = '';
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

  sessionId = (await whatsapp.create('Alternativas fictícias')).id;
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
  socket.registeredPhones.add(phoneNumber);
  return db.conversation.findFirstOrThrow({ where: { sessionId, contact: { phoneNumber } } });
}

test('Fase 2: worker usa snapshots por tarefa e preserva o caminho legado', async (t) => {
  const previousFlag = env.CAMPAIGN_ALTERNATIVES_ENABLED;
  const chat = await makeContact('5511777700201', 'Snapshot fictício');
  let serial = 0;
  const createTask = async (frozenContent: object | null, payload: object, extra: object = {}) => {
    const id = `phase2-${++serial}`;
    await putRecord(db, id, 'BATCH', {
      name: id, sessionId, status: 'ACTIVE', mode: 'CAMPAIGN',
      minSeconds: 0, maxSeconds: 0, count: 1, createdAt: new Date().toISOString(),
    });
    return db.deliveryTask.create({ data: {
      id, batchId: id, sessionId, conversationId: chat.id,
      payload, runAt: new Date(0), ...(frozenContent ? { frozenContent } : {}), ...extra,
    } });
  };
  try {
    await t.test('flag desligada ignora snapshot e cursor novos', async () => {
      env.CAMPAIGN_ALTERNATIVES_ENABLED = false;
      const task = await createTask({ kind: 'text', text: 'novo ignorado' }, { kind: 'text', text: 'legado preservado' }, { stepIndex: 99 });
      const before = socket.sends.length;
      await worker.flush();
      assert.deepEqual(socket.sends.slice(before), [{ text: 'legado preservado' }]);
      assert.equal((await db.deliveryTask.findUniqueOrThrow({ where: { id: task.id } })).status, 'COMPLETED');
    });
    env.CAMPAIGN_ALTERNATIVES_ENABLED = true;
    await t.test('rodízio não ultrapassa alternativa que aguarda sua primeira etapa', async () => {
      const first = await makeContact('5511777790101', 'Primeiro do rodízio');
      const second = await makeContact('5511777790102', 'Segundo do rodízio');
      const response = await request(createApp(db, whatsapp, sequences, messaging))
        .post(`/api/operations/sessions/${sessionId}/batches`).send({
          name: 'Espera inicial', mode: 'CAMPAIGN', audience: { conversationIds: [first.id, second.id] },
          delivery: { kind: 'text', text: 'compatibilidade' },
          alternatives: [
            { name: 'Primeira', delivery: { kind: 'sequence', steps: [{ kind: 'text', text: 'Primeira alternativa', waitSeconds: 60 }] } },
            { name: 'Segunda', delivery: { kind: 'text', text: 'Segunda alternativa' } },
          ],
        }).expect(201);
      const batch = await record<Batch>(db, response.body.id, {} as Batch);
      await putRecord(db, response.body.id, 'BATCH', { ...batch, status: 'ACTIVE', minSeconds: 0, maxSeconds: 0 });
      const before = socket.sends.length;
      const restarted = new DeliveryWorker(db, whatsapp, messaging, sequences);
      try {
        await restarted.flush();
        assert.equal(socket.sends.length, before, 'o segundo lead não pode ultrapassar a espera do primeiro');
        const tasks = await db.deliveryTask.findMany({ where: { batchId: response.body.id } });
        const firstTask = tasks.find((task) => task.alternativeIndex === 0)!;
        await db.deliveryTask.update({ where: { id: firstTask.id }, data: { runAt: new Date(0) } });
        await restarted.flush();
        await restarted.flush();
        assert.deepEqual(socket.sends.slice(before), [{ text: 'Primeira alternativa' }, { text: 'Segunda alternativa' }]);
      } finally {
        await restarted.stop();
        const current = await record<Batch>(db, response.body.id, {} as Batch);
        await putRecord(db, response.body.id, 'BATCH', { ...current, status: 'CANCELLED' });
      }
    });
    await t.test('criação persiste rodízio 1-2-3 e congela sequência como uma alternativa', async () => {
      const chats = [];
      for (let i = 0; i < 7; i++) chats.push(await makeContact(`551177779000${i}`, `Lead ${i}`));
      const app = createApp(db, whatsapp, sequences, messaging);
      const response = await request(app).post(`/api/operations/sessions/${sessionId}/batches`).send({
        name: 'Rodízio fictício', mode: 'CAMPAIGN', audience: { conversationIds: chats.map((chat) => chat.id) },
        delivery: { kind: 'text', text: 'compatibilidade' },
        alternatives: [
          { name: 'Um', delivery: { kind: 'text', text: 'Alternativa um' } },
          { name: 'Dois', delivery: { kind: 'sequence', steps: [
            { kind: 'text', text: 'Dois início', waitSeconds: 0 },
            { kind: 'text', text: 'Dois fim', waitSeconds: 15 },
          ] } },
          { name: 'Três', delivery: { kind: 'text', text: 'Alternativa três' } },
        ],
      }).expect(201);
      const tasks = await db.deliveryTask.findMany({ where: { batchId: response.body.id }, orderBy: { runAt: 'asc' } });
      assert.deepEqual(tasks.map((task) => task.alternativeIndex), [0, 1, 2, 0, 1, 2, 0]);
      assert.equal(new Set(tasks.map((task) => task.conversationId)).size, 7);
      assert.equal((tasks[1]!.frozenContent as { steps: unknown[] }).steps.length, 2);
      assert.equal(await db.campaignAlternative.count({ where: { campaignId: response.body.id } }), 3);
      await db.campaignAlternative.updateMany({ where: { campaignId: response.body.id }, data: { content: { kind: 'text', text: 'editado' } } });
      assert.deepEqual(await db.deliveryTask.findMany({ where: { batchId: response.body.id }, orderBy: { runAt: 'asc' } }), tasks);
      const before = socket.sends.length;
      for (let step = 0; step < 9; step++) {
        const current = await record<Batch>(db, response.body.id, {} as Batch);
        await putRecord(db, response.body.id, 'BATCH', { ...current, status: 'ACTIVE', minSeconds: 0, maxSeconds: 0, nextAllowedAt: undefined });
        for (const [index, task] of tasks.entries())
          await db.deliveryTask.update({ where: { id: task.id }, data: { runAt: new Date(index) } });
        const restarted = new DeliveryWorker(db, whatsapp, messaging, sequences);
        await restarted.flush();
        await restarted.stop();
      }
      assert.deepEqual(socket.sends.slice(before), [
        { text: 'Alternativa um' }, { text: 'Dois início' }, { text: 'Dois fim' },
        { text: 'Alternativa três' }, { text: 'Alternativa um' },
        { text: 'Dois início' }, { text: 'Dois fim' }, { text: 'Alternativa três' }, { text: 'Alternativa um' },
      ]);
      assert.equal((await record<Batch>(db, response.body.id, {} as Batch)).sentTotal, 7);
    });
    await t.test('texto usa snapshot sem consultar alternativa editada', async () => {
      const task = await createTask({ kind: 'text', text: 'texto congelado' }, { kind: 'text', text: 'texto mutável' }, { alternativeId: 'alternativa-removida', alternativeIndex: 2 });
      const before = socket.sends.length;
      await worker.flush();
      assert.deepEqual(socket.sends.slice(before), [{ text: 'texto congelado' }]);
      const saved = await db.deliveryTask.findUniqueOrThrow({ where: { id: task.id } });
      assert.equal(saved.alternativeIndex, 2);
      assert.deepEqual(saved.frozenContent, task.frozenContent);
      // Simulate a confirmation persisted by MessagingService before the
      // worker's completion transaction: the same lead/step key is reused.
      await db.deliveryTask.update({ where: { id: task.id }, data: { status: 'QUEUED' } });
      const batch = await record<Batch>(db, task.batchId, {} as Batch);
      await putRecord(db, task.batchId, 'BATCH', { ...batch, status: 'ACTIVE', nextAllowedAt: undefined });
      await worker.flush();
      assert.equal(socket.sends.length, before + 1);
    });
    await t.test('sequência congela mídia e legenda da biblioteca e não repete sua etapa', async () => {
      const file = await db.storedFile.create({ data: {
        sha256: 'a'.repeat(64), filename: 'ficticia.png', mimeType: 'image/png', byteLength: 4, data: Buffer.from('fake'),
      } });
      const asset = await db.asset.create({ data: { id: 'phase2-media', name: 'Mídia fictícia', kind: 'MEDIA', fileId: file.id, caption: 'Legenda congelada' } });
      const response = await request(createApp(db, whatsapp, sequences, messaging))
        .post(`/api/operations/sessions/${sessionId}/batches`).send({
          name: 'Mídia congelada', mode: 'CAMPAIGN', audience: { conversationIds: [chat.id] },
          delivery: { kind: 'text', text: 'compatibilidade' },
          alternatives: [{ name: 'Sequência', delivery: { kind: 'sequence', steps: [
            { kind: 'text', text: 'Antes da mídia', waitSeconds: 0 },
            { kind: 'asset', assetId: asset.id, waitSeconds: 10 },
          ] } }],
        }).expect(201);
      await db.asset.update({ where: { id: asset.id }, data: { caption: 'Legenda alterada', fileId: null } });
      const task = await db.deliveryTask.findFirstOrThrow({ where: { batchId: response.body.id } });
      const activate = async () => {
        const batch = await record<Batch>(db, task.batchId, {} as Batch);
        await putRecord(db, task.batchId, 'BATCH', { ...batch, status: 'ACTIVE', nextAllowedAt: undefined });
        await db.deliveryTask.update({ where: { id: task.id }, data: { status: 'QUEUED', runAt: new Date(0) } });
      };
      const before = socket.sends.length;
      await activate();
      await worker.flush();
      await activate();
      await worker.flush();
      assert.equal(socket.sends.length, before + 2);
      const media = socket.sends[before + 1]!;
      assert.ok('image' in media);
      assert.equal((media as { caption?: string }).caption, 'Legenda congelada');
      await activate();
      await worker.flush();
      assert.equal(socket.sends.length, before + 2);
    });
    await t.test('sequência mantém espera, cursor persistente, ordem por lead e snapshot imutável', async () => {
      const content = { kind: 'sequence', steps: [
        { snapshot: { kind: 'text', text: 'primeira congelada' }, waitSeconds: 0 },
        { snapshot: { kind: 'text', text: 'segunda congelada' }, waitSeconds: 30 },
      ] };
      const task = await createTask(content, { kind: 'text', text: 'não enviar', stepIndex: 99, batchNumber: 1 }, { alternativeId: 'seq', stepIndex: 0 });
      const nextChat = await makeContact('5511777700202', 'Próximo lead fictício');
      await db.deliveryTask.create({ data: {
        id: `${task.id}-next`, batchId: task.batchId, sessionId, conversationId: nextChat.id,
        payload: { kind: 'text', text: 'conteúdo mutável ignorado' },
        frozenContent: { kind: 'text', text: 'próximo lead congelado' },
        alternativeId: 'outra-alternativa', alternativeIndex: 1, runAt: new Date(1),
      } });
      const before = socket.sends.length;
      await worker.flush();
      let saved = await db.deliveryTask.findUniqueOrThrow({ where: { id: task.id } });
      assert.equal(saved.stepIndex, 1);
      assert.equal(saved.status, 'QUEUED');
      assert.ok(saved.runAt.getTime() > Date.now() + 25000);
      assert.deepEqual(saved.frozenContent, content);
      await worker.flush();
      assert.equal(socket.sends.length, before + 1);
      await db.deliveryTask.update({ where: { id: task.id }, data: { runAt: new Date(0) } });
      const batch = await record<Batch>(db, task.batchId, {} as Batch);
      assert.equal(batch.activeSequenceTaskId, task.id);
      assert.equal(batch.sentTotal, 0);
      await putRecord(db, task.batchId, 'BATCH', { ...batch, nextAllowedAt: undefined });
      const resumed = new DeliveryWorker(db, whatsapp, messaging, sequences);
      await resumed.flush();
      await resumed.stop();
      saved = await db.deliveryTask.findUniqueOrThrow({ where: { id: task.id } });
      assert.equal(saved.status, 'COMPLETED');
      assert.deepEqual(saved.frozenContent, content);
      assert.deepEqual(socket.sends.slice(before), [{ text: 'primeira congelada' }, { text: 'segunda congelada' }]);
      assert.equal((await record<Batch>(db, task.batchId, {} as Batch)).sentTotal, 1);
      await worker.flush();
      assert.deepEqual(socket.sends.slice(before), [
        { text: 'primeira congelada' }, { text: 'segunda congelada' }, { text: 'próximo lead congelado' },
      ]);
      assert.equal((await record<Batch>(db, task.batchId, {} as Batch)).sentTotal, 2);
    });
    await t.test('snapshot ausente ou inválido bloqueia envio e exige conferência', async () => {
      for (const content of [null, { kind: 'sequence', steps: [] }]) {
        const task = await createTask(content, { kind: 'text', text: 'nunca enviar' }, { alternativeId: 'incompleta' });
        const before = socket.sends.length;
        await worker.flush();
        const saved = await db.deliveryTask.findUniqueOrThrow({ where: { id: task.id } });
        assert.equal(saved.status, 'VERIFY');
        assert.match(saved.error!, /congelado/);
        assert.equal((await record<Batch>(db, task.batchId, {} as Batch)).status, 'PAUSED');
        await worker.flush();
        assert.equal(socket.sends.length, before);
      }
    });
    await t.test('flag ligada mantém tarefa legada sem alternativa', async () => {
      await createTask(null, { kind: 'text', text: 'legado com flag' });
      const before = socket.sends.length;
      await worker.flush();
      assert.deepEqual(socket.sends.slice(before), [{ text: 'legado com flag' }]);
    });
    await t.test('reinício preserva snapshot e cursor e não reenvia tarefa RUNNING', async () => {
      const content = { kind: 'sequence', steps: [
        { snapshot: { kind: 'text', text: 'já enviada' }, waitSeconds: 0 },
        { snapshot: { kind: 'text', text: 'entrega incerta' }, waitSeconds: 10 },
      ] };
      const task = await createTask(content, { kind: 'text', text: 'ignorado' }, {
        status: 'RUNNING', alternativeId: 'interrompida', stepIndex: 1,
      });
      const before = socket.sends.length;
      const restarted = new DeliveryWorker(db, whatsapp, messaging, sequences);
      await restarted.start();
      await restarted.flush();
      await restarted.stop();
      const saved = await db.deliveryTask.findUniqueOrThrow({ where: { id: task.id } });
      assert.equal(saved.status, 'VERIFY');
      assert.equal(saved.stepIndex, 1);
      assert.deepEqual(saved.frozenContent, content);
      assert.equal((await record<Batch>(db, task.batchId, {} as Batch)).status, 'PAUSED');
      assert.equal(socket.sends.length, before);
    });
    await t.test('confirmar etapa incerta preserva as etapas seguintes e conta o lead apenas no fim', async () => {
      const content = { kind: 'sequence', steps: [
        { snapshot: { kind: 'text', text: 'Etapa confirmada manualmente' }, waitSeconds: 0 },
        { snapshot: { kind: 'text', text: 'Etapa seguinte preservada' }, waitSeconds: 20 },
      ] };
      const task = await createTask(content, { kind: 'sequence', steps: content.steps, stepIndex: 0 }, {
        status: 'VERIFY', alternativeId: 'manual-sequence', stepIndex: 0,
      });
      const batch = await record<Batch>(db, task.batchId, {} as Batch);
      await putRecord(db, task.batchId, 'BATCH', { ...batch, status: 'PAUSED' });
      const app = createApp(db, whatsapp, sequences, messaging);
      await request(app).post(`/api/operations/sessions/${sessionId}/batches/${task.batchId}/tasks/${task.id}/resolve`)
        .send({ action: 'mark-sent' }).expect(200);
      const saved = await db.deliveryTask.findUniqueOrThrow({ where: { id: task.id } });
      assert.equal(saved.status, 'QUEUED');
      assert.equal(saved.stepIndex, 1);
      assert.ok(saved.runAt.getTime() > Date.now() + 15000);
      const paused = await record<Batch>(db, task.batchId, {} as Batch);
      assert.equal(paused.sentTotal ?? 0, 0);
      assert.equal(paused.activeSequenceTaskId, task.id);
      await putRecord(db, task.batchId, 'BATCH', { ...paused, status: 'ACTIVE', nextAllowedAt: undefined });
      await db.deliveryTask.update({ where: { id: task.id }, data: { runAt: new Date(0) } });
      const before = socket.sends.length;
      await worker.flush();
      assert.deepEqual(socket.sends.slice(before), [{ text: 'Etapa seguinte preservada' }]);
      assert.equal((await record<Batch>(db, task.batchId, {} as Batch)).sentTotal, 1);
    });
  } finally {
    env.CAMPAIGN_ALTERNATIVES_ENABLED = previousFlag;
  }
});

test('Fase 3: editor recebe a capacidade de alternativas sem habilitar a flag', async () => {
  const previous = env.CAMPAIGN_ALTERNATIVES_ENABLED;
  try {
    const app = createApp(db, whatsapp, sequences, messaging);
    for (const enabled of [false, true]) {
      env.CAMPAIGN_ALTERNATIVES_ENABLED = enabled;
      const response = await request(app).get('/api/operations/features').expect(200);
      assert.equal(response.body.campaignAlternativesEnabled, enabled);
      assert.equal(env.CAMPAIGN_ALTERNATIVES_ENABLED, enabled);
    }
  } finally {
    env.CAMPAIGN_ALTERNATIVES_ENABLED = previous;
  }
});
