import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createSqliteClient } from '../src/database/sqlite-client.js';
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
import { remindNextActions } from '../src/modules/operations/next-actions.js';

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
const db = createSqliteClient(url);
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

test('conversão de voz remove capítulos e metadados da origem para compatibilidade móvel', async () => {
  const ffmpeg = createRequire(import.meta.url)('ffmpeg-static') as string;
  const original = execFileSync(ffmpeg, [
    '-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.3',
    '-metadata', 'CHAPTER000=00:00:00.000', '-metadata', 'CHAPTER000NAME=CAPITULO_TESTE',
    '-metadata', 'title=TITULO_PRIVADO_TESTE', '-c:a', 'libopus', '-f', 'ogg', 'pipe:1',
  ], { windowsHide: true });
  assert.ok(original.includes(Buffer.from('CAPITULO_TESTE')));
  const normalized = Buffer.from(await media.transcodeVoice(original));
  assert.ok(normalized.includes(Buffer.from('OpusHead')));
  assert.equal(normalized.includes(Buffer.from('CHAPTER000')), false);
  assert.equal(normalized.includes(Buffer.from('TITULO_PRIVADO_TESTE')), false);
  const head = normalized.indexOf(Buffer.from('OpusHead'));
  assert.equal(normalized[head + 9], 1);
  assert.equal(normalized.readUInt32LE(head + 12), 48000);
  const decoded = execFileSync(ffmpeg, ['-nostdin', '-v', 'error', '-f', 'ogg', '-i', 'pipe:0', '-f', 's16le', 'pipe:1'],
    { input: normalized, windowsHide: true });
  assert.ok(decoded.length > 0);
});

test('qualquer áudio enviado pelo chat vira mensagem de voz mesmo se o arquivo original era WAV', async () => {
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
  const file = await media.upload({ base64: wav.toString('base64'), mimeType: 'audio/wav', filename: 'voz.wav' });
  await messaging.send(sessionId, conversationId, { requestId: 'ptt-auto', kind: 'audio', fileId: file.id, isPtt: false });
  const sent = socket.sends.at(-1)!.content;
  assert.ok('audio' in sent);
  assert.equal(sent.ptt, true);
  assert.equal(sent.mimetype, 'audio/ogg; codecs=opus');
  const bytes = Buffer.from(sent.audio as Uint8Array);
  assert.equal(bytes.subarray(0, 4).toString(), 'OggS');
  assert.ok(bytes.includes(Buffer.from('OpusHead')));
});

test('vídeo circular e imagem preservam opções, legenda e formato nativo', async () => {
  const ffmpeg = createRequire(import.meta.url)('ffmpeg-static') as string;
  const clip = execFileSync(ffmpeg, [
    '-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=32x32:d=0.1',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-f', 'mp4',
    '-movflags', 'frag_keyframe+empty_moov', 'pipe:1',
  ], { windowsHide: true });
  const video = await media.upload({
    base64: clip.toString('base64'),
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

test('marca d’água é incorporada ao vídeo e GIF mantém os bytes originais', async () => {
  const ffmpeg = createRequire(import.meta.url)('ffmpeg-static') as string;
  const clip = execFileSync(ffmpeg, [
    '-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=32x32:d=0.1',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-f', 'mp4', '-movflags', 'frag_keyframe+empty_moov', 'pipe:1',
  ], { windowsHide: true });
  const overlay = execFileSync(ffmpeg, [
    '-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=32x32',
    '-frames:v', '1', '-c:v', 'png', '-f', 'image2pipe', 'pipe:1',
  ], { windowsHide: true });
  const marked = await media.upload({ base64: clip.toString('base64'), mimeType: 'video/mp4', filename: 'amostra.mp4', watermark: overlay.toString('base64') });
  const stored = await db.storedFile.findUniqueOrThrow({ where: { id: marked.id } });
  const frame = execFileSync(ffmpeg, ['-nostdin', '-v', 'error', '-i', 'pipe:0', '-frames:v', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'], { input: Buffer.from(stored.data), windowsHide: true });
  assert.ok(frame[0]! > 200 && frame[1]! < 50 && frame[2]! < 50, 'o primeiro pixel deve conter a camada vermelha, não o vídeo preto original');
  await assert.rejects(() => media.upload({ base64: clip.toString('base64'), mimeType: 'video/mp4', watermark: Buffer.from('png inválido').toString('base64') }), /marca d’água/);
  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  const preserved = await media.upload({ base64: gif.toString('base64'), mimeType: 'image/gif', filename: 'animacao.gif' });
  const original = await db.storedFile.findUniqueOrThrow({ where: { id: preserved.id } });
  assert.equal(preserved.mimeType, 'image/gif');
  assert.deepEqual(Buffer.from(original.data), gif);
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

test('API cadastra chave PIX fictícia de formato aleatório e gera Copia e Cola e QR sem enviar', async () => {
  const app = createApp(db, whatsapp, sequences, messaging);
  const sendsBefore = socket.sends.length;
  const key = await request(app).post('/api/attendance/pix-keys').send({
    name: 'PIX fictício', type: 'RANDOM', value: 'b3c545dc-5668-4882-8991-31983cc0ed60',
    merchantName: 'Loja Exemplo', merchantCity: 'Sao Paulo',
  }).expect(201);
  const listing = await request(app).get('/api/attendance/library').expect(200);
  assert.equal(listing.body.pixKeys.some((item: { id: string }) => item.id === key.body.id), true);
  const preview = await request(app).post('/api/attendance/pix-preview').send({
    keyId: key.body.id, amountInCents: 15000,
  }).expect(200);
  assert.equal(preview.body.key, key.body.value);
  assert.match(preview.body.payload, /5406150\.00/);
  assert.equal(preview.body.payload.slice(-4), crc16(preview.body.payload.slice(0, -4)));
  assert.match(preview.body.qrDataUrl, /^data:image\/png;base64,/);
  await request(app).post('/api/attendance/pix-preview').send({
    keyId: 'pix-inexistente', amountInCents: 15000,
  }).expect(404);
  await request(app).delete(`/api/attendance/pix-keys/${key.body.id}`).expect(200);
  await request(app).post('/api/attendance/pix-preview').send({ keyId: key.body.id }).expect(404);
  assert.equal(socket.sends.length, sendsBefore);
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

test('funil envia texto, áudio de voz e imagem em ordem com atraso entre etapas', async () => {
  const ffmpeg = createRequire(import.meta.url)('ffmpeg-static') as string;
  const wav = execFileSync(ffmpeg, [
    '-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=523:duration=0.15',
    '-c:a', 'pcm_s16le', '-f', 'wav', 'pipe:1',
  ], { windowsHide: true });
  const png = execFileSync(ffmpeg, [
    '-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=yellow:s=16x16:d=0.1',
    '-frames:v', '1', '-c:v', 'png', '-f', 'image2pipe', 'pipe:1',
  ], { windowsHide: true });
  const voiceFile = await media.upload({
    base64: wav.toString('base64'), filename: 'funil.wav', mimeType: 'audio/wav', voice: true,
  });
  const imageFile = await media.upload({
    base64: png.toString('base64'), filename: 'funil.png', mimeType: 'image/png',
  });
  await db.asset.createMany({ data: [
    { id: 'funnel-media-text', kind: 'MESSAGE', name: 'Abertura', text: 'Olá, #nome' },
    { id: 'funnel-media-voice', kind: 'AUDIO', name: 'Voz', fileId: voiceFile.id, isPtt: true },
    { id: 'funnel-media-image', kind: 'MEDIA', name: 'Imagem', fileId: imageFile.id, caption: 'Prévia para #nome' },
  ] });
  await db.funnel.create({ data: {
    id: 'funnel-multimedia-test', name: 'Funil multimídia',
    items: { create: [
      { assetId: 'funnel-media-text', position: 0, delayBeforeSendMs: 0 },
      { assetId: 'funnel-media-voice', position: 1, delayBeforeSendMs: 10_000 },
      { assetId: 'funnel-media-image', position: 2, delayBeforeSendMs: 0 },
    ] },
  } });
  const before = socket.sends.length;
  const presenceBefore = socket.presence.length;
  const run = await sequences.enqueue(sessionId, conversationId, 'FUNNEL', 'funnel-multimedia-test', 'funnel-multimedia-request');
  await sequences.flush();
  assert.deepEqual(socket.sends.at(-1)?.content, { text: 'Olá, Cliente Exemplo' });
  assert.equal(socket.sends.length, before + 1);
  await sequences.flush();
  assert.equal(socket.sends.length, before + 1);
  assert.ok(socket.presence.slice(presenceBefore).includes('recording'));
  await db.sequenceRun.update({ where: { id: run.id }, data: { nextRunAt: new Date(0) } });
  await sequences.flush();
  const voice = socket.sends.at(-1)?.content as { audio?: Buffer; mimetype?: string; ptt?: boolean };
  assert.equal(socket.sends.length, before + 2);
  assert.ok(Buffer.isBuffer(voice.audio));
  assert.equal(voice.mimetype, 'audio/ogg; codecs=opus');
  assert.equal(voice.ptt, true);
  await sequences.flush();
  const image = socket.sends.at(-1)?.content as { image?: Buffer; caption?: string };
  assert.equal(socket.sends.length, before + 3);
  assert.ok(Buffer.isBuffer(image.image));
  assert.equal(image.caption, 'Prévia para Cliente Exemplo');
  assert.equal((await db.sequenceRun.findUniqueOrThrow({ where: { id: run.id } })).status, 'COMPLETED');
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
  const funnel = await request(app)
    .post('/api/attendance/funnels')
    .send({ name: 'Funil via API', itemsSequence: [{ itemId: asset.body.id, delayBeforeSend: 500 }] })
    .expect(201);
  await request(app)
    .put(`/api/attendance/funnels/${encodeURIComponent(funnel.body.id)}`)
    .send({ name: 'Funil revisado', itemsSequence: [{ itemId: asset.body.id, delayBeforeSend: 1000 }] })
    .expect(200);
  assert.equal((await db.funnel.findUniqueOrThrow({ where: { id: funnel.body.id } })).name, 'Funil revisado');
  const absentId = 'funnel:excluido';
  await request(app)
    .put(`/api/attendance/funnels/${encodeURIComponent(absentId)}`)
    .send({ name: 'Funil excluído', itemsSequence: [{ itemId: asset.body.id, delayBeforeSend: 0 }] })
    .expect(404);
  assert.equal(await db.funnel.findUnique({ where: { id: absentId } }), null);
  await request(app)
    .delete(`/api/attendance/assets/${encodeURIComponent(asset.body.id)}`)
    .expect(409);
  const other = await whatsapp.create('Outra conexão');
  await request(app)
    .post(`/api/attendance/sessions/${other.id}/conversations/${conversationId}/send`)
    .send({ requestId: 'wrong-session', kind: 'text', text: 'Não enviar' })
    .expect(404);
});

test('biblioteca cria, edita, lista, baixa e exclui áudio, imagem, vídeo e documento', async () => {
  const app = createApp(db, whatsapp, sequences, messaging);
  const sendsBefore = socket.sends.length;
  const ffmpeg = createRequire(import.meta.url)('ffmpeg-static') as string;
  const wav = execFileSync(ffmpeg, [
    '-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.15',
    '-c:a', 'pcm_s16le', '-f', 'wav', 'pipe:1',
  ], { windowsHide: true });
  const png = execFileSync(ffmpeg, [
    '-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=16x16:d=0.1',
    '-frames:v', '1', '-c:v', 'png', '-f', 'image2pipe', 'pipe:1',
  ], { windowsHide: true });
  const mp4 = execFileSync(ffmpeg, [
    '-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=32x32:d=0.1',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-f', 'mp4',
    '-movflags', 'frag_keyframe+empty_moov', 'pipe:1',
  ], { windowsHide: true });
  const fixtures = [
    { kind: 'AUDIO', filename: 'voz.wav', mimeType: 'audio/wav', bytes: wav, voice: true },
    { kind: 'MEDIA', filename: 'foto.png', mimeType: 'image/png', bytes: png, voice: false },
    { kind: 'MEDIA', filename: 'video.mp4', mimeType: 'video/mp4', bytes: mp4, voice: false },
    { kind: 'DOCUMENT', filename: 'contrato.pdf', mimeType: 'application/pdf', bytes: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF'), voice: false },
  ] as const;
  for (const [index, fixture] of fixtures.entries()) {
    const uploaded = await request(app).post('/api/attendance/files').send({
      base64: fixture.bytes.toString('base64'),
      filename: fixture.filename,
      mimeType: fixture.mimeType,
      voice: fixture.voice,
    }).expect(201);
    assert.ok(uploaded.body.id);
    const created = await request(app).post('/api/attendance/assets').send({
      kind: fixture.kind,
      name: `Auditoria multimídia ${index}`,
      fileId: uploaded.body.id,
      caption: 'Versão inicial',
      isPtt: fixture.kind === 'AUDIO',
    }).expect(201);
    const id = created.body.id as string;
    await request(app).put(`/api/attendance/assets/${encodeURIComponent(id)}`).send({
      kind: fixture.kind,
      name: `Auditoria revisada ${index}`,
      fileId: uploaded.body.id,
      caption: 'Legenda revisada',
      isPtt: fixture.kind === 'AUDIO',
    }).expect(200);
    const listing = await request(app).get('/api/attendance/library').expect(200);
    const listed = listing.body.assets.find((asset: { id: string }) => asset.id === id);
    assert.equal(listed?.name, `Auditoria revisada ${index}`);
    assert.equal(listed?.caption, 'Legenda revisada');
    assert.equal(listed?.file?.id, uploaded.body.id);
    const download = await request(app).get(`/api/attendance/assets/${encodeURIComponent(id)}/file`).expect(200);
    assert.match(String(download.headers['content-disposition']), /attachment/i);
    const stored = await db.storedFile.findUniqueOrThrow({ where: { id: uploaded.body.id } });
    assert.equal(download.headers['content-type'], stored.mimeType);
    assert.equal(Number(download.headers['content-length']), stored.byteLength);
    assert.deepEqual(Buffer.from(download.body as Buffer), Buffer.from(stored.data));
    await request(app).delete(`/api/attendance/assets/${encodeURIComponent(id)}`).expect(200);
    const afterDelete = await request(app).get('/api/attendance/library').expect(200);
    assert.equal(afterDelete.body.assets.some((asset: { id: string }) => asset.id === id), false);
    await request(app).put(`/api/attendance/assets/${encodeURIComponent(id)}`).send({
      kind: fixture.kind,
      name: 'Item excluído',
      fileId: uploaded.body.id,
    }).expect(404);
  }
  assert.equal(socket.sends.length, sendsBefore);
});

test('notas internas não enviam WhatsApp e a paginação intercala notas e mensagens sem repetir itens', async () => {
  const app = createApp(db, whatsapp, sequences, messaging);
  const contact = await db.$transaction((tx) =>
    resolveContact(tx, { jid: '5511888880011@s.whatsapp.net', name: 'Notas privadas' }),
  );
  const chat = await db.conversation.create({ data: { sessionId, contactId: contact!.id } });
  const start = Date.now() - 60_000;
  await db.chatMessage.createMany({
    data: [1, 3, 5].map((offset) => ({
      id: `timeline-message-${offset}`,
      conversationId: chat.id,
      direction: 'INBOUND' as const,
      status: 'DELIVERED' as const,
      text: `Mensagem ${offset}`,
      sentAt: new Date(start + offset * 1000),
    })),
  });
  await db.operationRecord.createMany({
    data: [2, 4].map((offset) => ({
      id: `timeline-note-${offset}`,
      kind: offset === 2 ? 'INTERNAL_NOTE' : `INTERNAL_NOTE:${chat.id}`,
      data: {
        conversationId: chat.id,
        text: `Nota ${offset}`,
        author: 'Equipe',
        sentAt: new Date(start + offset * 1000).toISOString(),
      },
    })),
  });
  const ids: string[] = [];
  for (const page of [1, 2, 3]) {
    const result = await request(app)
      .get(`/api/attendance/sessions/${sessionId}/conversations/${chat.id}/messages?page=${page}&pageSize=2`)
      .expect(200);
    assert.equal(result.body.total, 5);
    ids.push(...result.body.items.map((item: { id: string }) => item.id));
    assert.ok(result.body.items.every((item: Record<string, unknown>) => !('rawPayload' in item)));
  }
  assert.deepEqual(ids, [
    'timeline-message-5',
    'timeline-note-4',
    'timeline-message-3',
    'timeline-note-2',
    'timeline-message-1',
  ]);
  const sentBefore = socket.sends.length;
  const messagesBefore = await db.chatMessage.count({ where: { conversationId: chat.id } });
  const note = await request(app)
    .post(`/api/attendance/sessions/${sessionId}/conversations/${chat.id}/internal-notes`)
    .send({ text: 'Somente a equipe deve ler.' })
    .expect(201);
  assert.equal(note.body.internal, true);
  assert.equal(socket.sends.length, sentBefore);
  assert.equal(await db.chatMessage.count({ where: { conversationId: chat.id } }), messagesBefore);
  assert.equal(
    (await db.operationRecord.findUniqueOrThrow({ where: { id: note.body.id } })).kind,
    `INTERNAL_NOTE:${chat.id}`,
  );
});

test('fila SLA ordena antes de paginar e não mistura arquivadas com ativas', async () => {
  const app = createApp(db, whatsapp, sequences, messaging);
  const ids: string[] = [];
  for (const [index, age] of [30, 20, 1].entries()) {
    const contact = await db.$transaction((tx) =>
      resolveContact(tx, { jid: `551188888002${index}@s.whatsapp.net`, name: `Fila revisão ${index}` }),
    );
    const sentAt = new Date(Date.now() - age * 60_000);
    const chat = await db.conversation.create({
      data: { sessionId, contactId: contact!.id, lastMessageAt: sentAt, pinned: index === 2 },
    });
    await db.chatMessage.create({
      data: {
        conversationId: chat.id,
        direction: index === 2 ? 'OUTBOUND' : 'INBOUND',
        status: 'SENT',
        text: 'Conteúdo fictício',
        sentAt,
      },
    });
    ids.push(chat.id);
  }
  for (const page of [1, 2, 3]) {
    const result = await request(app)
      .get(
        `/api/attendance/sessions/${sessionId}/conversations?search=${encodeURIComponent('Fila revisão')}&page=${page}&pageSize=1`,
      )
      .expect(200);
    assert.equal(result.body.total, 3);
    assert.equal(result.body.items[0].id, ids[page - 1]);
  }
  await db.conversation.update({ where: { id: ids[2] }, data: { status: 'CLOSED' } });
  const archived = await request(app)
    .get(
      `/api/attendance/sessions/${sessionId}/conversations?search=${encodeURIComponent('Fila revisão')}&filter=archived`,
    )
    .expect(200);
  assert.deepEqual(
    archived.body.items.map((item: { id: string }) => item.id),
    [ids[2]],
  );
});

test('o nome Noctua é fixo ao salvar preferências', async () => {
  const app = createApp(db, whatsapp, sequences, messaging);
  const response = await request(app)
    .put('/api/operations/settings/preferences')
    .send({ brandingName: 'Outro nome', hudPanelOrder: ['list', 'chat', 'tools'] })
    .expect(200);
  assert.equal(response.body.brandingName, 'noctua');
});

test('resposta padrão exige confirmação e retoma o mesmo envio sem duplicar partes', async () => {
  const app = createApp(db, whatsapp, sequences, messaging);
  const base = `/api/operations/sessions/${sessionId}/standard-replies`;
  const resource = await db.asset.create({
    data: {
      id: 'standard-resource',
      kind: 'MESSAGE',
      name: 'Complemento padrão',
      text: 'Complemento de exemplo.',
    },
  });
  const before = socket.sends.length;
  const created = await request(app)
    .post(base)
    .send({
      question: 'Como acompanho meu pedido?',
      text: 'Você pode acompanhar pelo painel.',
      assetIds: [resource.id],
    })
    .expect(201);
  assert.equal(socket.sends.length, before);
  const sendId = crypto.randomUUID();
  await request(app)
    .post(`${base}/${created.body.id}/send`)
    .send({ conversationId, requestId: sendId, confirmed: false })
    .expect(422);
  assert.equal(socket.sends.length, before);
  const body = { conversationId, requestId: sendId, confirmed: true };
  await request(app).post(`${base}/${created.body.id}/send`).send(body).expect(200);
  await request(app).post(`${base}/${created.body.id}/send`).send(body).expect(200);
  assert.equal(socket.sends.length, before + 2);
  await request(app).delete(`/api/attendance/assets/${resource.id}`).expect(409);
  const other = await whatsapp.create('Escopo padrão');
  await request(app)
    .put(`/api/operations/sessions/${other.id}/standard-replies/${created.body.id}`)
    .send({ question: 'Outra pergunta?', text: 'Não deve modificar.' })
    .expect(404);
  await request(app).delete(`${base}/${created.body.id}`).expect(200);
  await request(app).delete(`/api/attendance/assets/${resource.id}`).expect(200);
});

test('próxima ação cria um único lembrete interno e nunca envia ao cliente', async () => {
  const app = createApp(db, whatsapp, sequences, messaging);
  const before = socket.sends.length;
  const path = `/api/operations/sessions/${sessionId}/contacts/${conversationId}/next-action`;
  const dueAt = new Date(Date.now() - 60000).toISOString();
  await request(app)
    .put(path)
    .send({ title: 'Retornar orçamento de teste', dueAt, completed: false })
    .expect(200);
  await remindNextActions(db, () => undefined);
  await remindNextActions(db, () => undefined);
  const notices = await db.operationRecord.findMany({
    where: { kind: 'NOTICE', id: { startsWith: `next-action-notice:next-action:${conversationId}:` } },
  });
  assert.equal(notices.length, 1);
  assert.equal(socket.sends.length, before);
  await request(app)
    .put(path)
    .send({ title: 'Retornar orçamento de teste', dueAt, completed: true })
    .expect(200);
  assert.equal((await request(app).get(path).expect(200)).body.completed, true);
});

test('sequência pode pausar e retomar preservando espera e sem envio durante a pausa', async () => {
  await db.funnel.create({
    data: {
      id: 'pause-funnel',
      name: 'Funil pausável',
      items: { create: [{ assetId: 'hello', position: 0, delayBeforeSendMs: 30000 }] },
    },
  });
  const before = socket.sends.length;
  const run = await sequences.enqueue(sessionId, conversationId, 'FUNNEL', 'pause-funnel', 'pause-test');
  const paused = await sequences.pause(sessionId, conversationId, run.id, true);
  assert.equal(paused.status, 'WAITING_INPUT');
  await sequences.flush();
  assert.equal(socket.sends.length, before);
  const app = createApp(db, whatsapp, sequences, messaging);
  const list = await request(app)
    .get(`/api/attendance/sessions/${sessionId}/conversations/${conversationId}/sequences`)
    .expect(200);
  assert.equal(list.body.items.find((item: { id: string }) => item.id === run.id).status, 'PAUSED');
  const resumed = await sequences.pause(sessionId, conversationId, run.id, false);
  assert.equal(resumed.status, 'QUEUED');
  assert.ok(resumed.nextRunAt.getTime() > Date.now() + 20000);
  await sequences.pause(sessionId, conversationId, run.id, true);
  await sequences.cancel(sessionId, conversationId, run.id);
  assert.equal((await db.sequenceRun.findUniqueOrThrow({ where: { id: run.id } })).status, 'CANCELLED');
});
