import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import express from 'express';
import request from 'supertest';
import type { PrismaClient } from '@prisma/client';
import { createSqliteClient } from '../src/database/sqlite-client.js';
import { operationsRoutes } from '../src/modules/operations/operations.routes.js';
import { errorHandler } from '../src/http/errors.js';
import { aiFeatureEnabled, requireAiFeature, setAiFeature } from '../src/modules/operations/ai-feature.js';
import { geminiResponse, meteredCall } from '../src/modules/operations/ai-provider.js';
import { generateSuggestion } from '../src/modules/operations/ai.service.js';
import { putRecord, record, type AgentSettings } from '../src/modules/operations/records.js';
import { aiHeaderVisible, reorderVisibleHeaders } from '../../web/src/context/ai-visibility.js';
import { CredentialCipher } from '../src/modules/whatsapp/credential-cipher.js';
import { env } from '../src/config/env.js';

const directory = await mkdtemp(join(tmpdir(), 'noctua-ai-feature-'));
const url = `file:${join(directory, 'test.db').replace(/\\/g, '/')}`;
const db = createSqliteClient(url);
const config: AgentSettings = {
  provider: 'gemini',
  model: 'modelo-ficticio',
  encryptedKey: 'credencial-ficticia-preservada',
  instructions: 'Regra fictícia',
  knowledge: 'Base fictícia',
  style: 'Cordial',
  enabled: true,
  enabledAt: new Date().toISOString(),
};
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.locals.identity = {
    role: req.headers['x-test-role'] === 'MEMBER' ? 'MEMBER' : 'ADMIN',
    email: 'teste@example.com',
  };
  next();
});
app.use('/operations', operationsRoutes(db, {} as never, {} as never));
app.use(errorHandler);
let networkAttempts = 0;
const originalFetch = globalThis.fetch;
before(async () => {
  execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL('../../../node_modules/prisma/build/index.js', import.meta.url)),
      'migrate',
      'deploy',
      '--schema',
      fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url)),
    ],
    { env: { ...process.env, DATABASE_URL: url, RUST_LOG: 'info' }, stdio: 'pipe' },
  );
  globalThis.fetch = async () => {
    networkAttempts++;
    throw new Error('Este teste não permite chamadas externas.');
  };
});
after(async () => {
  globalThis.fetch = originalFetch;
  await db.$disconnect();
  await rm(directory, { recursive: true, force: true });
  assert.equal(networkAttempts, 0);
});

test('REQ-526 IA sem ativação permanece parada, sem chamada externa, cache ou reserva', async () => {
  assert.equal((await request(app).get('/operations/features').expect(200)).body.aiEnabled, false);
  await assert.rejects(requireAiFeature(db), /desabilitada/);
  await assert.rejects(generateSuggestion(db, 'ficticio', 'Sugira'), /desabilitada/);
  await assert.rejects(geminiResponse(db, config, 'https://example.invalid', {}), /desabilitada/);
  let callback = false;
  await assert.rejects(
    meteredCall(db, config, 'ficticio', 'test', 10, async () => {
      callback = true;
      return { result: 'nunca' };
    }),
    /desabilitada/,
  );
  assert.equal(callback, false);
  assert.equal(await db.operationRecord.count({ where: { kind: 'AI_USAGE' } }), 0);
});

test('REQ-546/REQ-555 alterna chaves só em cota diária e não confunde outros erros com cota', async () => {
  await setAiFeature(db, true);
  const previous = await record<AgentSettings | null>(db, 'integration:ai', null);
  const previousKeyFile = env.WHATSAPP_KEY_FILE;
  env.WHATSAPP_KEY_FILE = join(directory, 'gemini-rotation-test.key');
  const cipher = await CredentialCipher.load(env.WHATSAPP_KEY_FILE);
  const primary = 'fake-primary-key-not-real-00001';
  const fallback = 'fake-fallback-key-not-real-00002';
  const data: AgentSettings = {
    ...config,
    encryptedKey: cipher.encrypt(primary).toString('base64'),
    fallbackKeys: [{ id: 'fallback-1', label: 'Projeto de teste B', enabled: true, addedAt: '2026-10-30T00:00:00.000Z', encryptedKey: cipher.encrypt(fallback).toString('base64') }],
  };
  const guardedFetch = globalThis.fetch;
  try {
    await putRecord(db, 'integration:ai', 'INTEGRATION', data);
    const used: string[] = [];
    globalThis.fetch = async (_input, init) => {
      used.push(new Headers(init?.headers).get('x-goog-api-key') ?? '');
      if (used.length === 1) return new Response(JSON.stringify({ error: { message: 'Daily requests per day quota exceeded', details: [{ reason: 'RATE_LIMIT_EXCEEDED_PER_DAY' }] } }), { status: 429 });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'geração simulada' }] } }] }), { status: 200 });
    };
    const result = await geminiResponse(db, data, 'https://example.invalid/generate', { method: 'POST' });
    assert.equal(used.length, 2, 'REQ-546 tenta a próxima chave após o esgotamento diário');
    assert.deepEqual(used, [primary, fallback], 'REQ-546 usa a ordem cadastrada');
    assert.equal((await record<{ until: number }>(db, 'ai-key-quota:primary', { until: 0 })).until > Date.now(), true, 'REQ-546 marca somente a chave diária esgotada');
    assert.equal(result.candidates[0].content.parts[0].text, 'geração simulada');

    for (const failure of [
      { status: 429, message: 'Too many requests per minute', reason: 'RATE_LIMIT_EXCEEDED_PER_MINUTE' },
      { status: 400, message: 'Invalid API key', reason: 'API_KEY_INVALID' },
      { status: 404, message: 'Model not found', reason: 'MODEL_NOT_FOUND' },
    ]) {
      await db.operationRecord.deleteMany({ where: { id: { startsWith: 'ai-key-quota:' } } });
      const callsBefore: number = used.length;
      globalThis.fetch = async (_input, init) => {
        used.push(new Headers(init?.headers).get('x-goog-api-key') ?? '');
        return new Response(JSON.stringify({ error: { message: failure.message, details: [{ reason: failure.reason }] } }), { status: failure.status });
      };
      await assert.rejects(geminiResponse(db, data, 'https://example.invalid/generate', { method: 'POST' }));
      assert.equal(used.length - callsBefore, 1, 'REQ-555 chave alternativa não é tentada por erro não diário');
      assert.equal(await db.operationRecord.findUnique({ where: { id: 'ai-key-quota:primary' } }), null, 'REQ-555 erro não diário não marca cota diária');
    }
  } finally {
    globalThis.fetch = guardedFetch;
    env.WHATSAPP_KEY_FILE = previousKeyFile;
    await db.operationRecord.deleteMany({ where: { id: { startsWith: 'ai-key-quota:' } } });
    if (previous) await putRecord(db, 'integration:ai', 'INTEGRATION', previous);
    else await db.operationRecord.deleteMany({ where: { id: 'integration:ai' } });
    await setAiFeature(db, false);
  }
});

test('administrador habilita e persiste sem chave nova nem ativar o robô; configurações ficam preservadas', async () => {
  await putRecord(db, 'integration:ai', 'INTEGRATION', config);
  await request(app).put('/operations/features').send({ aiEnabled: true }).expect(200);
  await requireAiFeature(db);
  const saved = await record<AgentSettings>(db, 'integration:ai', config);
  assert.equal(saved.enabled, false);
  assert.equal(saved.encryptedKey, config.encryptedKey);
  assert.equal(saved.knowledge, config.knowledge);
  const reopened = createSqliteClient(url);
  try {
    assert.equal(await aiFeatureEnabled(reopened), true);
  } finally {
    await reopened.$disconnect();
  }
});

test('membro lê o estado mas não consegue habilitar/desabilitar; payload extra é recusado', async () => {
  const result = await request(app).get('/operations/features').set('x-test-role', 'MEMBER').expect(200);
  assert.equal(result.body.canManage, false);
  await request(app)
    .put('/operations/features')
    .set('x-test-role', 'MEMBER')
    .send({ aiEnabled: false })
    .expect(403);
  await request(app).put('/operations/features').send({ aiEnabled: false, workspaceId: 'outra' }).expect(422);
  assert.equal(await aiFeatureEnabled(db), true);
});

test('desabilitar interrompe automação sem apagar chave ou regras; reabilitar não reativa o robô', async () => {
  await putRecord(db, 'integration:ai', 'INTEGRATION', config);
  await request(app).put('/operations/features').send({ aiEnabled: false }).expect(200);
  assert.equal(await aiFeatureEnabled(db), false);
  const saved = await record<AgentSettings>(db, 'integration:ai', config);
  assert.equal(saved.enabled, false);
  assert.equal(saved.enabledAt, undefined);
  assert.equal(saved.encryptedKey, config.encryptedKey);
  assert.equal(saved.instructions, config.instructions);
  await setAiFeature(db, true);
  assert.equal((await record<AgentSettings>(db, 'integration:ai', config)).enabled, false);
});

test('desligamento entre reserva e chamada não consome cota nem executa o trabalho', async () => {
  await setAiFeature(db, true);
  const wrapper = {
    operationRecord: {
      findUnique: (args: never) => db.operationRecord.findUnique(args),
      findMany: (args: never) => db.operationRecord.findMany(args),
      upsert: async (args: any) => {
        const result = await db.operationRecord.upsert(args);
        if (args.create.kind === 'AI_USAGE' && args.create.data.status === 'RESERVED')
          await setAiFeature(db, false);
        return result;
      },
    },
  } as unknown as PrismaClient;
  let called = false;
  await assert.rejects(
    meteredCall(wrapper, config, 'ficticio', 'test', 10, async () => {
      called = true;
      return { result: 'nunca' };
    }),
    /desabilitada/,
  );
  assert.equal(called, false);
  const usage = await db.operationRecord.findFirstOrThrow({ where: { kind: 'AI_USAGE' } });
  assert.equal((usage.data as { status: string }).status, 'REJECTED');
  assert.equal((usage.data as { estimatedCost: number }).estimatedCost, 0);
});

test('visibilidade preserva ferramentas manuais e ordem dos botões ocultos de IA', () => {
  const previous = ['summary', 'schedule', 'ai', 'archive', 'flow'];
  assert.deepEqual(
    previous.filter((id) => aiHeaderVisible(id, false)),
    ['schedule', 'archive', 'flow'],
  );
  assert.deepEqual(reorderVisibleHeaders(previous, ['flow', 'schedule', 'archive'], false), [
    'summary',
    'flow',
    'ai',
    'schedule',
    'archive',
  ]);
  assert.deepEqual(
    previous.filter((id) => aiHeaderVisible(id, true)),
    previous,
  );
});
