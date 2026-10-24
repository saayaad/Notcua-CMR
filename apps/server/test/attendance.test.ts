import { after, before, test } from 'node:test';
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
import type { WhatsappSocket } from '../src/modules/whatsapp/socket-factory.js';
import { WhatsappService } from '../src/modules/whatsapp/whatsapp.service.js';
import { CredentialCipher } from '../src/modules/whatsapp/credential-cipher.js';
import { MessagingService } from '../src/modules/attendance/messaging.service.js';
import { SequenceService } from '../src/modules/attendance/sequence.service.js';
import { MediaService } from '../src/modules/attendance/media.service.js';
import { crc16, pixKeySchema, pixPayload } from '../src/modules/attendance/pix.js';
import { resolveContact } from '../src/modules/whatsapp/contact.repository.js';
import { silentPublisher } from '../src/modules/whatsapp/whatsapp.types.js';
import { createApp } from '../src/app.js';

class OutboundSocket implements WhatsappSocket {
  ev = makeEventBuffer(pino({ level: 'silent' }));
  user = { id: '5511999990000@s.whatsapp.net' };
  sends: { jid: string; content: AnyMessageContent }[] = [];
  presence: string[] = [];
  fail = false;
  async end() {}
  async logout() {}
  async profilePictureUrl() {
    return undefined;
  }
  async resyncAppState() {}
  async addChatLabel() {}
  async removeChatLabel() {}
  async readMessages() {}
  async sendPresenceUpdate(type: string) {
    this.presence.push(type);
  }
  async sendMessage(
    jid: string,
    content: AnyMessageContent,
    options?: { messageId?: string },
  ): Promise<WAMessage> {
    this.sends.push({ jid, content });
    if (this.fail) throw new Error('Timeout simulado');
    const message: WAMessage = {
      key: { remoteJid: jid, id: options?.messageId ?? 'fake', fromMe: true },
      message: { conversation: 'text' in content ? content.text : 'Mídia' },
      messageTimestamp: Math.floor(Date.now() / 1000),
    };
    this.ev.emit('messages.upsert', { messages: [message], type: 'notify' });
    return message;
  }
}
const directory = await mkdtemp(join(tmpdir(), 'noctua-attendance-'));
const url = `file:${join(directory, 'test.db').replace(/\\/g, '/')}`;
const db = new PrismaClient({ datasourceUrl: url });
const socket = new OutboundSocket();
const whatsapp = new WhatsappService(
  db,
  new CredentialCipher(randomBytes(32)),
  silentPublisher,
  () => socket,
);
const messaging = new MessagingService(db, whatsapp);
const sequences = new SequenceService(db, whatsapp, messaging);
const media = new MediaService(db);
let sessionId = '';
let conversationId = '';
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
  sessionId = (await whatsapp.create('Atendimento simulado')).id;
  await whatsapp.connect(sessionId);
  socket.ev.emit('connection.update', { connection: 'open' });
  await whatsapp.idle(sessionId);
  const contact = await db.$transaction((tx) =>
    resolveContact(tx, { jid: '5511888880000@s.whatsapp.net', name: 'Cliente Exemplo' }),
  );
  conversationId = (await db.conversation.create({ data: { sessionId, contactId: contact!.id } })).id;
});
after(async () => {
  await sequences.stop();
  await whatsapp.shutdown();
  await db.$disconnect();
  await rm(directory, { recursive: true, force: true });
});

test('texto personaliza #nome, reserva ID remoto e não duplica requisições ou eco do WhatsApp', async () => {
  const input = { requestId: 'same-text', kind: 'text', text: 'Olá, *#nome*! Tudo bem?' };
  const before = socket.sends.length;
  const [first, repeated] = await Promise.all([
    messaging.send(sessionId, conversationId, input),
    messaging.send(sessionId, conversationId, input),
  ]);
  await whatsapp.idle(sessionId);
  assert.equal(first.id, repeated.id);
  assert.equal(socket.sends.length, before + 1);
  assert.deepEqual(socket.sends.at(-1)!.content, { text: 'Olá, *Cliente Exemplo*! Tudo bem?' });
  assert.equal(
    await db.chatMessage.count({ where: { conversationId, whatsappMessageId: first.whatsappMessageId } }),
    1,
  );
  await assert.rejects(
    messaging.send(sessionId, conversationId, { ...input, text: 'Outro texto' }),
    /outra mensagem/,
  );
});

test('envio sem confirmação fica FAILED e nunca é repetido automaticamente', async () => {
  socket.fail = true;
  const before = socket.sends.length;
  const input = { requestId: 'timeout', kind: 'text', text: 'Mensagem de teste' };
  await assert.rejects(messaging.send(sessionId, conversationId, input), /não foi confirmado/);
  socket.fail = false;
  await assert.rejects(messaging.send(sessionId, conversationId, input), /envio anterior/);
  assert.equal(socket.sends.length, before + 1);
  assert.equal((await db.chatMessage.findUniqueOrThrow({ where: { id: 'out:timeout' } })).status, 'FAILED');
});

test('conversão real de WAV produz OGG/Opus; PTT e visualização única chegam ao socket', async () => {
  const samples = 8000;
  const pcm = Buffer.alloc(samples * 2);
  const wav = Buffer.alloc(44 + pcm.length);
  wav.write('RIFF');
  wav.writeUInt32LE(36 + pcm.length, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(pcm.length, 40);
  pcm.copy(wav, 44);
  const file = await media.upload({
    base64: wav.toString('base64'),
    mimeType: 'audio/wav',
    filename: 'teste.wav',
    voice: true,
  });
  const stored = await db.storedFile.findUniqueOrThrow({ where: { id: file.id } });
  assert.equal(Buffer.from(stored.data).subarray(0, 4).toString(), 'OggS');
  assert.ok(Buffer.from(stored.data).includes(Buffer.from('OpusHead')));
  await messaging.send(sessionId, conversationId, {
    requestId: 'ptt',
    kind: 'audio',
    fileId: file.id,
    isPtt: true,
    asViewOnce: true,
  });
  const content = socket.sends.at(-1)!.content;
  assert.ok('audio' in content);
  assert.equal(content.ptt, true);
  assert.equal(content.viewOnce, true);
  const message = await db.chatMessage.findUniqueOrThrow({ where: { id: 'out:ptt' } });
  await assert.rejects(messaging.media(sessionId, conversationId, message.id), /visualização única/);
});

test('vídeo circular e imagem preservam opções, legenda e formato nativo', async () => {
  const video = await media.upload({
    base64: Buffer.from('video-de-teste').toString('base64'),
    filename: 'clip.mp4',
    mimeType: 'video/mp4',
  });
  await messaging.send(sessionId, conversationId, {
    requestId: 'ptv',
    kind: 'video',
    fileId: video.id,
    isPtv: true,
    caption: 'Veja, #nome',
    asViewOnce: true,
  });
  const content = socket.sends.at(-1)!.content;
  assert.ok('video' in content);
  assert.equal(content.ptv, true);
  assert.equal(content.viewOnce, true);
  assert.equal(content.caption, 'Veja, Cliente Exemplo');
  await assert.rejects(
    messaging.send(sessionId, conversationId, { requestId: 'wrong-file', kind: 'image', fileId: video.id }),
    /tipo do arquivo/,
  );
});

test('PIX usa TLV, moeda BRL e CRC16; chave aleatória deve existir no banco do recebedor', () => {
  assert.equal(crc16('123456789'), '29B1');
  const value = pixPayload(
    {
      value: '123e4567-e89b-42d3-a456-426614174000',
      merchantName: 'Empresa Exemplo',
      merchantCity: 'São Paulo',
    },
    12345,
    'PEDIDO1',
  );
  assert.ok(value.includes('br.gov.bcb.pix'));
  assert.ok(value.includes('5406123.45'));
  assert.equal(value.slice(-4), crc16(value.slice(0, -4)));
  assert.ok(value.includes('SAO PAULO'));
  assert.equal(
    pixKeySchema.safeParse({
      name: 'Pix',
      type: 'RANDOM',
      value: 'inventada',
      merchantName: 'Empresa',
      merchantCity: 'Cidade',
    }).success,
    false,
  );
});

test('funil aguarda o intervalo, usa snapshot e pode ser cancelado sem enviar a próxima etapa', async () => {
  await db.asset.create({ data: { id: 'hello', kind: 'MESSAGE', name: 'Olá', text: 'Bom dia, #nome' } });
  await db.funnel.create({
    data: {
      id: 'funnel-test',
      name: 'Funil de teste',
      items: {
        create: [
          { assetId: 'hello', position: 0, delayBeforeSendMs: 30_000 },
          { assetId: 'hello', position: 1, delayBeforeSendMs: 30_000 },
        ],
      },
    },
  });
  const before = socket.sends.length;
  const run = await sequences.enqueue(sessionId, conversationId, 'FUNNEL', 'funnel-test', 'sequence-request');
  assert.equal(
    (await sequences.enqueue(sessionId, conversationId, 'FUNNEL', 'funnel-test', 'sequence-request')).id,
    run.id,
  );
  await sequences.flush();
  assert.equal(socket.sends.length, before);
  assert.ok(socket.presence.includes('composing'));
  await db.asset.update({ where: { id: 'hello' }, data: { text: 'Texto alterado' } });
  await db.sequenceRun.update({ where: { id: run.id }, data: { nextRunAt: new Date(0) } });
  await sequences.flush();
  assert.equal(socket.sends.length, before + 1);
  assert.deepEqual(socket.sends.at(-1)!.content, { text: 'Bom dia, Cliente Exemplo' });
  await sequences.cancel(sessionId, conversationId, run.id);
  await sequences.flush();
  assert.equal(socket.sends.length, before + 1);
  assert.equal((await db.sequenceRun.findUniqueOrThrow({ where: { id: run.id } })).status, 'CANCELLED');
});

test('API filtra, protege escopo, salva ativos/funis/notas e entrega o histórico', async () => {
  const app = createApp(db, whatsapp, sequences, messaging);
  const library = await request(app)
    .get('/api/attendance/library')
    .set('Origin', 'http://127.0.0.1:5173')
    .expect(200);
  assert.equal(library.headers['access-control-allow-origin'], 'http://127.0.0.1:5173');
  assert.ok(library.body.assets.every((asset: Record<string, unknown>) => !('metadata' in asset)));
  await request(app)
    .get('/api/attendance/library')
    .set('Origin', 'https://origem-invalida.example')
    .expect(403);
  const listed = await request(app)
    .get(`/api/attendance/sessions/${sessionId}/conversations?search=Cliente`)
    .expect(200);
  assert.equal(listed.body.total, 1);
  await request(app)
    .get(`/api/attendance/sessions/${sessionId}/conversations/${conversationId}/messages`)
    .expect(200);
  await request(app)
    .put(`/api/attendance/sessions/${sessionId}/conversations/${conversationId}`)
    .send({ note: 'Nota de teste' })
    .expect(200);
  const asset = await request(app)
    .post('/api/attendance/assets')
    .send({ kind: 'MESSAGE', name: 'Resposta via API', text: 'Oi, #nome' })
    .expect(201);
  await request(app)
    .post('/api/attendance/funnels')
    .send({ name: 'Funil via API', itemsSequence: [{ itemId: asset.body.id, delayBeforeSend: 500 }] })
    .expect(201);
  await request(app)
    .delete(`/api/attendance/assets/${encodeURIComponent(asset.body.id)}`)
    .expect(409);
  const other = await whatsapp.create('Outra conexão');
  await request(app)
    .post(`/api/attendance/sessions/${other.id}/conversations/${conversationId}/send`)
    .send({ requestId: 'wrong-session', kind: 'text', text: 'Não enviar' })
    .expect(404);
});
