import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { makeEventBuffer, type AuthenticationState, type WAMessage } from '@whiskeysockets/baileys';
import { LabelAssociationType } from '@whiskeysockets/baileys/lib/Types/LabelAssociation.js';
import { pino } from 'pino';
import { createSqliteClient } from '../src/database/sqlite-client.js';
import request from 'supertest';
import { io as clientIo } from 'socket.io-client';
import { CredentialCipher } from '../src/modules/whatsapp/credential-cipher.js';
import { createAuthStore } from '../src/modules/whatsapp/auth-store.js';
import { WhatsappService } from '../src/modules/whatsapp/whatsapp.service.js';
import { SyncService } from '../src/modules/whatsapp/sync.service.js';
import { LabelOutbox } from '../src/modules/whatsapp/label-outbox.js';
import type { WhatsappSocket } from '../src/modules/whatsapp/socket-factory.js';
import { silentPublisher, type SessionSnapshot, type SyncNotice } from '../src/modules/whatsapp/whatsapp.types.js';
import { createApp } from '../src/app.js';
import { attachRealtime } from '../src/realtime/socket.js';
import { env } from '../src/config/env.js';

class FakeSocket implements WhatsappSocket {
  readonly ev = makeEventBuffer(pino({ level: 'silent' }));
  user = { id: '5511999990000:7@s.whatsapp.net' };
  ended = 0;
  loggedOut = false;
  failLabels = false;
  profilePicture: string | undefined;
  labels: { jid: string; label: string }[] = [];
  async end() {
    this.ended++;
  }
  async logout() {
    this.loggedOut = true;
  }
  async profilePictureUrl() {
    return this.profilePicture;
  }
  async resyncAppState() {}
  async addChatLabel(jid: string, label: string) {
    if (this.failLabels) throw new Error('Offline');
    this.labels.push({ jid, label });
  }
}

const directory = await mkdtemp(join(tmpdir(), 'noctua-wa-'));
const databaseUrl = `file:${join(directory, 'whatsapp.db').replace(/\\/g, '/')}`;
const db = createSqliteClient(databaseUrl);
const cipher = new CredentialCipher(randomBytes(32));
const sockets: FakeSocket[] = [];
const authStates: AuthenticationState[] = [];
const snapshots: SessionSnapshot[] = [];
const syncNotices: SyncNotice[] = [];
const service = new WhatsappService(
  db,
  cipher,
  {
    ...silentPublisher,
    state: (state) => {
      snapshots.push(state);
    },
    sync: (notice) => {
      syncNotices.push(notice);
    },
  },
  (auth) => {
    authStates.push(auth);
    const socket = new FakeSocket();
    sockets.push(socket);
    return socket;
  },
);
const sync = new SyncService(db, silentPublisher);
let sessionId: string;

const message = (jid: string, id: string, fromMe = false, text = 'Olá', at = 1_792_779_000): WAMessage => ({
  key: { remoteJid: jid, id, fromMe },
  message: { conversation: text },
  messageTimestamp: at,
});

before(async () => {
  const cli = fileURLToPath(new URL('../../../node_modules/prisma/build/index.js', import.meta.url));
  const schema = fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url));
  execFileSync(process.execPath, [cli, 'migrate', 'deploy', '--schema', schema], {
    env: { ...process.env, RUST_LOG: 'info', DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
  await db.$connect();
  sessionId = (await service.create('Atendimento de teste')).id;
});
after(async () => {
  await service.shutdown();
  await db.$disconnect();
  await rm(directory, { recursive: true, force: true });
});

test('REQ-017: contacts.upsert sincroniza contato e persiste após reabrir SQLite', async () => {
  const isolated = await service.create('REQ-017 conexão fictícia');
  const phoneNumber = '5511777000017';
  const jid = `${phoneNumber}@s.whatsapp.net`;
  try {
    await service.connect(isolated.id);
    const socket = sockets.at(-1)!;
    socket.ev.emit('connection.update', { connection: 'open' });
    await service.idle(isolated.id);
    socket.ev.emit('contacts.upsert', [{ id: jid, phoneNumber, name: 'Contato REQ-017' }]);
    await service.idle(isolated.id);

    const reopened = createSqliteClient(databaseUrl);
    try {
      await reopened.$connect();
      const contact = await reopened.contact.findUnique({ where: { phoneNumber } });
      assert.ok(contact);
      assert.equal(contact.name, 'Contato REQ-017');
      assert.equal(contact.whatsappJid, jid);
      assert.ok(syncNotices.some((notice) => notice.sessionId === isolated.id && notice.kind === 'contacts'));
    } finally {
      await reopened.$disconnect();
    }
  } finally {
    await service.disconnect(isolated.id);
  }
});

test('REQ-018: evento de contato busca foto fictícia e persiste após reabrir SQLite', async () => {
  const isolated = await service.create('REQ-018 conexão fictícia');
  const phoneNumber = '5511777000018';
  const jid = `${phoneNumber}@s.whatsapp.net`;
  const picture = 'https://example.invalid/req-018-profile.png';
  try {
    await service.connect(isolated.id);
    const socket = sockets.at(-1)!;
    socket.profilePicture = picture;
    socket.ev.emit('connection.update', { connection: 'open' });
    await service.idle(isolated.id);
    socket.ev.emit('contacts.upsert', [{ id: jid, phoneNumber, name: 'Contato REQ-018' }]);
    await service.idle(isolated.id);

    const deadline = Date.now() + 5_000;
    let profilePicture: string | null | undefined;
    while (Date.now() < deadline && !profilePicture) {
      profilePicture = (await db.contact.findUnique({ where: { phoneNumber }, select: { profilePicture: true } }))?.profilePicture;
      if (!profilePicture) await delay(100);
    }
    assert.equal(profilePicture, picture);

    const reopened = createSqliteClient(databaseUrl);
    try {
      await reopened.$connect();
      const contact = await reopened.contact.findUnique({ where: { phoneNumber } });
      assert.equal(contact?.profilePicture, picture);
    } finally {
      await reopened.$disconnect();
    }
  } finally {
    await service.disconnect(isolated.id);
  }
});

test('REQ-019: histórico recebido sincroniza contatos, conversa, mensagens e progresso', async () => {
  const isolated = await service.create('REQ-019 conexão fictícia');
  const phoneNumber = '5511777000019';
  const jid = `${phoneNumber}@s.whatsapp.net`;
  const noticeStart = syncNotices.length;
  try {
    await service.connect(isolated.id);
    const socket = sockets.at(-1)!;
    socket.ev.emit('connection.update', { connection: 'open' });
    await service.idle(isolated.id);
    socket.ev.emit('messaging-history.set', {
      contacts: [{ id: jid, phoneNumber, name: 'Contato REQ-019' }],
      chats: [{ id: jid, name: 'Contato REQ-019', conversationTimestamp: 1_792_779_000, unreadCount: 1 }],
      messages: [message(jid, 'req-019-history', false, 'Histórico fictício')],
      progress: 73,
      isLatest: false,
    });
    await service.idle(isolated.id);

    const reopened = createSqliteClient(databaseUrl);
    try {
      await reopened.$connect();
      const contact = await reopened.contact.findUniqueOrThrow({ where: { phoneNumber } });
      const conversation = await reopened.conversation.findUniqueOrThrow({
        where: { sessionId_contactId: { sessionId: isolated.id, contactId: contact.id } },
      });
      assert.equal(conversation.hasHistory, true);
      assert.equal(await reopened.chatMessage.count({ where: { conversationId: conversation.id, whatsappMessageId: 'req-019-history' } }), 1);
      assert.ok(syncNotices.slice(noticeStart).some((notice) =>
        notice.sessionId === isolated.id && notice.kind === 'history' && notice.count === 1 && notice.progress === 73,
      ));
    } finally {
      await reopened.$disconnect();
    }
  } finally {
    await service.disconnect(isolated.id);
  }
});

test('cifra autenticada preserva bytes e detecta chave errada ou adulteração', async () => {
  const value = { secret: 'segredo-privado', buffer: Buffer.from([1, 2, 3]) };
  const encrypted = cipher.encrypt(value);
  assert.equal(encrypted.includes(Buffer.from(value.secret)), false);
  const decoded = cipher.decrypt<typeof value>(encrypted);
  assert.equal(decoded.secret, value.secret);
  assert.deepEqual(decoded.buffer, value.buffer);
  const altered = Buffer.from(encrypted);
  altered[altered.length - 1]! ^= 1;
  assert.throws(() => cipher.decrypt(altered), /chave original/);
  assert.throws(() => new CredentialCipher(randomBytes(32)).decrypt(encrypted), /chave original/);
  const filename = join(directory, 'keys', 'auth.key');
  const first = await CredentialCipher.load(filename);
  const second = await CredentialCipher.load(filename);
  assert.deepEqual(second.decrypt(first.encrypt(value)), value);
});

test('auth store persiste credenciais e categorias Signal v7, incluindo exclusão', async () => {
  const auth = await createAuthStore(db, sessionId, cipher);
  await auth.state.keys.set({
    'lid-mapping': { lid: '5511' },
    'device-list': { user: ['1', '2'] },
    tctoken: { a: { token: Buffer.from('token') } },
  });
  auth.state.creds.registered = true;
  await auth.save();
  const restored = await createAuthStore(db, sessionId, cipher);
  assert.equal(restored.state.creds.registered, true);
  assert.equal((await restored.state.keys.get('lid-mapping', ['lid'])).lid, '5511');
  assert.deepEqual((await restored.state.keys.get('device-list', ['user'])).user, ['1', '2']);
  assert.equal(Buffer.from((await restored.state.keys.get('tctoken', ['a'])).a!.token).toString(), 'token');
  await restored.state.keys.set({ 'lid-mapping': { lid: null } });
  assert.deepEqual(await restored.state.keys.get('lid-mapping', ['lid']), {});
});

test('conectar é idempotente; QR só fica em memória; abrir limpa QR e pausar ignora eventos antigos', async () => {
  const previousCount = sockets.length;
  await Promise.all([service.connect(sessionId), service.connect(sessionId)]);
  assert.equal(sockets.length, previousCount + 1);
  const socket = sockets.at(-1)!;
  socket.ev.emit('connection.update', { qr: 'qr-de-teste-nao-conecta-conta' });
  await service.idle(sessionId);
  const waiting = await service.snapshot(sessionId);
  assert.equal(waiting.status, 'AWAITING_QR');
  assert.match(waiting.qrDataUrl!, /^data:image\/png;base64,/);
  socket.ev.emit('connection.update', { connection: 'open' });
  await service.idle(sessionId);
  assert.equal((await service.snapshot(sessionId)).status, 'CONNECTED');
  assert.equal((await service.snapshot(sessionId)).qrDataUrl, null);
  assert.equal((await service.snapshot(sessionId)).phoneNumber, '5511999990000');
  await service.disconnect(sessionId);
  socket.ev.emit('connection.update', { connection: 'open' });
  await service.idle(sessionId);
  assert.equal((await service.snapshot(sessionId)).status, 'DISCONNECTED');
  assert.equal((await db.whatsappAuthEntry.count({ where: { sessionId } })) > 0, true);
  assert.equal(
    snapshots.some((state) => state.status === 'AWAITING_QR'),
    true,
  );
});

test('restartRequired reconecta; logout remoto apaga apenas as credenciais da sessão', async () => {
  await service.connect(sessionId);
  const socket = sockets.at(-1)!;
  const previousCount = sockets.length;
  socket.ev.emit('connection.update', {
    connection: 'close',
    lastDisconnect: {
      error: Object.assign(new Error('Restart'), { output: { statusCode: 515 } }),
      date: new Date(),
    },
  });
  await service.idle(sessionId);
  await delay(650);
  await service.idle(sessionId);
  assert.equal(sockets.length, previousCount + 1);
  const other = await service.create('Outra sessão');
  await (await createAuthStore(db, other.id, cipher)).save();
  sockets
    .at(-1)!
    .ev.emit('connection.update', {
      connection: 'close',
      lastDisconnect: {
        error: Object.assign(new Error('Logged out'), { output: { statusCode: 401 } }),
        date: new Date(),
      },
    });
  await service.idle(sessionId);
  assert.equal((await service.snapshot(sessionId)).status, 'DISCONNECTED');
  assert.equal((await service.snapshot(sessionId)).autoConnect, false);
  assert.equal(await db.whatsappAuthEntry.count({ where: { sessionId } }), 0);
  assert.equal(await db.whatsappAuthEntry.count({ where: { sessionId: other.id } }), 1);
});

test('REQ-020: eventos WhatsApp importam etiqueta com origem e preservam vínculos', async () => {
  await service.connect(sessionId);
  const socket = sockets.at(-1)!;
  socket.ev.emit('connection.update', { connection: 'open' });
  await service.idle(sessionId);
  socket.ev.emit('labels.association', {
    type: 'add',
    association: { type: LabelAssociationType.Chat, chatId: '5511888880000@s.whatsapp.net', labelId: '7' },
  });
  socket.ev.emit('labels.edit', { id: '7', name: 'Novo lead', color: 2, deleted: false });
  await service.idle(sessionId);
  const label = await db.label.findUniqueOrThrow({
    where: { id: `wa:${sessionId}:7` },
    include: { contacts: true },
  });
  assert.equal(label.createReason, 'Importado do whatsapp');
  assert.equal(label.whatsappColor, 2);
  assert.match(label.color, /^#[0-9A-F]{6}$/);
  assert.equal(label.contacts.length, 1);
  await db.sessionSettings.update({
    where: { sessionId },
    data: { autoLabelFirstMessage: true, firstMessageLabelId: label.id },
  });
  await service.disconnect(sessionId);
});

test('desvinculação pausada exige conexão; falha remota não apaga credenciais', async () => {
  const target = await service.create('Desvinculação segura');
  await (await createAuthStore(db, target.id, cipher)).save();
  await assert.rejects(service.disconnect(target.id, true), /Conecte a sessão/);
  assert.equal(await db.whatsappAuthEntry.count({ where: { sessionId: target.id } }), 1);
  await service.connect(target.id);
  const socket = sockets.at(-1)!;
  socket.ev.emit('connection.update', { connection: 'open' });
  await service.idle(target.id);
  socket.logout = async () => {
    throw new Error('Offline');
  };
  await assert.rejects(service.disconnect(target.id, true), /não confirmou/);
  assert.equal(await db.whatsappAuthEntry.count({ where: { sessionId: target.id } }), 1);
  assert.equal((await service.snapshot(target.id)).status, 'CONNECTED');
  socket.logout = async () => {
    socket.loggedOut = true;
  };
  await service.disconnect(target.id, true);
  assert.equal(socket.loggedOut, true);
  assert.equal(await db.whatsappAuthEntry.count({ where: { sessionId: target.id } }), 0);
});

test('primeira mensagem nova etiqueta uma vez; histórico, grupos, replays e eventos técnicos não disparam', async () => {
  const jid = '5511777770000@s.whatsapp.net';
  await sync.messagesUpsert(sessionId, [message(jid, 'live-1')], true);
  await sync.messagesUpsert(sessionId, [message(jid, 'live-1')], true);
  await sync.messagesUpsert(sessionId, [message(jid, 'live-2')], true);
  const contact = await db.contact.findUniqueOrThrow({
    where: { phoneNumber: '5511777770000' },
    include: { labels: true },
  });
  assert.equal(contact.labels.length, 1);
  const chat = await db.conversation.findUniqueOrThrow({
    where: { sessionId_contactId: { sessionId, contactId: contact.id } },
  });
  assert.equal(chat.unreadCount, 2);
  assert.equal(await db.chatMessage.count({ where: { conversationId: chat.id } }), 2);
  assert.equal(await db.scheduledJob.count({ where: { type: 'WHATSAPP_ADD_LABEL' } }), 1);
  const old = '5511666660000@s.whatsapp.net';
  await sync.chatsUpsert(sessionId, [{ id: old, name: 'Antigo' }], true);
  await sync.messagesUpsert(sessionId, [message(old, 'old-live')], true);
  await sync.messagesUpsert(sessionId, [message('5511555550000@s.whatsapp.net', 'history-1')], false);
  await sync.messagesUpsert(sessionId, [message('12345-67890@g.us', 'group-1')], true);
  await sync.messagesUpsert(
    sessionId,
    [
      {
        key: { remoteJid: '5511444440000@s.whatsapp.net', id: 'protocol' },
        message: { protocolMessage: {} },
      },
    ],
    true,
  );
  for (const number of ['5511666660000', '5511555550000']) {
    assert.equal(await db.contactLabel.count({ where: { contact: { phoneNumber: number } } }), 0);
  }
  assert.equal(await db.contactLabel.count({ where: { contact: { isGroup: true } } }), 0);
  assert.equal(await db.contact.count({ where: { phoneNumber: '5511444440000' } }), 0);
});

test('REQ-398/REQ-399/REQ-400: referral CTWA conserva campanha, descrição e etiqueta de anúncio', async () => {
  const sync = new SyncService(db, silentPublisher);
  const label = await db.label.create({ data: { id: 'req400-anuncio-label', sessionId, name: 'Anúncio' } });
  const jid = '5511777771030@s.whatsapp.net';
  await sync.messagesUpsert(sessionId, [{
    key: { remoteJid: jid, id: 'req398-referral', fromMe: false },
    message: { extendedTextMessage: {
      text: 'Tenho interesse nesta oferta.',
      contextInfo: { externalAdReply: { title: 'Campanha de teste', body: 'Oferta local de auditoria', sourceUrl: 'https://example.com/anuncio' } },
    } },
    messageTimestamp: Math.floor(Date.now() / 1000),
  } as unknown as WAMessage], true);
  const contact = await db.contact.findUniqueOrThrow({ where: { phoneNumber: '5511777771030' }, include: { labels: true } });
  const referral = (contact.metadata as { adReferral?: { source?: string; title?: string; body?: string; url?: string } }).adReferral;
  assert.equal(referral?.source, 'WhatsApp Ads');
  assert.equal(referral?.title, 'Campanha de teste');
  assert.equal(referral?.body, 'Oferta local de auditoria');
  assert.equal(referral?.url, 'https://example.com/anuncio');
  assert.ok(contact.labels.some((item) => item.labelId === label.id));
});

test('REQ-411/REQ-412/REQ-413: opt-out normaliza pedido, cancela fila futura e etiqueta contato', async () => {
  const sync = new SyncService(db, silentPublisher);
  const jid = '5511777771031@s.whatsapp.net';
  await sync.messagesUpsert(sessionId, [message(jid, 'req411-initial', false, 'Olá')], true);
  const contact = await db.contact.findUniqueOrThrow({ where: { phoneNumber: '5511777771031' } });
  const chat = await db.conversation.findUniqueOrThrow({ where: { sessionId_contactId: { sessionId, contactId: contact.id } } });
  const blocked = await db.label.create({ data: { id: 'req413-opt-out-label', sessionId, name: 'Bloqueado/Opt-out' } });
  await db.operationRecord.upsert({
    where: { id: 'settings:opt-out' },
    create: { id: 'settings:opt-out', kind: 'SETTINGS', data: { terms: ['parar', 'sair', 'não quero mais'] } },
    update: { data: { terms: ['parar', 'sair', 'não quero mais'] } },
  });
  const queued = [
    { batchId: 'req412-campaign-queue', mode: 'CAMPAIGN', payload: { kind: 'text', text: 'Não enviar' } },
    { batchId: 'req412-schedule-queue', mode: 'SCHEDULE', payload: { kind: 'sequence', steps: [] } },
    { batchId: 'req412-reminder-queue', mode: 'REMINDER', payload: { kind: 'reminder', text: 'Lembrete interno' } },
  ];
  for (const [index, batch] of queued.entries()) {
    await db.operationRecord.create({ data: { id: batch.batchId, kind: 'BATCH', data: { name: batch.batchId, sessionId, status: 'ACTIVE', mode: batch.mode } } });
    await db.deliveryTask.create({
      data: { id: `req412-task-${index}`, batchId: batch.batchId, sessionId, conversationId: chat.id, status: 'QUEUED', payload: batch.payload, runAt: new Date(Date.now() + 60_000) },
    });
  }
  await sync.messagesUpsert(sessionId, [{
    key: { remoteJid: jid, id: 'req411-opt-out', fromMe: false },
    message: { conversation: 'NÃO QUERO MAIS, obrigado.' },
    messageTimestamp: Math.floor(Date.now() / 1000),
  }], true);
  const updated = await db.contact.findUniqueOrThrow({ where: { id: contact.id }, include: { labels: true } });
  assert.equal((updated.metadata as { optOut?: boolean }).optOut, true);
  assert.ok(updated.labels.some((item) => item.labelId === blocked.id));
  assert.equal(await db.deliveryTask.findUniqueOrThrow({ where: { id: 'req412-task-0' } }).then((task) => task.status), 'CANCELLED');
  assert.equal(await db.deliveryTask.findUniqueOrThrow({ where: { id: 'req412-task-1' } }).then((task) => task.status), 'CANCELLED');
  assert.equal(await db.deliveryTask.findUniqueOrThrow({ where: { id: 'req412-task-2' } }).then((task) => task.status), 'QUEUED');
});

test('REQ-145: última interação conserva o horário mais recente após sincronização fora de ordem', async () => {
  const jid = '5511777770099@s.whatsapp.net';
  const latest = 1_792_800_000;
  await sync.messagesUpsert(sessionId, [message(jid, 'recent', false, 'Recente', latest)], false);
  await sync.messagesUpsert(sessionId, [message(jid, 'older', false, 'Antiga', latest - 3600)], false);
  await sync.chatsUpsert(sessionId, [{ id: jid, conversationTimestamp: latest - 7200 }], true);
  const chat = await db.conversation.findFirstOrThrow({ where: { sessionId, contact: { phoneNumber: '5511777770099' } } });
  assert.equal(chat.lastMessageAt?.getTime(), latest * 1000);
});

test('exclusão recebida preserva texto e só marca a conversa de origem', async () => {
  const firstJid = '5511777771001@s.whatsapp.net';
  const secondJid = '5511777771002@s.whatsapp.net';
  await sync.messagesUpsert(sessionId, [message(firstJid, 'id-compartilhado', false, 'Texto preservado')], false);
  await sync.messagesUpsert(sessionId, [message(secondJid, 'id-compartilhado', false, 'Outro texto')], false);
  await sync.messagesUpsert(sessionId, [{
    key: { remoteJid: firstJid, id: 'evento-exclusao', fromMe: false },
    message: { protocolMessage: { type: 0, key: { id: 'id-compartilhado', remoteJid: firstJid } } },
  }], true);
  const first = await db.chatMessage.findFirstOrThrow({
    where: { whatsappMessageId: 'id-compartilhado', conversation: { contact: { phoneNumber: '5511777771001' } } },
  });
  const second = await db.chatMessage.findFirstOrThrow({
    where: { whatsappMessageId: 'id-compartilhado', conversation: { contact: { phoneNumber: '5511777771002' } } },
  });
  assert.equal(first.text, 'Texto preservado');
  assert.equal((first.rawPayload as { deletedByClient?: boolean }).deletedByClient, true);
  assert.equal(second.text, 'Outro texto');
  assert.equal((second.rawPayload as { deletedByClient?: boolean }).deletedByClient, undefined);
});

test('REQ-267 arquiva a cópia fictícia de imagem ao receber exclusão e mantém o selo', async () => {
  const jid = '5511777771010@s.whatsapp.net';
  const retainingSync = new SyncService(db, silentPublisher, async () => ({
    data: Buffer.from('imagem fictícia preservada'),
    filename: 'recebida.png',
    mimeType: 'image/png',
  }));
  const original = {
    key: { remoteJid: jid, id: 'req-267-image', fromMe: false },
    message: { imageMessage: { mimetype: 'image/png', url: 'https://media.invalid/fake', mediaKey: randomBytes(32) } },
    messageTimestamp: 1_792_779_000,
  } as unknown as WAMessage;
  await retainingSync.messagesUpsert(sessionId, [original], false);
  await retainingSync.messagesUpsert(sessionId, [{
    key: { remoteJid: jid, id: 'req-267-revoke', fromMe: false },
    message: { protocolMessage: { type: 0, key: { id: 'req-267-image', remoteJid: jid } } },
  }], true);
  const message = await db.chatMessage.findFirstOrThrow({
    where: { whatsappMessageId: 'req-267-image', conversation: { sessionId, contact: { phoneNumber: '5511777771010' } } },
    include: { file: true },
  });
  assert.equal((message.rawPayload as { deletedByClient?: boolean }).deletedByClient, true);
  assert.equal(message.file?.filename, 'recebida.png');
  assert.equal(Buffer.from(message.file!.data).toString(), 'imagem fictícia preservada');
});

test('fila de etiquetas tenta novamente após falha e conclui sem reenviar mensagens', async () => {
  const socket = new FakeSocket();
  const outbox = new LabelOutbox(db, () => socket);
  socket.failLabels = true;
  await outbox.flush();
  const job = await db.scheduledJob.findFirstOrThrow({ where: { type: 'WHATSAPP_ADD_LABEL' } });
  assert.equal(job.status, 'QUEUED');
  assert.equal(job.attempts, 1);
  socket.failLabels = false;
  await db.scheduledJob.update({ where: { id: job.id }, data: { runAt: new Date(0) } });
  await outbox.flush();
  assert.equal((await db.scheduledJob.findUniqueOrThrow({ where: { id: job.id } })).status, 'COMPLETED');
  assert.equal(socket.labels.length, 1);
  await outbox.flush();
  assert.equal(socket.labels.length, 1);
  await outbox.stop();
});

test('eventos atrasados não rebaixam uma mensagem já lida', async () => {
  const key = { remoteJid: '5511777770000@s.whatsapp.net', id: 'live-1' };
  await sync.messageUpdates(sessionId, [{ key, update: { status: 4 } }]);
  await sync.messageUpdates(sessionId, [{ key, update: { status: 2 } }]);
  const row = await db.chatMessage.findFirstOrThrow({
    where: { whatsappMessageId: 'live-1', conversation: { sessionId } },
  });
  assert.equal(row.status, 'READ');
});

test('unifica LID e telefone preservando mensagens, etiquetas e contatos importados', async () => {
  const pn = '5511333330000@s.whatsapp.net';
  const lid = '987654321@lid';
  await db.contact.create({ data: { phoneNumber: '5511333330000', name: 'Contato do backup' } });
  await sync.messagesUpsert(sessionId, [message(pn, 'pn-message')], false);
  await sync.messagesUpsert(sessionId, [message(lid, 'lid-message')], false);
  assert.equal(await db.whatsappIdentity.count({ where: { jid: { in: [pn, lid] } } }), 2);
  await sync.mapping(sessionId, { pn, lid });
  const aliases = await db.whatsappIdentity.findMany({ where: { jid: { in: [pn, lid] } } });
  assert.equal(aliases[0]!.contactId, aliases[1]!.contactId);
  assert.equal(await db.conversation.count({ where: { sessionId, contactId: aliases[0]!.contactId } }), 1);
  assert.equal(
    await db.chatMessage.count({ where: { conversation: { contactId: aliases[0]!.contactId } } }),
    2,
  );
  assert.equal(await db.contact.count({ where: { phoneNumber: `lid:${lid}` } }), 0);
});

test('excluir etiqueta no WhatsApp remove vínculos e desativa a regra sem apagar o histórico', async () => {
  await sync.labelEdit(sessionId, { id: '7', name: 'Novo lead', color: 2, deleted: true });
  const labelId = `wa:${sessionId}:7`;
  assert.equal(await db.contactLabel.count({ where: { labelId } }), 0);
  assert.equal(
    (await db.sessionSettings.findUniqueOrThrow({ where: { sessionId } })).autoLabelFirstMessage,
    false,
  );
  assert.equal((await db.label.findUniqueOrThrow({ where: { id: labelId } })).isDeleted, true);
  assert.ok((await db.chatMessage.count()) > 0);
});

test('rotas entregam painel, dados paginados e configuração; validam origem, sessão e etiqueta', async () => {
  const app = createApp(db, service);
  await request(app).get('/').expect(302).expect('Location', '/atendimento');
  await request(app).get('/whatsapp').expect(200).expect('Content-Type', /html/);
  await request(app).get('/connection-assets/connection.js').expect(200);
  await request(app).post('/api/whatsapp/sessions').send({ name: '' }).expect(422);
  await request(app).get('/api/whatsapp/sessions/missing').expect(404);
  await request(app)
    .post(`/api/whatsapp/sessions/${sessionId}/connect`)
    .set('Origin', 'https://untrusted.example')
    .expect(403);
  const created = await request(app)
    .post(`/api/whatsapp/sessions/${sessionId}/labels`)
    .send({ name: 'Local' })
    .expect(201);
  const summary = await request(app).get(`/api/whatsapp/sessions/${sessionId}/summary`).expect(200);
  assert.equal(summary.body.labels, 0);
  await request(app)
    .put(`/api/whatsapp/sessions/${sessionId}/settings`)
    .send({ autoLabelFirstMessage: true, firstMessageLabelId: created.body.id })
    .expect(200);
  await request(app)
    .put(`/api/whatsapp/sessions/${sessionId}/settings`)
    .send({ autoLabelFirstMessage: true, firstMessageLabelId: null })
    .expect(422);
  await request(app).post(`/api/whatsapp/sessions/${sessionId}/resync-labels`).expect(409);
  const chats = await request(app)
    .get(`/api/whatsapp/sessions/${sessionId}/conversations?pageSize=2`)
    .expect(200);
  assert.equal(chats.body.items.length, 2);
  const other = (await service.create('Sessão isolada')).id;
  await request(app)
    .get(`/api/whatsapp/sessions/${other}/conversations/${chats.body.items[0].id}/messages`)
    .expect(404);
});

test('REQ-139: Socket.io entrega estado atual ao reconectar e rejeita token inválido', async () => {
  const server = createServer(createApp(db, service));
  const originalToken = env.API_TOKEN;
  env.API_TOKEN = 'socket-test-token';
  const io = attachRealtime(server, () => service.list());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}`;
  const good = clientIo(url, {
    auth: { token: 'socket-test-token' },
    transports: ['websocket'],
    autoConnect: false,
    reconnection: false,
  });
  const bad = clientIo(url, {
    auth: { token: 'invalid' },
    transports: ['websocket'],
    autoConnect: false,
    reconnection: false,
  });
  try {
    const received = new Promise<SessionSnapshot>((resolve, reject) => {
      good.once('whatsapp:state', resolve);
      good.once('connect_error', reject);
      good.timeout(3000);
    });
    good.connect();
    assert.ok((await received).id);
    const rejected = new Promise<Error>((resolve) => {
      bad.once('connect_error', resolve);
    });
    bad.connect();
    assert.match((await rejected).message, /Token/);
  } finally {
    good.disconnect();
    bad.disconnect();
    await new Promise<void>((resolve) => io.close(() => resolve()));
    env.API_TOKEN = originalToken;
  }
});
