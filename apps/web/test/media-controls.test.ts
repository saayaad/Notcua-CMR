import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AudioPlaybackCoordinator,
  MediaBlobCache,
  MediaDownloadQueue,
  createWaveformBars,
  createMediaFilename,
  formatMediaTime,
  nextAudioSpeed,
  toggleAudioPlayback,
} from '../src/components/media-controls.ts';

test('player alternates speed presets and formats elapsed time accessibly', () => {
  assert.equal(nextAudioSpeed(1), 1.5);
  assert.equal(nextAudioSpeed(1.5), 2);
  assert.equal(nextAudioSpeed(2), 1);
  assert.equal(formatMediaTime(83), '1:23');
  assert.equal(formatMediaTime(3723), '1:02:03');
  assert.equal(formatMediaTime(Number.NaN), '0:00');
  assert.equal(createWaveformBars('message-1').length, 36);
  assert.deepEqual(createWaveformBars('message-1'), createWaveformBars('message-1'));
});

test('player toggles between play and pause states', async () => {
  let paused = true;
  let plays = 0;
  let pauses = 0;
  const audio = {
    get paused() { return paused; },
    async play() { plays++; paused = false; },
    pause() { pauses++; paused = true; },
  };
  await toggleAudioPlayback(audio);
  await toggleAudioPlayback(audio);
  assert.equal(plays, 1);
  assert.equal(pauses, 1);
});

test('starting another audio pauses the previous one, and stopping an old player leaves the new one active', () => {
  const coordinator = new AudioPlaybackCoordinator();
  let firstPaused = 0;
  let secondPaused = 0;
  coordinator.start('one', () => firstPaused++);
  coordinator.start('two', () => secondPaused++);
  assert.equal(firstPaused, 1);
  coordinator.stop('one');
  coordinator.start('three', () => undefined);
  assert.equal(secondPaused, 1);
});

test('download queue deduplicates media and never exceeds its concurrency limit', async () => {
  const queue = new MediaDownloadQueue(3);
  let active = 0;
  let peak = 0;
  const work = (key: string) => queue.enqueue(key, async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 8));
    active--;
    return key;
  });
  const results = await Promise.all([work('a'), work('a'), work('b'), work('c'), work('d'), work('e')]);
  assert.equal(results.filter((value) => value === 'a').length, 2);
  assert.equal(peak, 3);
});

test('download queue starts the newest visible media first when requests arrive together', async () => {
  const queue = new MediaDownloadQueue(1);
  const order: string[] = [];
  const low = queue.enqueue('older', async () => { order.push('older'); return 'older'; }, 2);
  const high = queue.enqueue('newer', async () => { order.push('newer'); return 'newer'; }, 12);
  await Promise.all([low, high]);
  assert.deepEqual(order, ['newer', 'older']);
});

test('failed media downloads can be retried without poisoning the queue', async () => {
  const queue = new MediaDownloadQueue(1);
  await assert.rejects(queue.enqueue('retry', async () => { throw new Error('expirado'); }), /expirado/);
  assert.equal(await queue.enqueue('retry', async () => 'arquivo recuperado'), 'arquivo recuperado');
});

test('blob cache evicts least recently used entries when it reaches its size limit', () => {
  const cache = new MediaBlobCache(6);
  cache.set('oldest', new Blob(['123']));
  cache.set('next', new Blob(['456']));
  assert.ok(cache.get('oldest'));
  cache.set('new', new Blob(['789']));
  assert.equal(cache.get('next'), undefined);
  assert.equal(cache.get('oldest')?.size, 3);
  assert.equal(cache.sizeBytes, 6);
});

test('download names are friendly and include the contact and date', () => {
  assert.equal(createMediaFilename('audio', 'João da Silva', '2026-11-13T10:00:00.000Z', 'audio/ogg; codecs=opus'), 'audio-joao-da-silva-2026-11-13.ogg');
});
