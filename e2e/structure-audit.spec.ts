import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { CrmBoard, CrmMetrics } from '../apps/web/src/pages/crm.types';

const evidenceRoot = resolve(process.cwd(), 'REVISAO', 'evidencias');
const runTag = new Date().toISOString().replaceAll(/[:.]/g, '-');

interface AuditState {
  board: CrmBoard;
  metrics: CrmMetrics;
  moveRequests: Record<string, unknown>[];
  interceptedWrites: string[];
  unexpectedWrites: string[];
  blockedExternal: string[];
  consoleErrors: string[];
  pageErrors: string[];
  dragGeometry: Record<string, unknown> | null;
}

const initialBoard = (): CrmBoard => ({
  cards: [
    {
      conversationId: 'audit-req008-ana',
      contact: { id: 'audit-contact-ana', name: 'Ana Exemplo', phoneNumber: '5511999000001', profilePicture: null, labels: [] },
      title: 'Oportunidade fictícia A',
      valueInCents: 0,
      status: 'OPEN',
      version: 1,
      unreadCount: 0,
      attendanceStatus: 'OPEN',
      lastMessageAt: null,
      sync: 'SYNCED',
    },
    {
      conversationId: 'audit-req008-bruna',
      contact: { id: 'audit-contact-bruna', name: 'Bruna Exemplo', phoneNumber: '5511999000002', profilePicture: null, labels: [] },
      title: 'Oportunidade fictícia B',
      valueInCents: 0,
      status: 'OPEN',
      version: 1,
      unreadCount: 0,
      attendanceStatus: 'OPEN',
      lastMessageAt: null,
      sync: 'SYNCED',
    },
  ],
  columns: [
    { id: 'no-stage', labelId: null, name: 'Sem etapa', color: '#64748b', description: '', whatsappId: null, conversationIds: [], totalValueInCents: 0 },
    { id: 'stage-new', labelId: 'stage-new', name: 'Novos', color: '#3b82f6', description: '', whatsappId: null, conversationIds: ['audit-req008-ana', 'audit-req008-bruna'], totalValueInCents: 0 },
  ],
  total: 2,
  loaded: 2,
  limit: 500,
  pendingSync: 0,
  failedSync: 0,
});

const emptyMetrics: CrmMetrics = {
  days: 30,
  since: '2026-10-01T00:00:00.000Z',
  contacts: 2,
  attendances: 0,
  unread: 0,
  active: 0,
  openValueInCents: 0,
  wonValueInCents: 0,
  won: 0,
  lost: 0,
  conversion: 0,
  inbound: 0,
  outbound: 0,
  activity: [],
};

const states = new WeakMap<Page, AuditState>();

test.beforeEach(async ({ page }) => {
  const state: AuditState = {
    board: initialBoard(),
    metrics: emptyMetrics,
    moveRequests: [],
    interceptedWrites: [],
    unexpectedWrites: [],
    blockedExternal: [],
    consoleErrors: [],
    pageErrors: [],
    dragGeometry: null,
  };
  states.set(page, state);
  page.on('console', (message) => {
    if (message.type() === 'error') state.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => state.pageErrors.push(error.message));

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    if (!local) {
      state.blockedExternal.push(url.origin);
      return route.abort('blockedbyclient');
    }
    if (url.port === '3340' && method === 'GET' && url.pathname.includes('/api/crm/sessions/') && url.pathname.endsWith('/board'))
      return route.fulfill({ json: structuredClone(state.board) });
    if (url.port === '3340' && method === 'GET' && url.pathname.includes('/api/crm/sessions/') && url.pathname.endsWith('/metrics'))
      return route.fulfill({ json: state.metrics });
    if (url.port === '3340' && url.pathname.startsWith('/api/') && method !== 'GET') {
      state.interceptedWrites.push(`${method} ${url.pathname}`);
      if (url.pathname.endsWith('/operations/directory/presence'))
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      if (method === 'POST' && url.pathname.endsWith('/move')) {
        const body = request.postDataJSON() as Record<string, unknown>;
        state.moveRequests.push(body);
        const source = state.board.columns.find((column) => column.labelId === body.sourceLabelId);
        const destination = state.board.columns.find((column) => column.labelId === body.targetLabelId);
        const sourceIndex = source?.conversationIds.indexOf(String(body.conversationId)) ?? -1;
        if (!source || !destination || sourceIndex < 0) {
          state.unexpectedWrites.push(`invalid move payload ${JSON.stringify(body)}`);
        } else {
          source.conversationIds.splice(sourceIndex, 1);
          const beforeId = typeof body.beforeConversationId === 'string' ? body.beforeConversationId : '';
          const index = beforeId ? destination.conversationIds.indexOf(beforeId) : -1;
          destination.conversationIds.splice(index < 0 ? destination.conversationIds.length : index, 0, String(body.conversationId));
        }
      } else {
        state.unexpectedWrites.push(`${method} ${url.pathname}`);
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    }
    return route.fallback();
  });
});

test.afterEach(async ({ page }, info) => {
  const state = states.get(page);
  if (!state) return;
  const directory = resolve(evidenceRoot, 'REQ-008');
  await mkdir(directory, { recursive: true });
  const suffix = `${info.project.name.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase()}-${runTag}`;
  await page.screenshot({ path: resolve(directory, `kanban-${suffix}.png`), fullPage: true, animations: 'disabled' }).catch(() => {});
  await writeFile(resolve(directory, `kanban-${suffix}.json`), JSON.stringify({
    req: 'REQ-008',
    result: info.status === 'passed' ? 'APROVADO' : 'FALHOU',
    project: info.project.name,
    viewport: page.viewportSize(),
    url: page.isClosed() ? '' : page.url(),
    persistedColumnOrder: state.board.columns.find((column) => column.id === 'stage-new')?.conversationIds,
    moveRequests: state.moveRequests,
    interceptedWrites: state.interceptedWrites,
    unexpectedWrites: state.unexpectedWrites,
    dragGeometry: state.dragGeometry,
    blockedExternal: [...new Set(state.blockedExternal)],
    consoleErrors: state.consoleErrors,
    pageErrors: state.pageErrors,
    failures: info.errors.map((error) => error.message),
  }, null, 2), 'utf8');
  if (info.status === 'passed') {
    expect(state.moveRequests).toHaveLength(1);
    expect(state.unexpectedWrites).toEqual([]);
    expect(state.interceptedWrites.filter((path) => path.endsWith('/move'))).toHaveLength(1);
    expect(state.interceptedWrites.filter((path) => !path.endsWith('/move'))
      .every((path) => path.endsWith('/operations/directory/presence'))).toBe(true);
    expect(state.pageErrors).toEqual([]);
  }
});

async function openCrm(page: Page) {
  await page.goto('/atendimento', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'CRM e negócios', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'CRM e negócios' })).toBeVisible();
}

test('REQ-008 quadro Kanban permite arrastar cartão e mantém a ordem após recarregar', async ({ page }) => {
  const state = states.get(page)!;
  await openCrm(page);
  const column = page.locator('.kanban-column[aria-label="Etapa Novos"]');
  await expect(column.locator('.kanban-card')).toHaveCount(2);
  const handle = page.getByRole('button', { name: 'Arrastar Ana Exemplo de Novos' });
  const target = column.locator('.kanban-card').filter({ hasText: 'Bruna Exemplo' });
  await column.scrollIntoViewIfNeeded();
  await handle.scrollIntoViewIfNeeded();
  const start = await handle.boundingBox();
  const dropZone = column.locator('.kanban-drop');
  const zone = await dropZone.boundingBox();
  let end = await target.boundingBox();
  expect(start, 'alça de arrastar visível').not.toBeNull();
  expect(zone, 'área de destino visível').not.toBeNull();
  state.dragGeometry = { start, initialTarget: end, dropZone: zone };

  await page.mouse.move(start!.x + start!.width / 2, start!.y + start!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(250);
  await page.mouse.move(start!.x + start!.width / 2 + 24, start!.y + start!.height / 2, { steps: 5 });
  const edgeX = zone!.x + zone!.width / 2;
  const edgeY = Math.min(zone!.y + zone!.height - 4, (await page.evaluate(() => window.innerHeight)) - 4);
  for (let attempt = 0; attempt < 8; attempt++) {
    end = await target.boundingBox();
    if (end && end.y >= zone!.y && end.y + end.height <= zone!.y + zone!.height) break;
    await page.mouse.move(edgeX, edgeY, { steps: 6 });
    await page.waitForTimeout(180);
  }
  end = await target.boundingBox();
  state.dragGeometry = { start, targetAfterAutoScroll: end, dropZone: zone };
  expect(end, 'segundo cartão aparece na área rolável após iniciar o arraste').not.toBeNull();
  await page.mouse.move(end!.x + end!.width / 2, end!.y + end!.height - 6, { steps: 16 });
  await page.waitForTimeout(200);
  await page.mouse.up();

  await expect.poll(() => state.moveRequests.length).toBe(1);
  await expect.poll(() => state.board.columns.find((item) => item.id === 'stage-new')?.conversationIds)
    .toEqual(['audit-req008-bruna', 'audit-req008-ana']);
  expect(state.moveRequests[0]).toMatchObject({
    conversationId: 'audit-req008-ana',
    sourceLabelId: 'stage-new',
    targetLabelId: 'stage-new',
  });
  await expect(column.locator('.kanban-card').first()).toContainText('Bruna Exemplo');

  await page.reload();
  await openCrm(page);
  const reloadedColumn = page.locator('.kanban-column[aria-label="Etapa Novos"]');
  await expect(reloadedColumn.locator('.kanban-card').first()).toContainText('Bruna Exemplo');
  await expect(reloadedColumn.locator('.kanban-card').nth(1)).toContainText('Ana Exemplo');
  expect(state.interceptedWrites.filter((path) => path.endsWith('/move'))).toHaveLength(1);
});
