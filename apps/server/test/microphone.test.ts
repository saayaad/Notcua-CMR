import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureMicrophone } from '../../web/src/microphone.js';

test('microfone informa permissão negada em português', async () => {
  await assert.rejects(
    () =>
      captureMicrophone({
        request: async () => {
          const error = new Error('denied');
          error.name = 'NotAllowedError';
          throw error;
        },
      }),
    /Permita o acesso/,
  );
});
test('microfone encerra a espera e para uma captura autorizada depois do prazo', async () => {
  let resolveStream: (stream: MediaStream) => void = () => undefined;
  let stopped = 0;
  const stream = {
    getTracks: () => [
      {
        stop: () => {
          stopped++;
        },
      },
    ],
  } as unknown as MediaStream;
  const request = () =>
    new Promise<MediaStream>((resolve) => {
      resolveStream = resolve;
    });
  await assert.rejects(() => captureMicrophone({ request, timeoutMs: 10 }), /não liberou/);
  resolveStream(stream);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(stopped, 1);
});
test('microfone não mantém captura quando a tela já foi fechada', async () => {
  let stopped = 0;
  const stream = {
    getTracks: () => [
      {
        stop: () => {
          stopped++;
        },
      },
    ],
  } as unknown as MediaStream;
  await assert.rejects(
    () => captureMicrophone({ request: async () => stream, isActive: () => false }),
    /encerrada/,
  );
  assert.equal(stopped, 1);
});
