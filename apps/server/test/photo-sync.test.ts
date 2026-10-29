import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createSqliteClient } from '../src/database/sqlite-client.js';
import { PhotoSync } from '../src/modules/whatsapp/photo-sync.js';

test('REQ-018: foto disponível persiste, foto privada não interrompe sincronização', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'noctua-photo-sync-'));
  const url = `file:${join(directory, 'test.db').replace(/\\/g, '/')}`;
  let db = createSqliteClient(url);
  try {
    execFileSync(process.execPath, [
      fileURLToPath(new URL('../../../node_modules/prisma/build/index.js', import.meta.url)),
      'migrate', 'deploy', '--schema', fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url)),
    ], { env: { ...process.env, DATABASE_URL: url, RUST_LOG: 'info' }, stdio: 'pipe' });
    const visible = await db.contact.create({ data: { name: 'Foto fictícia', phoneNumber: '5511999990101' } });
    const privateContact = await db.contact.create({ data: { name: 'Privado fictício', phoneNumber: '5511999990102' } });
    const firstJid = '5511999990101@s.whatsapp.net';
    const secondJid = '5511999990102@s.whatsapp.net';
    await db.whatsappIdentity.createMany({ data: [
      { jid: firstJid, contactId: visible.id },
      { jid: secondJid, contactId: privateContact.id },
    ] });
    const notices: string[] = [];
    const photos = new PhotoSync(
      db,
      async (jid) => jid === firstJid ? 'https://example.invalid/foto-ficticia.png' : undefined,
      () => notices.push('contacts'),
    );
    try {
      photos.add([secondJid, firstJid]);
      const deadline = Date.now() + 5_000;
      while (Date.now() < deadline && !(await db.contact.findUniqueOrThrow({ where: { id: visible.id } })).profilePicture)
        await new Promise((done) => setTimeout(done, 100));
      assert.equal((await db.contact.findUniqueOrThrow({ where: { id: visible.id } })).profilePicture, 'https://example.invalid/foto-ficticia.png');
      assert.equal((await db.contact.findUniqueOrThrow({ where: { id: privateContact.id } })).profilePicture, null);
      assert.deepEqual(notices, ['contacts']);
    } finally {
      await photos.stop();
    }
    await db.$disconnect();
    db = createSqliteClient(url);
    assert.equal((await db.contact.findUniqueOrThrow({ where: { id: visible.id } })).profilePicture, 'https://example.invalid/foto-ficticia.png');
  } finally {
    await db.$disconnect();
    const target = resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir()) + '\\') || target.startsWith(resolve(tmpdir()) + '/'));
    await rm(target, { recursive: true, force: true });
  }
});
