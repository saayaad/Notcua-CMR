import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { makeEventBuffer, type AnyMessageContent, type WAMessage } from '@whiskeysockets/baileys';
import { pino } from 'pino';
import request from 'supertest';
import type { WhatsappSocket } from '../src/modules/whatsapp/socket-factory.js';
import { WhatsappService } from '../src/modules/whatsapp/whatsapp.service.js';
import { CredentialCipher } from '../src/modules/whatsapp/credential-cipher.js';
import { silentPublisher } from '../src/modules/whatsapp/whatsapp.types.js';
import { SyncService } from '../src/modules/whatsapp/sync.service.js';
import { MessagingService } from '../src/modules/attendance/messaging.service.js';
import { SequenceService } from '../src/modules/attendance/sequence.service.js';
import { FlowService } from '../src/modules/flows/flow.service.js';
import { FlowEngine } from '../src/modules/flows/flow.engine.js';
import {
  flowNodeData,
  normalizeGraph,
  scheduleMatches,
  triggerMatches,
  type FlowGraph,
} from '../src/modules/flows/flow.graph.js';
import { createApp } from '../src/app.js';

class FakeSocket implements WhatsappSocket {
  ev = makeEventBuffer(pino({ level: 'silent' }));
  user = { id: '5511000000000@s.whatsapp.net' };
  sends: AnyMessageContent[] = [];
  presence: string[] = [];
  async end() {}
  async logout() {}
  async profilePictureUrl() {
    return undefined;
  }
  async resyncAppState() {}
  async addChatLabel() {}
  async sendPresenceUpdate(value: string) {
    this.presence.push(value);
  }
  async sendMessage(
    jid: string,
    content: AnyMessageContent,
    options?: { messageId?: string },
  ): Promise<WAMessage> {
    this.sends.push(content);
    return {
      key: { id: options?.messageId, remoteJid: jid, fromMe: true },
      message: { conversation: 'text' in content ? content.text : 'Mídia simulada' },
    };
  }
}
const directory = await mkdtemp(join(tmpdir(), 'noctua-flows-'));
const databaseUrl = `file:${join(directory, 'flows.db').replace(/\\/g, '/')}`;
const db = new PrismaClient({ datasourceUrl: databaseUrl });
const socket = new FakeSocket();
const wa = new WhatsappService(db, new CredentialCipher(randomBytes(32)), silentPublisher, () => socket);
const messaging = new MessagingService(db, wa);
const sequences = new SequenceService(db, wa, messaging);
const flows = new FlowService(db, wa);
const engine = new FlowEngine(db, wa, messaging);
const sync = new SyncService(db, silentPublisher);
let sessionId = '';
let otherSession = '';
let index = 0;
const node = (id: string, type: FlowGraph['nodes'][number]['type'], data: unknown = {}) => ({
  id,
  type,
  position: { x: index++ * 50, y: 100 },
  data: flowNodeData.parse(data),
});
const graph = (waiting = false): FlowGraph => ({
  nodes: [
    node('start', 'start', { keywordRules: [{ rule: 'equals', keyword: 'oi' }], nextNodeIds: ['question'] }),
    node('question', 'text', { itemId: 'hello', simulationDelay: 0, nextNodeIds: waiting ? ['wait'] : [] }),
    ...(waiting
      ? [
          node('wait', 'user-input', {
            compareRule: 'contains',
            expectedMessages: ['sim'],
            nextNodeIds: ['yes'],
            nextNodeIdOnDifferentAnswer: 'no',
            expirationTimeoutInMs: 60_000,
            nextNodeIdOnExpiration: 'timeout',
          }),
          node('yes', 'text', { itemId: 'yes', simulationDelay: 0 }),
          node('no', 'text', { itemId: 'no', simulationDelay: 0 }),
          node('timeout', 'text', { itemId: 'timeout', simulationDelay: 0 }),
        ]
      : []),
  ],
});
async function prepare(value: FlowGraph) {
  await db.flow.updateMany({ data: { enabled: false, enabledAt: null } });
  await db.flowExecution.updateMany({
    where: { status: { in: ['QUEUED', 'RUNNING', 'WAITING_INPUT'] } },
    data: { status: 'CANCELLED' },
  });
  const created = await flows.create(sessionId, { name: `Fluxo ${index++}` });
  const saved = await flows.save(sessionId, created.id, {
    name: created.name,
    graph: value,
    revision: created.revision,
  });
  const published = await flows.publish(sessionId, created.id, { revision: saved.revision });
  return flows.configure(sessionId, created.id, { revision: published.revision, enabled: true });
}
async function contact() {
  const phoneNumber = `55110000${String(index++).padStart(5, '0')}`;
  const person = await db.contact.create({
    data: { phoneNumber, name: 'Contato Fictício', whatsappJid: `${phoneNumber}@s.whatsapp.net` },
  });
  return db.conversation.create({ data: { sessionId, contactId: person.id } });
}
async function incoming(conversationId: string, text: string, sentAt = new Date()) {
  const message = await db.chatMessage.create({
    data: { conversationId, direction: 'INBOUND', status: 'DELIVERED', text, sentAt },
  });
  await db.flowInboxEvent.create({ data: { messageId: message.id, conversationId, receivedAt: new Date() } });
  return message;
}
async function drain(count = 5) {
  for (let i = 0; i < count; i++) await engine.flush();
}
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
    { env: { ...process.env, RUST_LOG: 'info', DATABASE_URL: databaseUrl }, stdio: 'pipe' },
  );
  sessionId = (await wa.create('Fluxos simulados')).id;
  otherSession = (await wa.create('Outra conexão')).id;
  await wa.connect(sessionId);
  socket.ev.emit('connection.update', { connection: 'open' });
  await wa.idle(sessionId);
  await db.asset.createMany({
    data: [
      { id: 'hello', name: 'Pergunta', kind: 'MESSAGE', text: 'Olá, #nome! Deseja continuar?' },
      { id: 'yes', name: 'Sim', kind: 'MESSAGE', text: 'Resposta aceita.' },
      { id: 'no', name: 'Outra resposta', kind: 'MESSAGE', text: 'Resposta diferente.' },
      { id: 'timeout', name: 'Recuperação', kind: 'MESSAGE', text: 'Ainda podemos ajudar?' },
    ],
  });
});
after(async () => {
  await engine.stop();
  await sequences.stop();
  await wa.shutdown();
  await db.$disconnect();
  await rm(directory, { recursive: true, force: true });
});

test('rascunhos incompletos são salvos; publicação rejeita órfãos, ciclos e recursos incompatíveis', async () => {
  const created = await flows.create(sessionId, { name: 'Incompleto' });
  await assert.rejects(flows.publish(sessionId, created.id, { revision: created.revision }), /Conecte/);
  const cyclic = graph();
  cyclic.nodes[1]!.data.nextNodeIds = ['question'];
  const saved = await flows.save(sessionId, created.id, {
    name: 'Ciclo',
    graph: cyclic,
    revision: created.revision,
  });
  await assert.rejects(flows.publish(sessionId, created.id, { revision: saved.revision }), /ciclo/);
  const orphan = graph();
  orphan.nodes.push(node('orphan', 'delay'));
  const next = await flows.save(sessionId, created.id, {
    name: 'Órfão',
    graph: orphan,
    revision: saved.revision,
  });
  await assert.rejects(flows.publish(sessionId, created.id, { revision: next.revision }), /sem conexão/);
  const bad = graph();
  bad.nodes[1]!.type = 'audio';
  const latest = await flows.save(sessionId, created.id, {
    name: 'Tipo incorreto',
    graph: bad,
    revision: next.revision,
  });
  await assert.rejects(
    flows.publish(sessionId, created.id, { revision: latest.revision }),
    /não corresponde/,
  );
  await assert.rejects(flows.get(otherSession, created.id), /não encontrado/);
  await assert.rejects(
    flows.save(sessionId, created.id, { name: 'Desatualizado', graph: graph(), revision: 0 }),
    /outra janela/,
  );
});

test('horário considera São Paulo, dias úteis e a madrugada de uma janela noturna', () => {
  const data = flowNodeData.parse({ schedule: { days: [5], minTime: '22:00', maxTime: '06:00' } });
  assert.equal(scheduleMatches(data, new Date('2026-10-24T02:00:00-03:00')), true);
  assert.equal(scheduleMatches(data, new Date('2026-10-24T07:00:00-03:00')), false);
  assert.equal(scheduleMatches(data, new Date('2026-10-24T22:00:00-03:00')), false);
});

test('mensagens live geram eventos uma vez; histórico, mensagens antigas e eco de saída não disparam', async () => {
  await prepare(graph());
  const jid = '5511000000999@s.whatsapp.net';
  const message = (id: string, fromMe: boolean, at = Math.floor(Date.now() / 1000)): WAMessage => ({
    key: { id, remoteJid: jid, fromMe },
    messageTimestamp: at,
    message: { conversation: 'oi' },
    pushName: 'Teste Live',
  });
  const before = await db.flowInboxEvent.count();
  await sync.messagesUpsert(sessionId, [message('history', false)], false);
  await sync.messagesUpsert(sessionId, [message('own', true), message('old', false, 1)], true);
  assert.equal(await db.flowInboxEvent.count(), before);
  await sync.messagesUpsert(sessionId, [message('live', false)], true);
  await sync.messagesUpsert(sessionId, [message('live', false)], true);
  assert.equal(await db.flowInboxEvent.count(), before + 1);
  const sends = socket.sends.length;
  await drain();
  assert.equal(socket.sends.length, sends + 1);
  await drain();
  assert.equal(socket.sends.length, sends + 1);
});

test('atraso e snapshot publicado preservam a mensagem mesmo após editar a biblioteca', async () => {
  const value = graph();
  value.nodes[1]!.data.simulationDelay = 30_000;
  await prepare(value);
  const chat = await contact();
  const sends = socket.sends.length;
  await incoming(chat.id, 'OI');
  await engine.flush();
  assert.equal(socket.sends.length, sends);
  assert.ok(socket.presence.includes('composing'));
  await db.asset.update({ where: { id: 'hello' }, data: { text: 'Texto alterado' } });
  await db.flowExecution.updateMany({
    where: { conversationId: chat.id, status: 'QUEUED' },
    data: { nextRunAt: new Date(0) },
  });
  await drain();
  assert.deepEqual(socket.sends.at(-1), { text: 'Olá, Contato Fictício! Deseja continuar?' });
  await db.asset.update({ where: { id: 'hello' }, data: { text: 'Olá, #nome! Deseja continuar?' } });
});

test('resposta rápida entra na espera sem se perder e o caminho compatível é consumido uma vez', async () => {
  await prepare(graph(true));
  const chat = await contact();
  await incoming(chat.id, 'oi');
  await engine.flush();
  const run = await db.flowExecution.findFirstOrThrow({ where: { conversationId: chat.id } });
  assert.equal(run.currentNodeId, 'wait');
  const answer = await incoming(chat.id, 'SIM, quero');
  await drain();
  assert.deepEqual(socket.sends.at(-1), { text: 'Resposta aceita.' });
  assert.equal(
    (await db.flowInboxEvent.findUniqueOrThrow({ where: { messageId: answer.id } })).outcome,
    'answer-matched',
  );
  assert.equal((await db.flowExecution.findUniqueOrThrow({ where: { id: run.id } })).status, 'COMPLETED');
});

test('resposta diferente segue somente o caminho alternativo', async () => {
  await prepare(graph(true));
  const chat = await contact();
  await incoming(chat.id, 'oi');
  await drain(2);
  await incoming(chat.id, 'talvez');
  await drain();
  assert.deepEqual(socket.sends.at(-1), { text: 'Resposta diferente.' });
});

test('expiração envia follow-up e recuperação uma vez, com execução persistente', async () => {
  const value = graph(true);
  value.nodes[2]!.data.followUpData = { enabled: true, itemId: 'no', simulationDelay: 0 };
  await prepare(value);
  const chat = await contact();
  await incoming(chat.id, 'oi');
  await drain(2);
  const run = await db.flowExecution.findFirstOrThrow({ where: { conversationId: chat.id } });
  assert.equal(run.status, 'WAITING_INPUT');
  const before = socket.sends.length;
  await db.flowExecution.update({ where: { id: run.id }, data: { inputExpiresAt: new Date(0) } });
  await drain(5);
  assert.equal(socket.sends.length, before + 2);
  assert.deepEqual(socket.sends.at(-2), { text: 'Resposta diferente.' });
  assert.deepEqual(socket.sends.at(-1), { text: 'Ainda podemos ajudar?' });
  await drain();
  assert.equal(socket.sends.length, before + 2);
});

test('pausar/arquivar cancela as etapas pendentes e restaurar não ativa o fluxo', async () => {
  const value = graph();
  value.nodes[1]!.data.simulationDelay = 30_000;
  const flow = await prepare(value);
  const chat = await contact();
  await incoming(chat.id, 'oi');
  await engine.flush();
  const before = socket.sends.length;
  const paused = await flows.configure(sessionId, flow.id, { revision: flow.revision, enabled: false });
  await drain();
  assert.equal(socket.sends.length, before);
  assert.equal(
    (await db.flowExecution.findFirstOrThrow({ where: { conversationId: chat.id } })).status,
    'CANCELLED',
  );
  const archived = await flows.configure(sessionId, flow.id, { revision: paused.revision, archived: true });
  assert.equal(archived.archived, true);
  const restored = await flows.configure(sessionId, flow.id, {
    revision: archived.revision,
    archived: false,
  });
  assert.equal(restored.enabled, false);
});

test('sequências manuais e fluxos não iniciam juntos na mesma conversa', async () => {
  await prepare(graph(true));
  await db.funnel.create({
    data: {
      id: 'manual',
      name: 'Manual',
      items: { create: { assetId: 'hello', position: 0, delayBeforeSendMs: 0 } },
    },
  });
  const chat = await contact();
  await sequences.enqueue(sessionId, chat.id, 'FUNNEL', 'manual', randomUUID());
  await incoming(chat.id, 'oi');
  await drain();
  assert.equal(await db.flowExecution.count({ where: { conversationId: chat.id } }), 0);
  const other = await contact();
  await incoming(other.id, 'oi');
  await drain(2);
  await assert.rejects(
    sequences.enqueue(sessionId, other.id, 'FUNNEL', 'manual', randomUUID()),
    /fluxo ativo/,
  );
});

test('simulação percorre respostas/expiração sem chamar WhatsApp e as rotas protegem o escopo', async () => {
  const flow = await prepare(graph(true));
  const before = socket.sends.length;
  const messages = await db.chatMessage.count();
  const result = await flows.simulate(sessionId, flow.id, {
    graph: graph(true),
    text: 'oi',
    replies: ['sim'],
  });
  assert.equal(result.sends, 2);
  assert.equal(socket.sends.length, before);
  assert.equal(await db.chatMessage.count(), messages);
  const timeout = await flows.simulate(sessionId, flow.id, { graph: graph(true), text: 'oi', expire: true });
  assert.ok(timeout.trace.some((item) => item.action.includes('esgotado')));
  const group = await flows.simulate(sessionId, flow.id, { graph: graph(true), text: 'oi', isGroup: true });
  assert.equal(group.matches, false);
  const app = createApp(db, wa, sequences, messaging, engine);
  await request(app).get(`/api/automation/sessions/${sessionId}/flows`).expect(200);
  await request(app)
    .get(`/api/automation/sessions/${otherSession}/flows/${encodeURIComponent(flow.id)}`)
    .expect(404);
  await request(app).get(`/api/automation/sessions/${sessionId}/runs`).expect(200);
});

test('reinício não repete uma etapa RUNNING de resultado incerto', async () => {
  await prepare(graph());
  const chat = await contact();
  await incoming(chat.id, 'oi');
  await engine.flush();
  const run = await db.flowExecution.findFirstOrThrow({ where: { conversationId: chat.id } });
  await db.flowExecution.update({ where: { id: run.id }, data: { status: 'RUNNING' } });
  const before = socket.sends.length;
  const restarted = new FlowEngine(db, wa, messaging);
  await restarted.start();
  await restarted.flush();
  await restarted.stop();
  assert.equal((await db.flowExecution.findUniqueOrThrow({ where: { id: run.id } })).status, 'FAILED');
  assert.equal(socket.sends.length, before);
});

test('reinício preserva uma espera agendada e só envia quando ela vence', async () => {
  const value = graph();
  value.nodes[1]!.data.simulationDelay = 60_000;
  await prepare(value);
  const chat = await contact();
  await incoming(chat.id, 'oi');
  await engine.flush();
  const run = await db.flowExecution.findFirstOrThrow({ where: { conversationId: chat.id } });
  const before = socket.sends.length;
  const restarted = new FlowEngine(db, wa, messaging);
  try {
    await restarted.start();
    await restarted.flush();
    assert.equal(socket.sends.length, before);
    assert.equal((await db.flowExecution.findUniqueOrThrow({ where: { id: run.id } })).status, 'QUEUED');
    await db.flowExecution.update({
      where: { id: run.id },
      data: { nextRunAt: new Date(Date.now() - 1000) },
    });
    await restarted.flush();
    await restarted.flush();
    assert.equal(socket.sends.length, before + 1);
    assert.equal((await db.flowExecution.findUniqueOrThrow({ where: { id: run.id } })).status, 'COMPLETED');
  } finally {
    await restarted.stop();
  }
});

test('reinício mantém a espera por resposta e retoma o caminho uma única vez', async () => {
  await prepare(graph(true));
  const chat = await contact();
  await incoming(chat.id, 'oi');
  await drain();
  const run = await db.flowExecution.findFirstOrThrow({ where: { conversationId: chat.id } });
  assert.equal(run.status, 'WAITING_INPUT');
  const before = socket.sends.length;
  const restarted = new FlowEngine(db, wa, messaging);
  try {
    await restarted.start();
    await restarted.flush();
    assert.equal(socket.sends.length, before);
    await incoming(chat.id, 'sim');
    for (let i = 0; i < 4; i++) await restarted.flush();
    assert.equal(socket.sends.length, before + 1);
    assert.equal((await db.flowExecution.findUniqueOrThrow({ where: { id: run.id } })).status, 'COMPLETED');
    assert.deepEqual(socket.sends.at(-1), { text: 'Resposta aceita.' });
  } finally {
    await restarted.stop();
  }
});

test('comparações começa/não contém e gatilho por qualquer mensagem respeitam o filtro de grupos', () => {
  const person = { isGroup: false, isSavedContact: false };
  const at = new Date();
  assert.equal(
    triggerMatches(
      flowNodeData.parse({ keywordRules: [{ rule: 'starts', keyword: 'olá' }] }),
      'Olá, tenho interesse',
      person,
      at,
    ),
    true,
  );
  assert.equal(
    triggerMatches(
      flowNodeData.parse({ keywordRules: [{ rule: 'not-contains', keyword: 'sair' }] }),
      'Quero sair',
      person,
      at,
    ),
    false,
  );
  assert.equal(
    triggerMatches(flowNodeData.parse({ triggerMode: 'any' }), 'Qualquer texto', person, at),
    true,
  );
  assert.equal(
    triggerMatches(
      flowNodeData.parse({ triggerMode: 'any' }),
      'Qualquer texto',
      { ...person, isGroup: true },
      at,
    ),
    false,
  );
});

test('fluxo manual não dispara por mensagem e aplica etiqueta inicial somente ao iniciar', async () => {
  const label = await db.label.create({
    data: { id: `initial:${randomUUID()}`, sessionId, name: 'Fluxo iniciado', color: '#a68bfa' },
  });
  const value = graph();
  value.nodes[0]!.data.triggerMode = 'manual';
  value.nodes[0]!.data.startLabelId = label.id;
  const flow = await prepare(value);
  const chat = await contact();
  await incoming(chat.id, 'oi');
  await drain();
  assert.equal(await db.flowExecution.count({ where: { conversationId: chat.id } }), 0);
  assert.equal(await db.contactLabel.count({ where: { contactId: chat.contactId, labelId: label.id } }), 0);
  await engine.launch(sessionId, flow.id, chat.id);
  assert.equal(await db.contactLabel.count({ where: { contactId: chat.contactId, labelId: label.id } }), 1);
  const before = socket.sends.length;
  await drain();
  assert.equal(socket.sends.length, before + 1);
});
