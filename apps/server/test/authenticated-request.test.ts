import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authenticatedFetch } from '../../web/src/context/authenticated-request.js';

test('requisição usa o token atual do Firebase em vez do valor antigo da interface', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, init) => {
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer current-token');
      assert.equal(new Headers(init?.headers).get('X-Test'), 'preserved');
      return new Response('{}');
    };
    await authenticatedFetch('http://example.test/api', { headers: { 'X-Test': 'preserved' } }, {
      token: 'old-context-token', user: { getIdToken: async () => 'current-token' },
    });
  } finally { globalThis.fetch = originalFetch; }
});

test('401 renova uma vez e preserva o mesmo corpo e identificador do envio', async () => {
  const originalFetch = globalThis.fetch;
  const body = JSON.stringify({ requestId: 'same-send-id', text: 'teste' });
  const tokens: string[] = [];
  let refreshes = 0;
  try {
    globalThis.fetch = async (_url, init) => {
      assert.equal(init?.method, 'POST');
      assert.equal(init.body, body);
      tokens.push(new Headers(init.headers).get('Authorization') ?? '');
      return new Response('{}', { status: 401 });
    };
    const response = await authenticatedFetch('http://example.test/api', { method: 'POST', body }, {
      token: 'context-token', user: { getIdToken: async (force) => {
        if (force) { refreshes++; return 'renewed-token'; }
        return 'expired-token';
      } },
    });
    assert.equal(response.status, 401);
    assert.equal(refreshes, 1);
    assert.deepEqual(tokens, ['Bearer expired-token', 'Bearer renewed-token']);
  } finally { globalThis.fetch = originalFetch; }
});

test('falhas de rede e respostas 403/500 não repetem uma operação de resultado incerto', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const status of [403, 500]) {
      let calls = 0;
      globalThis.fetch = async () => { calls++; return new Response('{}', { status }); };
      const response = await authenticatedFetch('http://example.test/api', { method: 'POST' }, { token: 'local' });
      assert.equal(response.status, status);
      assert.equal(calls, 1);
    }
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new TypeError('Failed to fetch'); };
    await assert.rejects(authenticatedFetch('http://example.test/api', { method: 'POST' }, { token: 'local' }), /Failed to fetch/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('requisição cancelada não força renovação nem repete a chamada', async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  let refreshes = 0;
  try {
    globalThis.fetch = async () => { controller.abort(); return new Response('{}', { status: 401 }); };
    await authenticatedFetch('http://example.test/api', { signal: controller.signal }, {
      token: '', user: { getIdToken: async (force) => { if (force) refreshes++; return 'token'; } },
    });
    assert.equal(refreshes, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('falha ao renovar a credencial impede envio com uma credencial antiga', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => { calls++; return new Response('{}'); };
    await assert.rejects(authenticatedFetch('http://example.test/api', {}, {
      token: 'old-context-token', user: { getIdToken: async () => { throw new Error('login-required'); } },
    }), /login-required/);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});
