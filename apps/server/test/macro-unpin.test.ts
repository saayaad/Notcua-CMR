import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSqliteClient } from '../src/database/sqlite-client.js';
import { SequenceService } from '../src/modules/attendance/sequence.service.js';
import type { MessagingService } from '../src/modules/attendance/messaging.service.js';
import type { WhatsappService } from '../src/modules/whatsapp/whatsapp.service.js';

test('REQ-470: ação rápida desafixa só a conversa escolhida e persiste após reabrir', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'noctua-macro-unpin-'));
  const url = `file:${join(directory, 'test.db').replace(/\\/g, '/')}`;
  let db = createSqliteClient(url);
  try {
    execFileSync(process.execPath, [
      fileURLToPath(new URL('../../../node_modules/prisma/build/index.js', import.meta.url)),
      'migrate', 'deploy', '--schema', fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url)),
    ], { env: { ...process.env, DATABASE_URL: url, RUST_LOG: 'info' }, stdio: 'pipe' });
    const session = await db.whatsappSession.create({ data: { name: 'Fictícia' } });
    const contact = await db.contact.create({ data: { name: 'Primeiro', phoneNumber: '5511999990201' } });
    const other = await db.contact.create({ data: { name: 'Segundo', phoneNumber: '5511999990202' } });
    const chat = await db.conversation.create({ data: { sessionId: session.id, contactId: contact.id, pinned: true } });
    const otherChat = await db.conversation.create({ data: { sessionId: session.id, contactId: other.id, pinned: true } });
    const macro = await db.macro.create({ data: { id: 'unpin-ficticia', name: 'Desafixar fictícia', actions: {
      create: { position: 0, type: 'TEXT', payload: { type: 'utility', command: 'UNPIN' } },
    } } });
    let sends = 0;
    const whatsapp = {
      connectedSocket: () => ({}),
      notify: () => undefined,
    } as unknown as WhatsappService;
    const messaging = {
      chat: async (sessionId: string, conversationId: string) => {
        const found = await db.conversation.findFirst({
          where: { id: conversationId, sessionId }, include: { contact: true },
        });
        if (!found) throw new Error('Conversa fora da conexão');
        return { ...found, jid: `${found.contact.phoneNumber}@s.whatsapp.net` };
      },
      send: async () => { sends++; },
    } as unknown as MessagingService;
    const worker = new SequenceService(db, whatsapp, messaging);
    try {
      const run = await worker.enqueue(session.id, chat.id, 'MACRO', macro.id, 'unpin-ficticia-request');
      await worker.flush();
      assert.equal((await db.sequenceRun.findUniqueOrThrow({ where: { id: run.id } })).status, 'COMPLETED');
      assert.equal((await db.conversation.findUniqueOrThrow({ where: { id: chat.id } })).pinned, false);
      assert.equal((await db.conversation.findUniqueOrThrow({ where: { id: otherChat.id } })).pinned, true);
      assert.equal(sends, 0);
    } finally {
      await worker.stop();
    }
    await db.$disconnect();
    db = createSqliteClient(url);
    assert.equal((await db.conversation.findUniqueOrThrow({ where: { id: chat.id } })).pinned, false);
    assert.equal((await db.conversation.findUniqueOrThrow({ where: { id: otherChat.id } })).pinned, true);
  } finally {
    await db.$disconnect();
    const target = resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir()) + '\\') || target.startsWith(resolve(tmpdir()) + '/'));
    await rm(target, { recursive: true, force: true });
  }
});
