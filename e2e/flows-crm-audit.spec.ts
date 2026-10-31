import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const evidenceRoot = resolve(process.cwd(), 'REVISAO', 'evidencias');
type Row = Record<string, any>;
type AuditState = {
  flows: Map<string, Row>;
  runs: Row[];
  writes: Row[];
  unhandledWrites: Row[];
  consoleErrors: string[];
  pageErrors: string[];
  blockedExternal: string[];
  board: Row;
  metrics: Row;
  moves: Row[];
};
const states = new WeakMap<Page, AuditState>();
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const now = () => new Date().toISOString();

function graph() {
  return { nodes: [{
    id: 'start', type: 'start', position: { x: 100, y: 140 },
    data: { title: 'Início', keywordRules: [{ rule: 'equals', keyword: 'oi' }], nextNodeIds: [], sendToContacts: true, sendToGroups: false, cooldownMs: 60000 },
  }] };
}
function makeFlow(id: string, name: string): Row {
  return {
    id, name, enabled: false, revision: 1, archived: false, imported: false,
    graph: graph(),
    versions: [{ id: id + ':draft-1', version: 1, status: 'DRAFT', publishedAt: null, createdAt: now() }],
    publishedVersion: null, publishedGraph: null, updatedAt: now(),
  };
}
function asDetail(flow: Row): Row {
  return copy({ id: flow.id, name: flow.name, enabled: flow.enabled, revision: flow.revision, archived: flow.archived, imported: false, graph: flow.graph, versions: flow.versions, publishedVersion: flow.publishedVersion });
}
function asSummary(flow: Row): Row {
  const published = [...flow.versions].reverse().find((item: Row) => item.status === 'PUBLISHED') ?? null;
  return copy({ id: flow.id, name: flow.name, enabled: flow.enabled, revision: flow.revision, imported: false, archived: flow.archived, updatedAt: flow.updatedAt, latest: flow.versions.at(-1) ?? null, published });
}
function boardFixture(): Row {
  const labelA = { id: 'audit-label-new', name: 'Novo', color: '#8B5CF6' };
  const labelB = { id: 'audit-label-proposal', name: 'Proposta', color: '#F59E0B' };
  return {
    cards: [{
      conversationId: 'audit-conversation-crm',
      contact: { id: 'audit-contact', name: 'Cliente Fictício', phoneNumber: '5511999990001', profilePicture: null, labels: [{ labelId: labelA.id, label: labelA }] },
      title: 'Negociação de auditoria', valueInCents: 12900, status: 'OPEN', version: 1, unreadCount: 1, attendanceStatus: 'OPEN', lastMessageAt: now(), sync: 'SYNCED',
    }],
    columns: [
      { id: 'unlabelled', labelId: null, name: 'Sem etiqueta', color: '#9294a4', description: '', whatsappId: null, conversationIds: [], totalValueInCents: 0 },
      { id: labelA.id, labelId: labelA.id, name: labelA.name, color: labelA.color, description: '', whatsappId: null, conversationIds: ['audit-conversation-crm'], totalValueInCents: 12900 },
      { id: labelB.id, labelId: labelB.id, name: labelB.name, color: labelB.color, description: '', whatsappId: null, conversationIds: [], totalValueInCents: 0 },
    ],
    total: 1, loaded: 1, limit: 500, pendingSync: 0, failedSync: 0,
  };
}
function metricsFixture(): Row {
  const activity = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return { date: date.toISOString(), received: index + 1, sent: index };
  });
  return {
    days: 30, since: new Date(Date.now() - 30 * 86400000).toISOString(),
    contacts: 2, attendances: 1, unread: 1, active: 2, openValueInCents: 12900,
    wonValueInCents: 25000, won: 2, lost: 1, conversion: 66.7, inbound: 28, outbound: 19, activity,
  };
}
function waitingRun(flowId: string, name: string, nodeId: string): Row {
  return {
    id: 'audit-run-waiting', conversationId: 'audit-conversation', status: 'WAITING_INPUT',
    currentNodeId: nodeId, nextRunAt: null, inputExpiresAt: new Date(Date.now() + 120000).toISOString(),
    error: null, createdAt: now(), updatedAt: now(), contact: { name: 'Contato fictício' },
    version: { version: 1, flow: { id: flowId, name } },
  };
}
async function install(page: Page): Promise<AuditState> {
  const state: AuditState = {
    flows: new Map(), runs: [], writes: [], unhandledWrites: [],
    consoleErrors: [], pageErrors: [], blockedExternal: [], board: boardFixture(), metrics: metricsFixture(), moves: [],
  };
  states.set(page, state);
  page.on('console', (message) => { if (message.type() === 'error') state.consoleErrors.push(message.text() + ' @ ' + message.location().url); });
  page.on('pageerror', (error) => state.pageErrors.push(error.message));
  await page.addInitScript(() => {
    localStorage.removeItem('noctua-preferences:local');
    localStorage.removeItem('noctua-active-session:local');
  });
  await page.route('https://**/*', async (route) => {
    state.blockedExternal.push(new URL(route.request().url()).origin);
    return route.abort('blockedbyclient');
  });
  await page.route('http://notcua.vercel.app/**', async (route) => {
    state.blockedExternal.push(new URL(route.request().url()).origin);
    return route.abort('blockedbyclient');
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.fallback();
    let body: unknown = null;
    try { body = request.postDataJSON(); } catch {}
    const record = { method: request.method(), path: new URL(request.url()).pathname, body };
    state.unhandledWrites.push(record);
    state.writes.push(record);
    return route.abort('blockedbyclient');
  });
  await page.route('**/api/operations/directory/presence', async (route) => {
    state.writes.push({ method: 'POST', path: '/api/operations/directory/presence', body: {} });
    return route.fulfill({ json: { ok: true } });
  });
  const preferences = { attendanceCustomizationVersion: 3, menuLabels: {}, hiddenViews: [], menuOrder: [], menuGroupOrder: [], resourceOrder: {}, compactNav: false, toolsVisible: false, toolsDocked: false, toolsCompact: false, desktopNotifications: false };
  await page.route('**/api/operations/settings/preferences', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: preferences });
    if (route.request().method() === 'PUT') {
      state.writes.push({ method: 'PUT', path: '/api/operations/settings/preferences', body: route.request().postDataJSON() });
      return route.fulfill({ json: { saved: true } });
    }
    return route.fallback();
  });
  await page.route('**/api/operations/features', (route) => route.fulfill({ json: { aiEnabled: false, canManage: true } }));
  const library = {
    assets: [
      { id: 'audit-text', kind: 'MESSAGE', name: 'Texto fictício', text: 'Olá, contato de teste.', caption: null, fileId: null, file: null, isFavorite: false, isPtt: false, isPtv: false, asViewOnce: false },
      { id: 'audit-audio', kind: 'AUDIO', name: 'Áudio fictício', text: null, caption: null, fileId: 'audit-audio-file', file: { id: 'audit-audio-file', filename: 'audio-ficticio.ogg', mimeType: 'audio/ogg; codecs=opus', byteLength: 12 }, isFavorite: false, isPtt: true, isPtv: false, asViewOnce: false },
      { id: 'audit-image', kind: 'MEDIA', name: 'Imagem fictícia', text: null, caption: 'Imagem sem destinatário real.', fileId: 'audit-image-file', file: { id: 'audit-image-file', filename: 'imagem-ficticia.png', mimeType: 'image/png', byteLength: 8 }, isFavorite: false, isPtt: false, isPtv: false, asViewOnce: false },
      { id: 'audit-document', kind: 'DOCUMENT', name: 'Documento fictício', text: null, caption: null, fileId: 'audit-document-file', file: { id: 'audit-document-file', filename: 'documento-ficticio.pdf', mimeType: 'application/pdf', byteLength: 10 }, isFavorite: false, isPtt: false, isPtv: false, asViewOnce: false },
    ],
    funnels: [], macros: [], pixKeys: [],
  };
  await page.route('**/api/attendance/library', (route) => route.fulfill({ json: library }));
  await page.route('**/api/whatsapp/sessions', (route) => route.fulfill({ json: { items: [{
    id: 'audit-session', name: 'Sessão fictícia isolada', status: 'CONNECTED', phoneNumber: '5511999990000',
    lastConnectedAt: null, autoConnect: false, qrDataUrl: null, qrExpiresAt: null, error: null, retryCount: 0, lastError: null,
  }] } }));
  await page.route('**/api/whatsapp/sessions/audit-session/labels', (route) => route.fulfill({ json: { items: [
    { id: 'audit-label-new', sessionId: 'audit-session', name: 'Novo', color: '#8B5CF6', description: '', whatsappId: null, isDeleted: false },
    { id: 'audit-label-proposal', sessionId: 'audit-session', name: 'Proposta', color: '#F59E0B', description: '', whatsappId: null, isDeleted: false },
  ] } }));
  await page.route('**/api/operations/sessions/audit-session/label-rules/*', (route) => route.fulfill({ json: {
    enabled: false, recordSale: false, askValue: false, fixedValueInCents: 0, internalNote: '', pinConversation: false, investmentInCents: 0,
  } }));
  await page.route('**/api/automation/sessions/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const suffix = path.replace(/^\/api\/automation\/sessions\/[^/]+/, '');
    const match = suffix.match(/^\/flows\/([^/]+)(?:\/(draft|publish|settings|simulate))?$/);
    const body = method === 'GET' ? {} : (request.postDataJSON() as Row ?? {});
    if (suffix === '/flows' && method === 'GET') {
      const archived = url.searchParams.get('archived') === 'true';
      return route.fulfill({ json: { items: [...state.flows.values()].filter((flow) => Boolean(flow.archived) === archived).map(asSummary) } });
    }
    if (suffix === '/flows' && method === 'POST') {
      const id = 'audit-flow-' + String(state.flows.size + 1);
      const flow = makeFlow(id, String(body.name ?? 'Fluxo fictício'));
      state.flows.set(id, flow);
      state.writes.push({ method, path, body });
      return route.fulfill({ status: 201, json: asDetail(flow) });
    }
    if (suffix === '/runs' && method === 'GET') return route.fulfill({ json: { items: copy(state.runs) } });
    if (match) {
      const id = decodeURIComponent(match[1]);
      const action = match[2];
      const flow = state.flows.get(id);
      if (!flow) return route.fulfill({ status: 404, json: { message: 'Fluxo de fixture não encontrado.' } });
      if (!action && method === 'GET') return route.fulfill({ json: asDetail(flow) });
      if (action === 'draft' && method === 'PUT') {
        state.writes.push({ method, path, body: copy(body) });
        flow.name = String(body.name ?? flow.name);
        flow.graph = copy(body.graph ?? flow.graph);
        flow.revision += 1;
        flow.updatedAt = now();
        flow.versions.push({ id: id + ':draft-' + String(flow.versions.length + 1), version: flow.versions.length + 1, status: 'DRAFT', publishedAt: null, createdAt: now() });
        return route.fulfill({ json: asDetail(flow) });
      }
      if (action === 'publish' && method === 'POST') {
        state.writes.push({ method, path, body: copy(body) });
        const version = flow.versions.length + 1;
        flow.versions.push({ id: id + ':published-' + String(version), version, status: 'PUBLISHED', publishedAt: now(), createdAt: now() });
        flow.publishedVersion = version;
        flow.publishedGraph = copy(flow.graph);
        flow.revision += 1;
        flow.updatedAt = now();
        return route.fulfill({ json: asDetail(flow) });
      }
      if (action === 'settings' && method === 'PUT') {
        state.writes.push({ method, path, body: copy(body) });
        if (typeof body.enabled === 'boolean') {
          flow.enabled = body.enabled;
          if (!body.enabled) state.runs = state.runs.map((run) =>
            run.version.flow.id === id && ['QUEUED', 'RUNNING', 'WAITING_INPUT'].includes(run.status)
              ? { ...run, status: 'CANCELLED', updatedAt: now() } : run);
        }
        if (typeof body.archived === 'boolean') flow.archived = body.archived;
        flow.revision += 1;
        flow.updatedAt = now();
        return route.fulfill({ json: asSummary(flow) });
      }
      if (action === 'simulate' && method === 'POST') {
        state.writes.push({ method, path, body: copy(body) });
        return route.fulfill({ json: { steps: [], sends: [], status: 'SIMULATED' } });
      }
    }
    if (suffix === '/runs/audit-run-waiting/cancel' && method === 'POST') {
      state.writes.push({ method, path, body: null });
      state.runs = state.runs.map((run) => run.id === 'audit-run-waiting' ? { ...run, status: 'CANCELLED' } : run);
      return route.fulfill({ json: { id: 'audit-run-waiting', status: 'CANCELLED' } });
    }
    return route.fallback();
  });
  await page.route('**/api/crm/sessions/*/board**', async (route) =>
    route.request().method() === 'GET' ? route.fulfill({ json: copy(state.board) }) : route.fallback());
  await page.route('**/api/crm/sessions/*/metrics**', async (route) =>
    route.request().method() === 'GET' ? route.fulfill({ json: copy(state.metrics) }) : route.fallback());
  await page.route('**/api/crm/sessions/*/move', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = route.request().postDataJSON() as Row;
    const path = new URL(route.request().url()).pathname;
    state.writes.push({ method: 'POST', path, body: copy(body) });
    state.moves.push(copy(body));
    const card = state.board.cards.find((item: Row) => item.conversationId === body.conversationId);
    const source = state.board.columns.find((item: Row) => item.labelId === body.sourceLabelId);
    const target = state.board.columns.find((item: Row) => item.labelId === body.targetLabelId);
    if (card && source && target) {
      source.conversationIds = source.conversationIds.filter((id: string) => id !== card.conversationId);
      if (!target.conversationIds.includes(card.conversationId)) target.conversationIds.push(card.conversationId);
      card.contact.labels = card.contact.labels.filter((link: Row) => link.labelId !== body.sourceLabelId);
      if (!card.contact.labels.some((link: Row) => link.labelId === body.targetLabelId))
        card.contact.labels.push({ labelId: target.labelId, label: { id: target.id, name: target.name, color: target.color } });
      card.version += 1;
    }
    return route.fulfill({ json: { moved: true } });
  });
  return state;
}
async function modulePage(page: Page, module: string, heading: string, first: boolean) {
  if (first) {
    await page.goto('/');
    await expect(page.locator('.app-shell')).toBeVisible();
  }
  if ((page.viewportSize()?.width ?? 1366) <= 900)
    await page.getByRole('button', { name: 'Recolher ou expandir menu principal' }).click();
  await page.getByRole('button', { name: module, exact: true }).click();
  await expect(page.locator('h1').filter({ hasText: heading }).first()).toBeVisible();
}
async function createFlow(page: Page, name: string) {
  await page.getByRole('button', { name: 'Novo fluxo', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Novo fluxo' });
  await dialog.getByLabel('Nome do fluxo').fill(name);
  await dialog.getByRole('button', { name: 'Criar fluxo', exact: true }).click();
  await expect(page.locator('.flow-editor')).toBeVisible();
  await expect(page.locator('.flow-inspector')).toBeVisible();
}
async function choose(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('listbox').getByRole('option', { name: option, exact: true }).click();
}
async function closeFlowInspector(page: Page) {
  const close = page.getByRole('button', { name: 'Fechar configuração do bloco', exact: true });
  if (await close.isVisible().catch(() => false)) await close.click();
}
async function selectFlowBlock(page: Page, block: Locator) {
  await closeFlowInspector(page);
  await block.click();
}
async function dragCanvasNode(page: Page, bounds: { x: number; y: number; width: number; height: number }) {
  const start = { x: bounds.x + bounds.width / 2, y: bounds.y + 22 };
  const end = { x: start.x + 96, y: start.y + 50 };
  if ((page.viewportSize()?.width ?? 1366) <= 700) {
    const session = await page.context().newCDPSession(page);
    const point = (x: number, y: number) => ({ id: 1, x, y, radiusX: 2, radiusY: 2, force: 1 });
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(start.x, start.y)] });
    for (let step = 1; step <= 12; step++) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [point(start.x + (end.x - start.x) * step / 12, start.y + (end.y - start.y) * step / 12)],
      });
      await page.waitForTimeout(20);
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
    return;
  }
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
}
async function capture(page: Page, ids: string[], info: TestInfo, state: AuditState, notes: Row) {
  const suffix = info.project.name.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
  for (const id of ids) {
    const folder = resolve(evidenceRoot, id);
    await mkdir(folder, { recursive: true });
    const report = {
      req: id, result: 'APROVADO', project: info.project.name, viewport: page.viewportSize(), url: page.url(),
      consoleErrors: state.consoleErrors, pageErrors: state.pageErrors, blockedExternal: state.blockedExternal,
      interceptedWrites: state.writes, unhandledWrites: state.unhandledWrites, notes,
    };
    await page.screenshot({ path: resolve(folder, 'flows-crm-' + suffix + '.png'), fullPage: true });
    await writeFile(resolve(folder, 'flows-crm-' + suffix + '.json'), JSON.stringify(report, null, 2), 'utf8');
  }
}
test.afterEach(async ({ page }, info) => {
  const state = states.get(page);
  if (!state || info.status === 'passed') return;
  const ids = [...info.title.matchAll(/REQ-\d+/g)].map((match) => match[0]);
  const suffix = info.project.name.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
  for (const id of ids) {
    try {
      const folder = resolve(evidenceRoot, id);
      await mkdir(folder, { recursive: true });
      await page.screenshot({ path: resolve(folder, 'flows-crm-failed-' + suffix + '.png'), fullPage: true });
      await writeFile(resolve(folder, 'flows-crm-failed-' + suffix + '.json'), JSON.stringify({
        req: id, result: 'FALHOU', project: info.project.name, url: page.url(),
        consoleErrors: state.consoleErrors, pageErrors: state.pageErrors, blockedExternal: state.blockedExternal,
        interceptedWrites: state.writes, unhandledWrites: state.unhandledWrites,
        error: info.error?.message ?? 'Falha sem mensagem disponível.',
      }, null, 2), 'utf8');
    } catch {}
  }
});

test('REQ-054/REQ-055/REQ-056 canvas altera x/y, rascunho fica separado e fluxo ativa e pausa', async ({ page }, info) => {
  const state = await install(page);
  await modulePage(page, 'Autoatendimento', 'Fluxos de conversa', true);
  const name = 'Fluxo auditável ' + info.project.name;
  await createFlow(page, name);
  await page.getByRole('button', { name: 'Mensagem', exact: true }).click();
  await page.getByLabel('Nome do bloco', { exact: true }).fill('Saudação do teste');
  const node = page.locator('.react-flow__node').filter({ hasText: 'Saudação do teste' });
  await expect(node).toBeVisible();
  await closeFlowInspector(page);
  await page.locator('.react-flow__controls-fitview').click();
  await node.scrollIntoViewIfNeeded();
  const before = await node.getAttribute('style');
  const bounds = await node.boundingBox();
  expect(bounds).not.toBeNull();
  await dragCanvasNode(page, bounds!);
  await expect(page.locator('.flow-editor-header')).toContainText('Alterações não salvas');
  expect(await node.getAttribute('style')).not.toBe(before);
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  const flow = state.flows.get('audit-flow-1')!;
  const moved = flow.graph.nodes.find((item: Row) => item.type === 'text');
  expect(moved.position.x).not.toBe(380);
  expect(moved.position.y).not.toBe(220);
  await page.getByRole('button', { name: 'Voltar aos fluxos' }).click();
  let card = page.locator('.flow-card').filter({ hasText: name });
  await expect(card).toContainText('Rascunho · sem publicação');
  await page.reload();
  await modulePage(page, 'Autoatendimento', 'Fluxos de conversa', false);
  card = page.locator('.flow-card').filter({ hasText: name });
  await card.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.getByLabel('Nome do fluxo', { exact: true })).toHaveValue(name);
  await selectFlowBlock(page, page.locator('.react-flow__node').filter({ hasText: 'Saudação do teste' }));
  await page.getByLabel('Nome do bloco', { exact: true }).fill('Versão publicada');
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  const publishedVersion = state.flows.get('audit-flow-1')!.publishedVersion;
  expect(publishedVersion).not.toBeNull();
  const publishedTitle = state.flows.get('audit-flow-1')!.publishedGraph.nodes.find((item: Row) => item.type === 'text').data.title;
  await page.getByLabel('Nome do bloco', { exact: true }).fill('Novo rascunho posterior');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  expect(state.flows.get('audit-flow-1')!.publishedVersion).toBe(publishedVersion);
  expect(state.flows.get('audit-flow-1')!.publishedGraph.nodes.find((item: Row) => item.type === 'text').data.title).toBe(publishedTitle);
  await page.getByRole('button', { name: 'Voltar aos fluxos' }).click();
  card = page.locator('.flow-card').filter({ hasText: name });
  await expect(card).toContainText('Publicação v' + publishedVersion);
  await card.getByRole('button', { name: 'Ativar ' + name, exact: true }).click();
  await page.getByRole('dialog', { name: 'Ativar automação' }).getByRole('button', { name: 'Ativar fluxo', exact: true }).click();
  await expect(card.locator('.flow-status')).toHaveText('Ativo');
  await card.getByRole('button', { name: 'Pausar ' + name, exact: true }).click();
  await expect(card.locator('.flow-status')).toHaveText('Pausado');
  expect(state.unhandledWrites).toEqual([]);
  await capture(page, ['REQ-054', 'REQ-055', 'REQ-056'], info, state, {
    savedPosition: moved.position, publishedVersion, draftDidNotReplacePublishedSnapshot: true, flowPaused: !state.flows.get('audit-flow-1')!.enabled,
  });
});

test('REQ-057/REQ-058/REQ-059/REQ-060/REQ-061/REQ-062 configura gatilhos, contatos, grupos e horários', async ({ page }, info) => {
  const state = await install(page);
  await modulePage(page, 'Autoatendimento', 'Fluxos de conversa', true);
  const name = 'Gatilhos da auditoria ' + info.project.name;
  await createFlow(page, name);
  await choose(page, 'Regra 1', 'É igual a');
  await page.getByLabel('Palavra-chave 1').fill('AJUDA');
  await page.getByRole('button', { name: 'Adicionar regra', exact: true }).click();
  await choose(page, 'Regra 2', 'Contém');
  await page.getByLabel('Palavra-chave 2').fill('preço');
  await page.getByLabel('Diferenciar maiúsculas e minúsculas').check();
  await page.getByLabel('Permitir contatos salvos').check();
  await page.getByLabel('Permitir grupos').check();
  await page.getByLabel('Limitar horário de funcionamento').check();
  await page.locator('.schedule-days').getByRole('button', { name: 'Qui', exact: true }).click();
  await page.locator('.schedule-days').getByRole('button', { name: 'Sex', exact: true }).click();
  await page.getByLabel('Das', { exact: true }).fill('09:30');
  await page.getByLabel('Até', { exact: true }).fill('17:45');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  const start = state.flows.get('audit-flow-1')!.graph.nodes.find((item: Row) => item.type === 'start');
  expect(start.data.keywordRules).toEqual([{ rule: 'equals', keyword: 'AJUDA' }, { rule: 'contains', keyword: 'preço' }]);
  expect(start.data.isCaseSensitive).toBe(true);
  expect(start.data.sendToContacts).toBe(true);
  expect(start.data.sendToGroups).toBe(true);
  expect(start.data.schedule).toEqual({ days: [1, 2, 3], minTime: '09:30', maxTime: '17:45' });
  await page.getByRole('button', { name: 'Voltar aos fluxos' }).click();
  await page.reload();
  await modulePage(page, 'Autoatendimento', 'Fluxos de conversa', false);
  await page.locator('.flow-card').filter({ hasText: name }).getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.getByLabel('Palavra-chave 1')).toHaveValue('AJUDA');
  await expect(page.getByLabel('Palavra-chave 2')).toHaveValue('preço');
  await expect(page.getByLabel('Diferenciar maiúsculas e minúsculas')).toBeChecked();
  await expect(page.getByLabel('Permitir grupos')).toBeChecked();
  await expect(page.getByLabel('Das', { exact: true })).toHaveValue('09:30');
  await expect(page.getByLabel('Até', { exact: true })).toHaveValue('17:45');
  expect(state.unhandledWrites).toEqual([]);
  await capture(page, ['REQ-057', 'REQ-058', 'REQ-059', 'REQ-060', 'REQ-061', 'REQ-062'], info, state, {
    keywordRules: start.data.keywordRules, caseSensitive: start.data.isCaseSensitive,
    contactsAllowed: start.data.sendToContacts, groupsAllowed: start.data.sendToGroups, schedule: start.data.schedule, persistedAfterReload: true,
  });
});

test('REQ-063/REQ-064/REQ-065 nós de texto, áudio e mídia guardam recurso e atraso', async ({ page }, info) => {
  const state = await install(page);
  await modulePage(page, 'Autoatendimento', 'Fluxos de conversa', true);
  const name = 'Recursos da auditoria ' + info.project.name;
  await createFlow(page, name);
  const items = [
    { button: 'Mensagem', type: 'text', title: 'Texto do fluxo', asset: 'Texto fictício', id: 'audit-text', seconds: '2.5' },
    { button: 'Áudio', type: 'audio', title: 'Áudio do fluxo', asset: 'Áudio fictício', id: 'audit-audio', seconds: '3.2' },
    { button: 'Mídia', type: 'media', title: 'Mídia do fluxo', asset: 'Imagem fictícia', id: 'audit-image', seconds: '4.1' },
  ];
  for (const item of items) {
    await page.getByRole('button', { name: item.button, exact: true }).click();
    await page.getByLabel('Nome do bloco', { exact: true }).fill(item.title);
    await choose(page, 'Recurso da biblioteca', item.asset);
    await page.getByLabel('Simulação antes do envio (s)', { exact: true }).fill(item.seconds);
  }
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  const saved = state.flows.get('audit-flow-1')!.graph.nodes;
  const resources = items.map((item) => {
    const node = saved.find((entry: Row) => entry.type === item.type);
    expect(node.data.itemId).toBe(item.id);
    expect(node.data.simulationDelay).toBe(Math.round(Number(item.seconds) * 1000));
    return { type: item.type, itemId: node.data.itemId, delay: node.data.simulationDelay };
  });
  await page.getByRole('button', { name: 'Voltar aos fluxos' }).click();
  await page.reload();
  await modulePage(page, 'Autoatendimento', 'Fluxos de conversa', false);
  await page.locator('.flow-card').filter({ hasText: name }).getByRole('button', { name: 'Editar', exact: true }).click();
  for (const item of items) {
    await selectFlowBlock(page, page.locator('.flow-block.block-' + item.type).filter({ hasText: item.title }));
    await expect(page.getByRole('combobox', { name: 'Recurso da biblioteca', exact: true })).toContainText(item.asset);
    await expect(page.getByLabel('Simulação antes do envio (s)', { exact: true })).toHaveValue(item.seconds);
  }
  expect(state.unhandledWrites).toEqual([]);
  await capture(page, ['REQ-063', 'REQ-064', 'REQ-065'], info, state, { resources, persistedAfterReload: true, fictitiousAssetsOnly: true, sendsPerformed: 0 });
});

test('REQ-066/REQ-067 conecta espera e pausa a execução no aguardo de resposta', async ({ page }, info) => {
  const state = await install(page);
  await modulePage(page, 'Autoatendimento', 'Fluxos de conversa', true);
  const name = 'Espera e pausa ' + info.project.name;
  await createFlow(page, name);
  await page.getByRole('button', { name: 'Aguardar resposta', exact: true }).click();
  await page.getByLabel('Nome do bloco', { exact: true }).fill('Aguardar cliente');
  const waitId = await page.locator('.react-flow__node').filter({ hasText: 'Aguardar cliente' }).getAttribute('data-id');
  await page.getByRole('button', { name: 'Mensagem', exact: true }).click();
  await page.getByLabel('Nome do bloco', { exact: true }).fill('Resposta aceita');
  await selectFlowBlock(page, page.locator('.flow-block.block-user-input'));
  await choose(page, 'Próximo bloco após resposta aceita', 'Resposta aceita');
  await selectFlowBlock(page, page.locator('.flow-block.block-start'));
  await choose(page, 'Próximo bloco', 'Aguardar cliente');
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  const flow = state.flows.get('audit-flow-1')!;
  expect(flow.publishedVersion).not.toBeNull();
  const waitNode = flow.graph.nodes.find((item: Row) => item.type === 'user-input');
  expect(flow.graph.nodes.find((item: Row) => item.type === 'start').data.nextNodeIds).toEqual([waitNode.id]);
  state.runs = [waitingRun(flow.id, name, waitNode.id)];
  await page.getByRole('button', { name: 'Voltar aos fluxos' }).click();
  let card = page.locator('.flow-card').filter({ hasText: name });
  await card.getByRole('button', { name: 'Ativar ' + name, exact: true }).click();
  await page.getByRole('dialog', { name: 'Ativar automação' }).getByRole('button', { name: 'Ativar fluxo', exact: true }).click();
  await expect(card.locator('.flow-status')).toHaveText('Ativo');
  await page.getByRole('button', { name: 'Execuções recentes', exact: true }).click();
  await expect(page.locator('.flow-runs')).toContainText('Aguardando cliente');
  await page.getByRole('button', { name: 'Meus fluxos', exact: true }).click();
  card = page.locator('.flow-card').filter({ hasText: name });
  await card.getByRole('button', { name: 'Pausar ' + name, exact: true }).click();
  await expect(card.locator('.flow-status')).toHaveText('Pausado');
  await page.getByRole('button', { name: 'Execuções recentes', exact: true }).click();
  await expect(page.locator('.flow-runs')).toContainText('Cancelado');
  expect(state.runs[0].status).toBe('CANCELLED');
  expect(state.unhandledWrites).toEqual([]);
  await capture(page, ['REQ-066', 'REQ-067'], info, state, { waitNodeId: waitId, connectedNextNode: waitNode.id, waitingRunCancelledByPause: true, sendsPerformed: 0 });
});

test('REQ-068/REQ-069/REQ-070/REQ-071 registra resposta, desvio e timeout em nós ligados', async ({ page }, info) => {
  const state = await install(page);
  await modulePage(page, 'Autoatendimento', 'Fluxos de conversa', true);
  const name = 'Ramificações ' + info.project.name;
  await createFlow(page, name);
  for (const title of ['Resposta aceita', 'Resposta diferente', 'Tempo esgotado']) {
    await page.getByRole('button', { name: 'Mensagem', exact: true }).click();
    await page.getByLabel('Nome do bloco', { exact: true }).fill(title);
  }
  await page.getByRole('button', { name: 'Aguardar resposta', exact: true }).click();
  await page.getByLabel('Nome do bloco', { exact: true }).fill('Escolher caminho');
  await choose(page, 'Aceitar resposta', 'Contém uma resposta esperada');
  await page.locator('.flow-inspector label').filter({ hasText: 'Respostas esperadas (uma por linha)' }).locator('textarea').fill('sim\nquero orçamento');
  await page.getByLabel('Tempo limite de resposta (min)', { exact: true }).fill('3');
  await choose(page, 'Follow-up ao esgotar o prazo', 'Texto fictício');
  await choose(page, 'Se a resposta for diferente', 'Resposta diferente');
  await choose(page, 'Se não houver resposta no prazo', 'Tempo esgotado');
  await choose(page, 'Próximo bloco após resposta aceita', 'Resposta aceita');
  const waitId = await page.locator('.react-flow__node').filter({ hasText: 'Escolher caminho' }).getAttribute('data-id');
  await selectFlowBlock(page, page.locator('.flow-block.block-start'));
  await choose(page, 'Próximo bloco', 'Escolher caminho');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  const graph = state.flows.get('audit-flow-1')!.graph;
  const input = graph.nodes.find((item: Row) => item.type === 'user-input');
  expect(input.id).toBe(waitId);
  expect(input.data.compareRule).toBe('contains');
  expect(input.data.expectedMessages).toEqual(['sim', 'quero orçamento']);
  expect(input.data.expirationTimeoutInMs).toBe(180000);
  expect(input.data.followUpData.itemId).toBe('audit-text');
  expect(input.data.nextNodeIds).toHaveLength(1);
  expect(input.data.nextNodeIdOnDifferentAnswer).toBeTruthy();
  expect(input.data.nextNodeIdOnExpiration).toBeTruthy();
  await page.getByRole('button', { name: 'Voltar aos fluxos' }).click();
  await page.reload();
  await modulePage(page, 'Autoatendimento', 'Fluxos de conversa', false);
  await page.locator('.flow-card').filter({ hasText: name }).getByRole('button', { name: 'Editar', exact: true }).click();
  await selectFlowBlock(page, page.locator('.flow-block.block-user-input').filter({ hasText: 'Escolher caminho' }));
  await expect(page.getByRole('combobox', { name: 'Aceitar resposta', exact: true })).toContainText('Contém uma resposta esperada');
  await expect(page.locator('.flow-inspector label').filter({ hasText: 'Respostas esperadas (uma por linha)' }).locator('textarea')).toHaveValue('sim\nquero orçamento');
  await expect(page.getByLabel('Tempo limite de resposta (min)', { exact: true })).toHaveValue('3');
  expect(state.unhandledWrites).toEqual([]);
  await capture(page, ['REQ-068', 'REQ-069', 'REQ-070', 'REQ-071'], info, state, {
    compareRule: input.data.compareRule, expectedMessages: input.data.expectedMessages,
    expirationTimeoutInMs: input.data.expirationTimeoutInMs, accepted: input.data.nextNodeIds[0],
    mismatch: input.data.nextNodeIdOnDifferentAnswer, timeout: input.data.nextNodeIdOnExpiration, persistedAfterReload: true, sendsPerformed: 0,
  });
});

test('REQ-072/REQ-073 colunas por etiqueta e arraste atualizam estágio após recarregar', async ({ page }, info) => {
  const state = await install(page);
  await modulePage(page, 'CRM e negócios', 'CRM e negócios', true);
  const source = page.getByRole('region', { name: 'Etapa Novo', exact: true });
  const target = page.getByRole('region', { name: 'Etapa Proposta', exact: true });
  await expect(source).toBeVisible();
  await expect(source.getByText('Cliente Fictício', { exact: true })).toBeVisible();
  await expect(target).toBeVisible();
  let moveMethod = 'drag-handle';
  if ((page.viewportSize()?.width ?? 1366) <= 700) {
    moveMethod = 'card-editor';
    await source.getByRole('button', { name: 'Editar negociação de Cliente Fictício em Novo', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Detalhes da negociação' });
    await dialog.getByRole('combobox', { name: /Mover de/ }).click();
    await page.getByRole('listbox').getByRole('option', { name: 'Proposta', exact: true }).click();
    await dialog.getByRole('button', { name: 'Mover cartão', exact: true }).click();
  } else {
    const handle = page.getByRole('button', { name: 'Arrastar Cliente Fictício de Novo', exact: true });
    const dropArea = target.locator('.kanban-drop');
    const sourceBounds = await handle.boundingBox();
    const targetBounds = await dropArea.boundingBox();
    expect(sourceBounds).not.toBeNull();
    expect(targetBounds).not.toBeNull();
    const start = { x: sourceBounds!.x + sourceBounds!.width / 2, y: sourceBounds!.y + sourceBounds!.height / 2 };
    const finish = { x: targetBounds!.x + targetBounds!.width / 2, y: targetBounds!.y + Math.min(80, targetBounds!.height / 2) };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.move(start.x + 8, start.y + 8, { steps: 2 });
    await page.mouse.move(finish.x, finish.y, { steps: 18 });
    await page.waitForTimeout(150);
    await page.mouse.up();
  }
  await expect.poll(() => state.moves.length).toBe(1);
  expect(state.moves[0].sourceLabelId).toBe('audit-label-new');
  expect(state.moves[0].targetLabelId).toBe('audit-label-proposal');
  await page.reload();
  await modulePage(page, 'CRM e negócios', 'CRM e negócios', false);
  await expect(page.getByRole('region', { name: 'Etapa Proposta', exact: true }).getByText('Cliente Fictício', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Etapa Novo', exact: true }).getByText('Cliente Fictício', { exact: true })).toHaveCount(0);
  expect(state.board.cards[0].contact.labels.map((link: Row) => link.labelId)).toEqual(['audit-label-proposal']);
  expect(state.unhandledWrites).toEqual([]);
  await capture(page, ['REQ-072', 'REQ-073'], info, state, {
    columns: state.board.columns.map((column: Row) => ({ name: column.name, labelId: column.labelId, conversationIds: column.conversationIds })),
    move: state.moves[0], moveMethod, persistedAfterReload: true, allWritesIntercepted: true,
  });
});

test('REQ-074/REQ-075 dashboard mostra métricas de atendimento, negócios e conversão', async ({ page }, info) => {
  const state = await install(page);
  await modulePage(page, 'CRM e negócios', 'CRM e negócios', true);
  const metric = (label: string) => page.locator('.crm-metric').filter({ has: page.getByText(label, { exact: true }) });
  await expect(metric('Contatos')).toContainText('2');
  await expect(metric('Em atendimento')).toContainText('1');
  await expect(metric('Negócios ganhos')).toContainText('250,00');
  await page.getByRole('button', { name: 'Indicadores', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Conversas que movimentam seu negócio', exact: true })).toBeVisible();
  await expect(metric('Conversão')).toContainText('66,7%');
  await expect(page.getByRole('heading', { name: 'Seu resultado no período', exact: true })).toBeVisible();
  expect(state.unhandledWrites).toEqual([]);
  await capture(page, ['REQ-074', 'REQ-075'], info, state, { metrics: state.metrics, conversionDisplayed: '66,7%', allWritesIntercepted: true });
});
