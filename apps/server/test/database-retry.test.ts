import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retryDatabaseOperation } from '../src/database/retry.js';

test('repete uma falha transitória de transação e devolve o resultado recuperado', async () => {
  let calls = 0;
  const waits: number[] = [];
  const result = await retryDatabaseOperation(
    async () => {
      calls++;
      if (calls < 3) throw Object.assign(new Error('Transação expirada'), { code: 'P2028' });
      return 'sincronizado';
    },
    async (milliseconds) => {
      waits.push(milliseconds);
    },
  );
  assert.equal(result, 'sincronizado');
  assert.deepEqual(waits, [250, 500]);
});

test('limita as tentativas e preserva erros permanentes para diagnóstico', async () => {
  for (const code of ['P2028', 'P2002']) {
    let calls = 0;
    const failure = Object.assign(new Error('Erro de teste'), { code });
    await assert.rejects(
      retryDatabaseOperation(
        async () => {
          calls++;
          throw failure;
        },
        async () => undefined,
      ),
      (error) => error === failure,
    );
    assert.equal(calls, code === 'P2028' ? 3 : 1);
  }
});
