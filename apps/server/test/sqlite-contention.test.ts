import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { PrismaClient } from '@prisma/client';
import { SyncService } from '../src/modules/whatsapp/sync.service.js';
import { silentPublisher } from '../src/modules/whatsapp/whatsapp.types.js';

test('histórico aguarda uma gravação longa de autenticação sem perder o lote', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'noctua-contention-'));
  const url = `file:${join(directory, 'test.db').replace(/\\/g, '/')}`;
  const db = new PrismaClient({ datasourceUrl: url });
  try {
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
    const session = await db.whatsappSession.create({ data: { name: 'Concorrência' } });
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const writer = db.$transaction(
      async (tx) => {
        await tx.whatsappSession.update({ where: { id: session.id }, data: { name: 'Gravando chaves' } });
        entered();
        await delay(5500);
      },
      { timeout: 15_000 },
    );
    await started;
    const sync = new SyncService(db, silentPublisher);
    const results = await Promise.allSettled([
      writer,
      sync.chatsUpsert(session.id, [{ id: '5511999912345@s.whatsapp.net' }], true),
    ]);
    const failure = results.find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') {
      const error = failure.reason as { code?: string; name?: string };
      assert.fail(`Gravações concorrentes falharam: ${error.name ?? 'Erro'} ${error.code ?? ''}`);
    }
    assert.equal(await db.conversation.count(), 1);
  } finally {
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
