import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countRecoveryFilters, planCampaignRecovery, type RecoveryCandidate, type RecoveryStatus } from '../src/modules/operations/campaign-recovery.js';

const row = (id: string, overrides: Partial<RecoveryCandidate> = {}): RecoveryCandidate => ({
  id, name: id, phoneNumber: `551199${String(id.charCodeAt(0)).padStart(9, '0')}`,
  taskStatus: 'SENT', replied: false, ...overrides,
});
const options: { statuses: RecoveryStatus[]; minIntervalDays: number; maxRecoveries: number; now: Date } = { statuses: ['unreplied'], minIntervalDays: 3, maxRecoveries: 2, now: new Date('2026-11-12T12:00:00Z') };

test('campaign recovery eligibility and preview counts', async (t) => {
  await t.test('preview exposes counts beside each selectable status', () => {
    assert.deepEqual(countRecoveryFilters([
      row('a'), row('b', { taskStatus: 'VERIFY' }), row('c', { taskStatus: 'FAILED' }),
      row('d', { taskStatus: 'QUEUED' }), row('e', { taskStatus: 'REPLIED', replied: true }),
    ]), { unreplied: 1, delivery: 2, pending: 1, replied: 1 });
  });
  await t.test('filters by selected status and defaults replies out', () => {
    const result = planCampaignRecovery([row('a'), row('b', { replied: true, taskStatus: 'REPLIED' }), row('c', { taskStatus: 'FAILED' })], options);
    assert.deepEqual(result.eligible.map((item) => item.id), ['a']);
    assert.equal(result.counts['respondeu'], 1);
    assert.equal(result.counts['status não selecionado'], 1);
  });
  await t.test('applies all automatic safety exclusions and exposes reason counts', () => {
    const result = planCampaignRecovery([
      row('a', { optedOut: true }), row('b', { blocked: true }), row('c', { purchased: true }),
      row('d', { pendingOrder: true }), row('e', { phoneNumber: '+5559899385577' }),
      row('f', { activeElsewhere: true }),
    ], options);
    assert.equal(result.eligible.length, 0);
    assert.deepEqual(result.counts, { 'pediu para parar': 1, bloqueado: 1, 'comprou/venda vinculada': 1, 'pedido ou vídeo pendente': 1, 'número inválido': 1, 'outra campanha ativa/pausada': 1 });
  });
  await t.test('enforces the minimum interval and recovery attempt limit', () => {
    const recent = new Date('2026-11-11T12:00:00Z');
    const result = planCampaignRecovery([
      row('a', { latestSentAt: recent }), row('b', { recoveryCount: 2 }), row('c', { latestSentAt: new Date('2026-11-01T12:00:00Z') }),
    ], options);
    assert.deepEqual(result.eligible.map((item) => item.id), ['c']);
    assert.equal(result.counts['intervalo mínimo'], 1);
    assert.equal(result.counts['limite de tentativas'], 1);
  });
  await t.test('allows combining status filters and deduplicates numbers', () => {
    const result = planCampaignRecovery([
      row('a', { phoneNumber: '5511999990000' }), row('b', { taskStatus: 'FAILED', phoneNumber: '5511999990000' }),
    ], { ...options, statuses: ['unreplied', 'delivery'] });
    assert.equal(result.eligible.length, 1);
    assert.equal(result.excluded[0]?.reason, 'número duplicado');
    assert.equal(Object.values(result.counts).reduce((sum, count) => sum + count, 0), 1);
  });
});
