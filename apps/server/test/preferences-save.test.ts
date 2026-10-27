import test from 'node:test';
import assert from 'node:assert/strict';
import { PreferenceSaveQueue } from '../../web/src/context/preferences-save.js';

test('salvamento lento não sobrescreve a preferência mais recente', async () => {
  const queue = new PreferenceSaveQueue();
  let release!: () => void;
  let saved = '';
  const first = queue.run(async () => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    saved = 'antiga';
  });
  await Promise.resolve();
  await Promise.resolve();
  const second = queue.run(async () => {
    saved = 'nova';
  });
  release();
  await Promise.all([first, second]);
  assert.equal(saved, 'nova');
});

test('falha é apresentada ao chamador e permite nova tentativa', async () => {
  const queue = new PreferenceSaveQueue();
  await assert.rejects(
    queue.run(async () => {
      throw new Error('413: dados extensos');
    }),
    /413/,
  );
  assert.equal(await queue.run(async () => 'salvo'), 'salvo');
});
