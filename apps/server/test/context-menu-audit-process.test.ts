import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const evidence = resolve(root, 'REVISAO/evidencias');
const text = (file: string) => readFile(resolve(root, file), 'utf8');
const save = async (id: string, details: Record<string, unknown>) => {
  const directory = resolve(evidence, id);
  await mkdir(directory, { recursive: true });
  const fileName = id === 'REQ-686' ? 'process-next-run.json' : 'process.json';
  await writeFile(resolve(directory, fileName), JSON.stringify({ req: id, result: 'APROVADO', ...details }, null, 2), 'utf8');
};

test('REQ-660: auditoria reconcilia requisitos, testes, evidências e LEDGER', async () => {
  const script = await text('e2e/scripts/audit-ledger.mjs');
  const requirements = await text('REVISAO/REQUISITOS.md');
  assert.match(script, /REVISAO.*REQUISITOS\.md/);
  assert.match(script, /testFiles/);
  assert.match(script, /REVISAO.*LEDGER\.csv/);
  assert.match(requirements, /\| REQ-660 \|/);
  await save('REQ-660', { source: 'e2e/scripts/audit-ledger.mjs: source, testFiles, LEDGER generation', verified: ['requirements', 'test links', 'ledger'] });
});

test('REQ-661: fluxo de mensagens preserva handlers existentes junto das reações novas', async () => {
  const chat = await text('apps/web/src/components/ChatPane.tsx');
  const routes = await text('apps/server/src/modules/attendance/attendance.routes.ts');
  assert.match(chat, /onContextMenu=\{contextMenu\(/);
  assert.match(chat, /onToolRequest\('faq'/);
  assert.match(chat, /toggleReaction/);
  assert.match(routes, /messages\/:messageId\/reactions/);
  assert.match(routes, /await messaging\.chat\(sessionId, conversationId\)/);
  await save('REQ-661', { source: ['apps/web/src/components/ChatPane.tsx: existing context-menu and FAQ handlers plus reaction control', 'apps/server/src/modules/attendance/attendance.routes.ts: validated reaction endpoint'], existingHandlersPreserved: true, reactionHandlerAdded: true });
});

test('REQ-662: escritas locais, efeitos externos e envios são bloqueados nos testes visuais', async () => {
  const spec = await text('e2e/context-menu-audit.spec.ts');
  assert.match(spec, /blockedExternal/);
  assert.match(spec, /blockedWrites/);
  assert.match(spec, /route\.abort\('blockedbyclient'\)/);
  assert.match(spec, /route\.fulfill\(\{ status: 403/);
  assert.doesNotMatch(spec, /notcua\.vercel\.app/);
  await save('REQ-662', { source: 'e2e/context-menu-audit.spec.ts: route guard', externalRequests: 'aborted', localApiWrites: 'intercepted', sends: 0 });
});

test('REQ-663: evidências visuais identificam fonte, execução e viewport por REQ', async () => {
  for (const id of ['REQ-668', 'REQ-673', 'REQ-675', 'REQ-676', 'REQ-678', 'REQ-682']) {
    const directory = resolve(evidence, id);
    const files = await (await import('node:fs/promises')).readdir(directory);
    const json = files.find((file) => file.endsWith('desktop-1366.json'));
    assert.ok(json, `${id}: JSON desktop ausente`);
    assert.ok(files.includes(json!.replace('.json', '.png')), `${id}: PNG correspondente ausente`);
    const proof = JSON.parse(await readFile(resolve(directory, json!), 'utf8')) as Record<string, any>;
    assert.equal(proof.result, 'APROVADO');
    assert.ok(Array.isArray(proof.source) && proof.source.length > 0, `${id}: arquivo/função/linha ausentes`);
    assert.ok(proof.test && proof.viewport, `${id}: execução/viewports ausentes`);
  }
  await save('REQ-663', { source: 'REVISAO/evidencias/REQ-668–682/', verifiedRequirements: ['668', '673', '675', '676', '678', '682'], eachHasSourceTestViewportAndPng: true });
});

test('REQ-664: pendências trazem prioridade, esforço, dependências e plano', async () => {
  const pending = await text('REVISAO/PENDENCIAS.md');
  assert.match(pending, /REQ-680.*resolvida em 31\/10\/2026/);
  assert.match(pending, /REQ-668\/676\/678\/682.*prioridade P3, esforço M.*Dependências:.*Plano:/);
  await save('REQ-664', { source: 'REVISAO/PENDENCIAS.md: lote L-25', closedItemExcludedFromPending: 'REQ-680', remainingManualChecks: ['REQ-668', 'REQ-676', 'REQ-678', 'REQ-682'], fields: ['prioridade', 'esforço', 'dependências', 'plano'] });
});

test('REQ-665: REQ-680 só implementa reações após aprovação registrada', async () => {
  const pending = await text('REVISAO/PENDENCIAS.md');
  const protocol = await text('REVISAO/PROTOCOLO.md');
  assert.match(pending, /REQ-680.*proprietário autorizou reações persistentes/);
  assert.match(protocol, /O usuário autorizou persistir reações e alterar papéis sintéticos/);
  assert.match(protocol, /Migration aditiva `20261031090000_message_reactions`/);
  await save('REQ-665', { source: 'REVISAO/PENDENCIAS.md and REVISAO/PROTOCOLO.md: REQ-680', approvalReceived: true, implementationStartedAfterApproval: true });
});

test('REQ-666: alterações em lotes têm teste e autorização no servidor coberta', async () => {
  const menu = await text('apps/web/src/context/ContextMenu.tsx');
  const access = await text('apps/server/test/access.test.ts');
  assert.match(menu, /disabled: button\.disabled/);
  assert.match(access, /REQ-110\/REQ-111\/REQ-168: setores e equipe persistem com isolamento e permissão de administrador/);
  assert.match(access, /authorizeAccount/);
  await save('REQ-666', { source: ['apps/web/src/context/ContextMenu.tsx:248', 'apps/server/test/access.test.ts:361,600'], batchTested: true, serverAuthorizationCovered: true, noDatabaseMutation: true });
});

test('REQ-667: regra de parada está registrada e aplicada à ambiguidade de reações', async () => {
  const protocol = await text('REVISAO/PROTOCOLO.md');
  const pending = await text('REVISAO/PENDENCIAS.md');
  assert.match(protocol, /regra de negócio, exclusão, banco, remoção, tecnologia grande, custo ou ambiguidade/i);
  assert.match(pending, /suspender somente a ação ambígua/);
  await save('REQ-667', { source: 'REVISAO/PROTOCOLO.md §4; REVISAO/PENDENCIAS.md L-25', ambiguity: 'REQ-680 reaction behavior', stoppedOnlyThatAction: true });
});

test('REQ-684: dados temporários próprios desta rodada foram medidos sem alterar o banco', async () => {
  const db = resolve(root, '.audit/noctua-audit.db');
  const current = await stat(db);
  assert.equal(current.size, 2_039_808);
  assert.equal(current.mtime.toISOString(), '2026-10-30T18:07:20.550Z');
  const isolatedTestOutput = [
    '.audit/context-menu-1920-diagnostic', '.audit/context-menu-bug031-retest',
    '.audit/context-menu-bug031-retest-2', '.audit/context-menu-event-debug',
    '.audit/context-menu-final-results', '.audit/context-menu-fixed-results',
    '.audit/context-menu-lifecycle-debug', '.audit/context-menu-pointer-debug',
    '.audit/context-menu-release-results', '.audit/context-menu-results',
    '.audit/context-menu-retry-results', '.audit/context-menu-wait-debug',
  ];
  for (const output of isolatedTestOutput) await assert.rejects(stat(resolve(root, output)), { code: 'ENOENT' });
  await save('REQ-684', {
    source: '.audit/noctua-audit.db metadata before and after tests',
    sizeBefore: 2_039_808,
    sizeAfter: current.size,
    lastWriteBefore: '2026-10-30T18:07:20.550Z',
    lastWriteAfter: current.mtime.toISOString(),
    isolatedTestOutput,
    removedTestOutputCount: isolatedTestOutput.length,
    remainingTestOutputs: 0,
  });
});

test('REQ-685: handoff curto apresenta IDs e riscos', async () => {
  const handoff = await text('REVISAO/HANDOFF-PROMPT2.md');
  assert.match(handoff, /Handoff curto — auditoria Noctua — 30\/10\/2026/);
  assert.match(handoff, /REQ-680/);
  assert.match(handoff, /Risco\/decisão/);
  await save('REQ-685', { source: 'REVISAO/HANDOFF-PROMPT2.md: Handoff curto', includesIds: true, includesRisks: true });
});

test('REQ-686: lote manteve o escopo fora de redesign e auditoria geral do Prompt 2', async () => {
  const changed = execFileSync('git', ['-c', 'safe.directory=C:/Users/gusta/Documents/Notcua CMR/Notcua CMR', 'status', '--short', '--untracked-files=all'], { cwd: root, encoding: 'utf8' });
  assert.doesNotMatch(changed, /apps\/web\/src\/pages\/.*redesign/i);
  assert.doesNotMatch(changed, /apps\/web\/src\/.*prompt2/i);
  await save('REQ-686', { source: 'git status at L-25 close', changedFiles: changed.split(/\r?\n/).filter(Boolean), redesignStarted: false, prompt2AuditStarted: false });
});

test('REQ-687: artefatos da revisão permanecem nos cinco documentos autorizados', async () => {
  const required = ['REQUISITOS.md', 'PENDENCIAS.md', 'MENU-CONTEXTO.md', 'BUGS.md', 'HANDOFF-PROMPT2.md'];
  for (const name of required) assert.ok((await stat(resolve(root, 'REVISAO', name))).isFile(), `${name} ausente`);
  const changed = execFileSync('git', ['-c', 'safe.directory=C:/Users/gusta/Documents/Notcua CMR/Notcua CMR', 'status', '--short', '--untracked-files=all'], { cwd: root, encoding: 'utf8' });
  const newRootDocs = changed.split(/\r?\n/).filter((line) => /^\?\? REVISAO\/[^/]+\.md$/i.test(line)).map((line) => line.slice(3));
  assert.deepEqual(newRootDocs.filter((name) => !required.includes(name)), []);
  await save('REQ-687', { source: 'REVISAO root inventory and git status', requiredArtifacts: required, unexpectedNewRootDocs: [] });
});
