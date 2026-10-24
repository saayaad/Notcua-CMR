import { DeliveryWorker } from '../src/modules/operations/delivery.worker.js';
// Disposable UI verification: its socket never connects to WhatsApp.
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { PrismaClient } from '@prisma/client';
import { makeEventBuffer, type AnyMessageContent, type WAMessage } from '@whiskeysockets/baileys';
import { pino } from 'pino';
import { createApp } from '../src/app.js';
import { WhatsappService } from '../src/modules/whatsapp/whatsapp.service.js';
import { CredentialCipher } from '../src/modules/whatsapp/credential-cipher.js';
import { RealtimeHub } from '../src/realtime/socket.js';
import { MessagingService } from '../src/modules/attendance/messaging.service.js';
import { SequenceService } from '../src/modules/attendance/sequence.service.js';
import { FlowEngine } from '../src/modules/flows/flow.engine.js';
import { FlowService } from '../src/modules/flows/flow.service.js';
import { LabelOutbox } from '../src/modules/whatsapp/label-outbox.js';
import type { WhatsappSocket } from '../src/modules/whatsapp/socket-factory.js';

class DemoSocket implements WhatsappSocket {
  ev = makeEventBuffer(pino({ level: 'silent' }));
  user = { id: '5511000000000@s.whatsapp.net' };
  async end() {} async logout() {} async profilePictureUrl() { return undefined; }
  async resyncAppState() {} async addChatLabel() {} async removeChatLabel() {}
  async readMessages() {} async sendPresenceUpdate() {}
  async sendMessage(jid: string, content: AnyMessageContent, options?: { messageId?: string }): Promise<WAMessage> {
    return { key: { remoteJid: jid, id: options?.messageId, fromMe: true }, message: { conversation: 'text' in content ? content.text : 'Mídia de demonstração' }, messageTimestamp: Math.floor(Date.now() / 1000) };
  }
}
const directory = await mkdtemp(join(tmpdir(), 'noctua-ui-demo-'));
const databaseUrl = `file:${join(directory, 'demo.db').replace(/\\/g, '/')}`;
execFileSync(process.execPath, [fileURLToPath(new URL('../../../node_modules/prisma/build/index.js', import.meta.url)), 'migrate', 'deploy', '--schema', fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url))], { env: { ...process.env, RUST_LOG: 'info', DATABASE_URL: databaseUrl }, stdio: 'pipe' });
const db = new PrismaClient({ datasourceUrl: databaseUrl }); const socket = new DemoSocket(); const hub = new RealtimeHub();
const whatsapp = new WhatsappService(db, new CredentialCipher(randomBytes(32)), hub, () => socket);
const labelsOutbox = new LabelOutbox(db, () => socket, (sessionId) => hub.sync({ sessionId, kind: 'labels', count: 1 }));
const messaging = new MessagingService(db, whatsapp); const sequences = new SequenceService(db, whatsapp, messaging);
const session = await whatsapp.create('Demonstração fictícia');
await whatsapp.connect(session.id); socket.ev.emit('connection.update', { connection: 'open' }); await whatsapp.idle(session.id);
const labels = [{ id: 'demo-new', name: 'Novo contato', color: '#8b5cf6' }, { id: 'demo-quote', name: 'Orçamento', color: '#e6ac54' }, { id: 'demo-client', name: 'Cliente', color: '#4da88b' }];
await db.label.createMany({ data: labels.map((label) => ({ ...label, sessionId: session.id })) });
const names = ['Marina Costa', 'Rafael Oliveira', 'Camila Santos', 'Lucas Almeida', 'Beatriz Lima', 'Pedro Souza', 'Juliana Melo', 'Bruno Ferreira'];
for (const [index, name] of names.entries()) {
  const phone = `55110000000${String(index).padStart(2, '0')}`;
  const contact = await db.contact.create({ data: { name, phoneNumber: phone, whatsappJid: `${phone}@s.whatsapp.net`, labels: { create: index === 7 ? [] : [{ labelId: labels[index % 3].id }] } } });
  await db.whatsappIdentity.create({ data: { jid: `${phone}@s.whatsapp.net`, contactId: contact.id } });
  const timestamp = Date.now() - index * 900_000;
  const demoChat = await db.conversation.create({ data: { sessionId: session.id, contactId: contact.id, unreadCount: index === 0 ? 2 : 0, lastMessageAt: new Date(timestamp), messages: { create: [
    { direction: 'INBOUND', status: 'READ', text: 'Olá! Gostaria de saber mais sobre os serviços de vocês.', sentAt: new Date(timestamp - 180_000) },
    { direction: 'OUTBOUND', status: 'READ', text: `Olá, ${name.split(' ')[0]}! Que bom receber sua mensagem. Como posso ajudar?`, sentAt: new Date(timestamp - 120_000) },
    { direction: 'INBOUND', status: 'DELIVERED', text: index === 0 ? 'Vocês podem me enviar um orçamento? Tenho interesse em começar esta semana.' : 'Obrigada pelo atendimento! Vou conferir as informações.', sentAt: new Date(timestamp) },
  ] } } });
  await db.crmOpportunity.create({ data: { conversationId: demoChat.id, title: ['Pacote de atendimento', 'Consultoria mensal', 'Plano de acompanhamento'][index % 3], valueInCents: [149000, 85000, 225000, 69000][index % 4], status: index === 2 || index === 5 ? 'WON' : index === 6 ? 'LOST' : 'OPEN', wonAt: index === 2 || index === 5 ? new Date() : null, lostAt: index === 6 ? new Date() : null } });
}
await db.asset.createMany({ data: [{ id: 'demo-hello', kind: 'MESSAGE', name: 'Boas-vindas', text: 'Olá, #nome! Seja bem-vindo. Como posso ajudar?', isFavorite: true }, { id: 'demo-quote-text', kind: 'MESSAGE', name: 'Envio de orçamento', text: 'Vou preparar seu orçamento, #nome. Pode me contar o que precisa?' }] });
await db.funnel.create({ data: { id: 'demo-funnel', name: 'Primeiro atendimento', items: { create: [{ assetId: 'demo-hello', position: 0, delayBeforeSendMs: 2000 }, { assetId: 'demo-quote-text', position: 1, delayBeforeSendMs: 4000 }] } } });
const flows = new FlowEngine(db, whatsapp, messaging);
const service = new FlowService(db, whatsapp);
const demoFlow = await service.create(session.id, { name: 'Boas-vindas e orçamento' });
const savedFlow = await service.save(session.id, demoFlow.id, { name: demoFlow.name, revision: demoFlow.revision, graph: { nodes: [
  { id: 'start', type: 'start', position: { x: 50, y: 140 }, data: { title: 'Primeiro contato', keywordRules: [{ rule: 'contains', keyword: 'oi' }], nextNodeIds: ['hello'] } },
  { id: 'hello', type: 'text', position: { x: 350, y: 140 }, data: { title: 'Receber com atenção', itemId: 'demo-hello', simulationDelay: 1000, nextNodeIds: ['answer'] } },
  { id: 'answer', type: 'user-input', position: { x: 650, y: 140 }, data: { title: 'O cliente tem interesse?', compareRule: 'contains', expectedMessages: ['sim'], expirationTimeoutInMs: 60000, nextNodeIds: ['quote'], followUpData: { itemId: 'demo-hello', enabled: true, simulationDelay: 1000 } } },
  { id: 'quote', type: 'text', position: { x: 950, y: 140 }, data: { title: 'Preparar orçamento', itemId: 'demo-quote-text', simulationDelay: 1000, nextNodeIds: [] } }
] } });
await service.publish(session.id, demoFlow.id, { revision: savedFlow.revision });
const deliveries = new DeliveryWorker(db, whatsapp, messaging, sequences, flows); const app = createApp(db, whatsapp, sequences, messaging, flows);
const http = createServer((req, res) => { if (req.url === '/__verification/stop' && req.method === 'POST') { res.end('Prévia encerrada'); void stop(); } else app(req, res); }); const io = hub.attach(http, () => whatsapp.list());
let closing = false;
const stop = async () => { if (closing) return; closing = true; clearTimeout(expiry); await deliveries.stop(); await flows.stop(); await sequences.stop(); await labelsOutbox.stop(); await whatsapp.shutdown(); await new Promise<void>((resolve) => io.close(() => resolve())); await db.$disconnect(); await rm(directory, { recursive: true, force: true }); };
const expiry = setTimeout(() => void stop(), 15 * 60_000);
await sequences.start(); await deliveries.start(); await flows.start(); await labelsOutbox.start();
http.listen(Number(process.env.PORT ?? 8089), '127.0.0.1', () => { const address = http.address(); if (address && typeof address !== 'string') console.log(`PREVIEW_URL=http://127.0.0.1:${address.port}/atendimento`); });



