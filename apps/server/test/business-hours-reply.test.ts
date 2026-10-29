import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createSqliteClient } from '../src/database/sqlite-client.js';
import { BusinessHoursReplyWorker, withinBusinessHours } from '../src/modules/operations/business-hours-reply.js';
import { putRecord } from '../src/modules/operations/records.js';

test('REQ-109: resposta fora do horário usa dia de São Paulo, persiste limite diário e ignora grupos/opt-out', async () => {
  const schedule = { days: [1, 2, 3, 4, 5], minTime: '08:00', maxTime: '18:00' };
  assert.equal(withinBusinessHours(schedule, new Date('2026-10-30T11:00:00Z')), true);
  assert.equal(withinBusinessHours(schedule, new Date('2026-10-30T10:59:00Z')), false);
  assert.equal(withinBusinessHours(schedule, new Date('2026-10-30T21:00:00Z')), false);
  assert.equal(withinBusinessHours(schedule, new Date('2026-11-01T12:00:00Z')), false);
  const overnight = { days: [1], minTime: '22:00', maxTime: '02:00' };
  assert.equal(withinBusinessHours(overnight, new Date('2026-11-03T04:00:00Z')), true);
  assert.equal(withinBusinessHours(overnight, new Date('2026-11-03T06:00:00Z')), false);

  const directory = await mkdtemp(join(tmpdir(), 'noctua-business-hours-'));
  const database = join(directory, 'test.db');
  const url = `file:${database.replace(/\\/g, '/')}`;
  let db = createSqliteClient(url);
  try {
    execFileSync(process.execPath, [
      fileURLToPath(new URL('../../../node_modules/prisma/build/index.js', import.meta.url)),
      'migrate', 'deploy', '--schema', fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url)),
    ], { env: { ...process.env, DATABASE_URL: url, RUST_LOG: 'info' }, stdio: 'pipe' });
    const session = await db.whatsappSession.create({ data: { name: 'Sessão fictícia' } });
    const contact = await db.contact.create({ data: { name: 'Lead fictício', phoneNumber: '5511999990001' } });
    const chat = await db.conversation.create({ data: { sessionId: session.id, contactId: contact.id } });
    const secondSession = await db.whatsappSession.create({ data: { name: 'Segunda sessão fictícia' } });
    const secondChat = await db.conversation.create({ data: { sessionId: secondSession.id, contactId: contact.id } });
    const group = await db.contact.create({ data: { name: 'Grupo fictício', phoneNumber: '5511999990002', isGroup: true } });
    const groupChat = await db.conversation.create({ data: { sessionId: session.id, contactId: group.id } });
    const optedOut = await db.contact.create({ data: { name: 'Bloqueado fictício', phoneNumber: '5511999990003', metadata: { optOut: true } } });
    const optedChat = await db.conversation.create({ data: { sessionId: session.id, contactId: optedOut.id } });
    const calls: { sessionId: string; conversationId: string; input: { requestId: string; text: string } }[] = [];
    const sender = { send: async (sessionId: string, conversationId: string, raw: unknown) => {
      calls.push({ sessionId, conversationId, input: raw as { requestId: string; text: string } });
    } };
    let clock = new Date('2026-10-30T19:00:00Z');
    const worker = new BusinessHoursReplyWorker(db, sender, () => clock);
    const inbound = async (conversationId: string, id: string, receivedAt: string) => {
      await db.chatMessage.create({ data: { id, conversationId, direction: 'INBOUND', text: 'Olá', sentAt: new Date(receivedAt) } });
      await db.flowInboxEvent.create({ data: { messageId: id, conversationId, receivedAt: new Date(receivedAt) } });
    };
    await worker.start();
    try {
      await inbound(chat.id, 'disabled', '2026-10-30T19:30:00Z');
      await worker.flush();
      assert.equal(calls.length, 0);
      await putRecord(db, 'settings:business', 'SETTINGS', {
        schedule, afterHoursReplyEnabled: true, afterHoursReplyText: 'Retornaremos no próximo horário.',
      });
      await inbound(chat.id, 'inside', '2026-10-30T20:00:00Z');
      await worker.flush();
      assert.equal(calls.length, 0);
      await inbound(chat.id, 'outside-1', '2026-10-30T21:00:00Z');
      clock = new Date('2026-10-30T21:01:00Z');
      await worker.flush();
      assert.equal(calls.length, 1);
      assert.equal(calls[0]!.conversationId, chat.id);
      assert.equal(calls[0]!.input.text, 'Retornaremos no próximo horário.');
      await inbound(chat.id, 'outside-2', '2026-10-30T22:00:00Z');
      await inbound(secondChat.id, 'outside-second-session', '2026-10-30T22:00:30Z');
      await inbound(groupChat.id, 'group', '2026-10-30T22:01:00Z');
      await inbound(optedChat.id, 'opted', '2026-10-30T22:02:00Z');
      await worker.flush();
      assert.equal(calls.length, 1);
      await inbound(chat.id, 'next-day', '2026-10-31T03:30:00Z');
      clock = new Date('2026-10-31T03:31:00Z');
      await worker.flush();
      assert.equal(calls.length, 2);
      assert.notEqual(calls[0]!.input.requestId, calls[1]!.input.requestId);
    } finally {
      await worker.stop();
    }
    await db.$disconnect();
    db = createSqliteClient(url);
    assert.equal(await db.operationRecord.count({ where: { kind: 'AUTO_REPLY' } }), 2);
    assert.ok(await db.operationRecord.findUnique({ where: { id: 'business-hours:last-inbound' } }));
    const resumed = new BusinessHoursReplyWorker(db, sender, () => clock);
    await resumed.start();
    try {
      await db.chatMessage.create({ data: { id: 'same-day-after-restart', conversationId: chat.id, direction: 'INBOUND', text: 'Olá de novo' } });
      await db.flowInboxEvent.create({ data: { messageId: 'same-day-after-restart', conversationId: chat.id, receivedAt: new Date('2026-10-31T04:00:00Z') } });
      clock = new Date('2026-10-31T04:01:00Z');
      await resumed.flush();
      assert.equal(calls.length, 2);
      await inbound(chat.id, 'stale-after-opening', '2026-11-02T07:00:00Z');
      clock = new Date('2026-11-02T12:00:00Z');
      await resumed.flush();
      assert.equal(calls.length, 2);
    } finally {
      await resumed.stop();
    }
  } finally {
    await db.$disconnect();
    const target = resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir()) + '\\') || target.startsWith(resolve(tmpdir()) + '/'));
    await rm(target, { recursive: true, force: true });
  }
});
