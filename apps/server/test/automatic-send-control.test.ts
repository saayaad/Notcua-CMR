import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import { automaticSendSettings, assertAutomaticSendsAllowed } from '../src/modules/operations/automatic-send-control.js';
import { DeliveryWorker } from '../src/modules/operations/delivery.worker.js';
import { SequenceService } from '../src/modules/attendance/sequence.service.js';
import { FlowEngine } from '../src/modules/flows/flow.engine.js';

function fakeDb() {
  const rows = new Map<string, { id: string; kind: string; data: unknown }>();
  const calls: string[] = [];
  const db = {
    operationRecord: {
      findUnique: async ({ where }: { where: { id: string } }) => rows.get(where.id) ?? null,
      findMany: async () => [
        { id: 'campaign-batch', kind: 'BATCH', data: { status: 'ACTIVE' } },
        { id: 'follow-up-batch', kind: 'BATCH', data: { status: 'ACTIVE' } },
        { id: 'recovery-batch', kind: 'BATCH', data: { status: 'ACTIVE' } },
      ],
      upsert: async ({ where, create, update }: { where: { id: string }; create: { id: string; kind: string; data: unknown }; update: { data: unknown } }) => {
        const previous = rows.get(where.id);
        const value = previous ? { ...previous, data: update.data } : create;
        rows.set(where.id, value);
        calls.push(value.kind);
        return value;
      },
    },
    deliveryTask: { findFirst: async ({ where }: { where: { batchId: string } }) => ({ id: `${where.batchId}-task`, payload: { followUp: where.batchId === 'follow-up-batch', recoveryAuthorized: where.batchId === 'recovery-batch' } }), updateMany: async () => { calls.push('delivery-update'); return { count: 0 }; } },
    sequenceRun: { findMany: async () => [{ id: 'sequence-funnel-task' }], updateMany: async () => { calls.push('sequence-update'); return { count: 0 }; } },
    flowExecution: { findMany: async () => [{ id: 'flow-task' }], updateMany: async () => { calls.push('flow-update'); return { count: 0 }; } },
    flowInboxEvent: { findMany: async () => [], updateMany: async () => { calls.push('inbox-update'); return { count: 0 }; } },
  };
  return { db: db as unknown as PrismaClient, rows, calls };
}

test('travão global tem padrão desligado e registra tentativas automáticas bloqueadas', async () => {
  const previous = process.env.AUTOMATIC_SENDS_TEST_DEFAULT;
  process.env.AUTOMATIC_SENDS_TEST_DEFAULT = 'false';
  process.env.AUTOMATIC_SENDS_ENABLED = 'true';
  const { db, rows } = fakeDb();
  try {
    assert.equal((await automaticSendSettings(db)).enabled, false);
    await assert.rejects(assertAutomaticSendsAllowed(db, { module: 'worker:recovery', taskId: 'fixture-task', automatic: true }, 'fixture-request'), /desligados/);
    const blocked = [...rows.values()].find((row) => row.kind === 'AUTOMATIC_SEND_BLOCKED');
    assert.ok(blocked);
    assert.equal((blocked!.data as { taskId: string }).taskId, 'fixture-task');
    await assert.doesNotReject(assertAutomaticSendsAllowed(db, { module: 'attendance:composer', automatic: false }));
  } finally {
    if (previous === undefined) delete process.env.AUTOMATIC_SENDS_TEST_DEFAULT;
    else process.env.AUTOMATIC_SENDS_TEST_DEFAULT = previous;
  }
});

test('travão impede workers de reivindicar campanhas, follow-ups, recuperações, sequências ou fluxos', async () => {
  process.env.AUTOMATIC_SENDS_ENABLED = 'false';
  const { db, rows, calls } = fakeDb();
  const noop = {} as never;
  const delivery = new DeliveryWorker(db, noop, noop, noop);
  const sequence = new SequenceService(db, noop, noop);
  const flow = new FlowEngine(db, noop, noop);
  try {
    await delivery.flush();
    await sequence.flush();
    await flow.flush();
    assert.deepEqual(calls.filter((call) => call.endsWith('-update')), []);
    assert.ok(!calls.includes('delivery-update'));
    assert.ok(!calls.includes('sequence-update'));
    assert.ok(!calls.includes('flow-update'));
    const blocked = [...rows.values()].filter((row) => row.kind === 'AUTOMATIC_SEND_BLOCKED').map((row) => (row.data as { module: string }).module);
    assert.ok(blocked.includes('worker:campaign'));
    assert.ok(blocked.includes('worker:follow-up'));
    assert.ok(blocked.includes('worker:recovery'));
    assert.ok(blocked.includes('worker:sequence-funnel-macro'));
    assert.ok(blocked.includes('flow:execution'));
  } finally {
    await Promise.all([delivery.stop(), sequence.stop(), flow.stop()]);
    process.env.AUTOMATIC_SENDS_ENABLED = 'true';
  }
});

test('inicialização do worker com travão desligado não altera estados de execução', async () => {
  process.env.AUTOMATIC_SENDS_ENABLED = 'false';
  const { db, calls } = fakeDb();
  const noop = {} as never;
  const delivery = new DeliveryWorker(db, noop, noop, noop);
  const sequence = new SequenceService(db, noop, noop);
  const flow = new FlowEngine(db, noop, noop);
  try {
    await delivery.start();
    await sequence.start();
    await flow.start();
    assert.deepEqual(calls, []);
  } finally {
    await Promise.all([delivery.stop(), sequence.stop(), flow.stop()]);
    process.env.AUTOMATIC_SENDS_ENABLED = 'true';
  }
});
