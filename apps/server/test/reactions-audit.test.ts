import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { resolve, sep } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { errorHandler } from '../src/http/errors.js';
import { attendanceRoutes } from '../src/modules/attendance/attendance.routes.js';
import { MessagingService } from '../src/modules/attendance/messaging.service.js';
import { SequenceService } from '../src/modules/attendance/sequence.service.js';

const databasePath = process.env.AUDIT_DB_PATH;
assert.ok(databasePath, 'AUDIT_DB_PATH must point to .audit/noctua-audit.db');
const resolvedDatabase = resolve(databasePath);
assert.ok(resolvedDatabase.includes(`${sep}.audit${sep}`), `refusing database outside .audit: ${resolvedDatabase}`);
const db = new PrismaClient({ datasourceUrl: `file:${resolvedDatabase.replace(/\\/g, '/')}?connection_limit=1&socket_timeout=30&pool_timeout=30` });
const prefix = `req680-${process.pid}-${Date.now()}`;
const sessionId = `${prefix}-session`;
const contactId = `${prefix}-contact`;
const conversationId = `${prefix}-conversation`;
const messageId = `${prefix}-message`;
const memberEmail = `${prefix}-member@example.test`;
const adminEmail = `${prefix}-admin@example.test`;
const actorUid = (email: string) => `test:${email}`;
let notifyCount = 0;
let fixturesCreated = false;

const whatsapp = {
  async snapshot() { return {}; },
  notify() { notifyCount += 1; },
} as never;
const messaging = new MessagingService(db, whatsapp);
const sequences = new SequenceService(db, whatsapp, messaging);
const app = express();
app.use(express.json());
app.use(async (req, res, next) => {
  const email = req.header('x-audit-actor');
  if (!email) { res.locals.identity = null; return next(); }
  const row = await db.operationRecord.findUnique({ where: { id: `team:${email}` } });
  const role = (row?.data as { role?: string } | undefined)?.role;
  res.locals.identity = role === 'ADMIN' || role === 'MEMBER'
    ? { uid: actorUid(email), email, role, workspaceId: 'owner' }
    : null;
  next();
});
app.use('/api/attendance', attendanceRoutes(db, whatsapp, sequences, messaging));
app.use(errorHandler);

before(async () => {
  await db.$connect();
  await db.whatsappSession.create({ data: { id: sessionId, name: 'REQ-680 synthetic session' } });
  await db.contact.create({ data: { id: contactId, name: 'REQ-680 synthetic contact', phoneNumber: `${Date.now()}${process.pid}`, whatsappJid: `${Date.now()}${process.pid}@s.whatsapp.net` } });
  await db.conversation.create({ data: { id: conversationId, sessionId, contactId } });
  await db.chatMessage.create({ data: { id: messageId, conversationId, direction: 'INBOUND', status: 'DELIVERED', type: 'text', text: 'REQ-680 mensagem sintética' } });
  await db.operationRecord.createMany({ data: [
    { id: `team:${memberEmail}`, kind: 'TEAM', data: { email: memberEmail, role: 'MEMBER', active: true } },
    { id: `team:${adminEmail}`, kind: 'TEAM', data: { email: adminEmail, role: 'ADMIN', active: true } },
  ] });
  fixturesCreated = true;
});

after(async () => {
  if (fixturesCreated) {
    await db.chatReaction.deleteMany({ where: { messageId } });
    await db.chatMessage.deleteMany({ where: { id: messageId } });
    await db.conversation.deleteMany({ where: { id: conversationId } });
    await db.contact.deleteMany({ where: { id: contactId } });
    await db.whatsappSession.deleteMany({ where: { id: sessionId } });
    await db.operationRecord.deleteMany({ where: { id: { in: [`team:${memberEmail}`, `team:${adminEmail}`] } } });
  }
  await sequences.stop();
  await db.$disconnect();
});

test('REQ-680 persiste, agrega e alterna reações para papéis de teste no .audit', async () => {
  const endpoint = `/api/attendance/sessions/${sessionId}/conversations/${conversationId}/messages/${messageId}/reactions`;
  await request(app).post(endpoint).send({ emoji: '👍' }).expect(403);
  const member = await request(app).post(endpoint).set('x-audit-actor', memberEmail).send({ emoji: '👍' }).expect(200);
  assert.deepEqual(member.body.reactions, [{ emoji: '👍', count: 1, reactedByMe: true }]);
  await request(app).post(endpoint).set('x-audit-actor', adminEmail).send({ emoji: '❤️' }).expect(200);

  const beforeRoleChange = await db.operationRecord.findUniqueOrThrow({ where: { id: `team:${memberEmail}` } });
  await db.operationRecord.update({ where: { id: `team:${memberEmail}` }, data: { data: { email: memberEmail, role: 'ADMIN', active: true } } });
  const changed = await request(app).post(endpoint).set('x-audit-actor', memberEmail).send({ emoji: '😂' }).expect(200);
  assert.equal((beforeRoleChange.data as { role: string }).role, 'MEMBER');
  assert.deepEqual(changed.body.reactions, [
    { emoji: '❤️', count: 1, reactedByMe: false },
    { emoji: '😂', count: 1, reactedByMe: true },
  ]);

  await request(app).post(endpoint).set('x-audit-actor', memberEmail).send({ emoji: '😂' }).expect(200);
  const persisted = await db.chatReaction.findMany({ where: { messageId }, orderBy: { actorId: 'asc' } });
  assert.deepEqual(persisted.map((reaction) => [reaction.actorId, reaction.emoji]), [[actorUid(adminEmail), '❤️']]);
  const messages = await request(app)
    .get(`/api/attendance/sessions/${sessionId}/conversations/${conversationId}/messages?page=1&pageSize=50`)
    .set('x-audit-actor', adminEmail)
    .expect(200);
  assert.deepEqual(messages.body.items[0].reactions, [{ emoji: '❤️', count: 1, reactedByMe: true }]);
  await request(app).post(endpoint).set('x-audit-actor', adminEmail).send({ emoji: '🚀' }).expect(422);
  assert.equal(notifyCount, 4);
});
