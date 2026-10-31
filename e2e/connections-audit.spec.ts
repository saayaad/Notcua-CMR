import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { CrmBoard, CrmMetrics } from '../apps/web/src/pages/crm.types';

const evidenceRoot = resolve(process.cwd(), 'REVISAO', 'evidencias', 'REQ-021');
const runTag = new Date().toISOString().replaceAll(/[:.]/g, '-');
type Mutation = { method: string; path: string; body: Record<string, unknown> | null };
type AuditState = {
  board: CrmBoard;
  mutations: Mutation[];
  interceptedWrites: string[];
  unexpectedWrites: string[];
  blockedExternal: string[];
  consoleErrors: string[];
  pageErrors: string[];
};
const states = new WeakMap<Page, AuditState>();
const labelId = 'local:audit-req021-qualificacao';

function initialBoard(): CrmBoard {
  return {
    cards: [{
      conversationId: 'audit-req021-ana',
      contact: { id: 'audit-contact-req021', name: 'Ana Exemplo', phoneNumber: '5511999000021', profilePicture: null, labels: [] },
      title: 'Oportunidade fictícia REQ-021', valueInCents: 0, status: 'OPEN', version: 0,
      unreadCount: 0, attendanceStatus: 'OPEN', lastMessageAt: null, sync: 'SYNCED',
    }],
    columns: [
      { id: 'unlabelled', labelId: null, name: 'Sem etiqueta', color: '#9294a4', description: 'Contatos ainda sem uma etapa ou etiqueta.', whatsappId: null, conversationIds: [], totalValueInCents: 0 },
      { id: 'stage-new', labelId: 'stage-new', name: 'Novos', color: '#3b82f6', description: 'Etapa inicial fictícia.', whatsappId: null, conversationIds: ['audit-req021-ana'], totalValueInCents: 0 },
    ],
    total: 1, loaded: 1, limit: 500, pendingSync: 0, failedSync: 0,
  };
}
const metrics: CrmMetrics = {
  days: 30, since: '2026-10-01T00:00:00.000Z', contacts: 1, attendances: 0, unread: 0, active: 0,
  openValueInCents: 0, wonValueInCents: 0, won: 0, lost: 0, conversion: 0, inbound: 0, outbound: 0, activity: [],
};

function stateOf(page: Page) { return states.get(page)!; }

test.beforeEach(async ({ page }) => {
  const state: AuditState = {
    board: initialBoard(), mutations: [], interceptedWrites: [], unexpectedWrites: [],
    blockedExternal: [], consoleErrors: [], pageErrors: [],
  };
  states.set(page, state);
  page.on('console', message => {
    if (message.type() === 'error') state.consoleErrors.push(`${message.text()} @ ${message.location().url}`);
  });
  page.on('pageerror', error => state.pageErrors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    if (!local) {
      state.blockedExternal.push(url.origin);
      return route.abort('blockedbyclient');
    }
    if (url.port === '3340' && url.pathname.startsWith('/api/')) {
      if (method === 'GET' && url.pathname.includes('/api/crm/sessions/') && url.pathname.endsWith('/board'))
        return route.fulfill({ json: structuredClone(state.board) });
      if (method === 'GET' && url.pathname.includes('/api/crm/sessions/') && url.pathname.endsWith('/metrics'))
        return route.fulfill({ json: metrics });
      if (method === 'GET' && url.pathname.endsWith('/label-finance'))
        return route.fulfill({ json: { items: [] } });
      if (method === 'GET' && url.pathname.includes('/label-rules/'))
        return route.fulfill({ json: { enabled: false, recordSale: false, askValue: true, fixedValueInCents: 0, internalNote: '', pinConversation: false, investmentInCents: 0 } });
      if (method !== 'GET') {
        let body: Record<string, unknown> | null = null;
        try { body = request.postDataJSON() as Record<string, unknown>; } catch {}
        const mutation = { method, path: url.pathname, body };
        state.mutations.push(mutation);
        state.interceptedWrites.push(`${method} ${url.pathname}`);
        if (url.pathname.endsWith('/operations/directory/presence'))
          return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        if (method === 'POST' && url.pathname.endsWith('/labels') && body) {
          const label = {
            id: labelId, labelId, name: String(body.name), color: String(body.color), description: String(body.description),
            whatsappId: null, conversationIds: [], totalValueInCents: 0,
          };
          state.board.columns.push(label);
          return route.fulfill({ status: 201, json: label });
        }
        if (method === 'POST' && url.pathname.endsWith('/move') && body) {
          const source = state.board.columns.find(column => column.labelId === body.sourceLabelId);
          const destination = state.board.columns.find(column => column.labelId === body.targetLabelId);
          const card = state.board.cards.find(item => item.conversationId === body.conversationId);
          if (!source || !destination || !card) state.unexpectedWrites.push(`payload inválido: ${JSON.stringify(body)}`);
          else {
            source.conversationIds = source.conversationIds.filter(id => id !== card.conversationId);
            if (!destination.conversationIds.includes(card.conversationId)) destination.conversationIds.push(card.conversationId);
            card.contact.labels = [{ labelId: destination.labelId!, label: { id: destination.labelId!, name: destination.name, color: destination.color, whatsappId: null } }];
          }
          return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        }
        state.unexpectedWrites.push(`${method} ${url.pathname}`);
        return route.fulfill({ status: 501, contentType: 'application/json', body: '{"error":"write not allowed in audit fixture"}' });
      }
    }
    return route.fallback();
  });
});

test.afterEach(async ({ page }, info) => {
  const state = states.get(page);
  if (!state) return;
  await mkdir(evidenceRoot, { recursive: true });
  const suffix = `${info.project.name.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase()}-${runTag}`;
  const screenshotError = await page.screenshot({
    path: resolve(evidenceRoot, `connections-${suffix}.png`), fullPage: true, animations: 'disabled',
  }).then(() => '').catch(error => String(error));
  await writeFile(resolve(evidenceRoot, `connections-${suffix}.json`), JSON.stringify({
    req: 'REQ-021', result: info.status === 'passed' ? 'APROVADO' : 'FALHOU', project: info.project.name,
    viewport: page.viewportSize(), url: page.isClosed() ? '' : page.url(), labelId,
    board: state.board, mutations: state.mutations, interceptedWrites: state.interceptedWrites, unexpectedWrites: state.unexpectedWrites,
    blockedExternal: [...new Set(state.blockedExternal)], consoleErrors: state.consoleErrors, pageErrors: state.pageErrors,
    failures: info.errors.map(error => error.message), screenshotError,
  }, null, 2), 'utf8');
  if (info.status === 'passed') {
    expect(state.mutations.filter(item => item.method === 'POST' && item.path.endsWith('/labels'))).toHaveLength(1);
    expect(state.mutations.filter(item => item.method === 'POST' && item.path.endsWith('/move'))).toHaveLength(1);
    expect(state.unexpectedWrites).toEqual([]);
    expect(state.pageErrors).toEqual([]);
    expect(state.consoleErrors.filter(error => !error.includes('ERR_BLOCKED_BY_CLIENT'))).toEqual([]);
  }
});

async function openCrm(page: Page) {
  await page.goto('/atendimento', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'CRM e negócios', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'CRM e negócios' })).toBeVisible();
}

test('REQ-021: cria etiqueta com ID, nome, cor, descrição e contato vinculado após recarregar', async ({ page }) => {
  const state = stateOf(page);
  await openCrm(page);
  await page.getByRole('button', { name: 'Etapas', exact: true }).click();
  const manager = page.getByRole('dialog', { name: 'Etapas e etiquetas' });
  await expect(manager).toBeVisible();
  await manager.getByRole('button', { name: 'Nova etapa', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Nova etapa do CRM' });
  await editor.getByLabel('Nome da etapa').fill('Qualificação fictícia');
  await editor.getByLabel('Cor personalizada').fill('#2a88dd');
  await editor.getByLabel('Descrição').fill('Validar oportunidade de auditoria.');
  await editor.getByRole('button', { name: 'Salvar etapa', exact: true }).click();

  await expect.poll(() => state.mutations.filter(item => item.method === 'POST' && item.path.endsWith('/labels')).length).toBe(1);
  expect(state.mutations.find(item => item.path.endsWith('/labels'))?.body).toMatchObject({
    name: 'Qualificação fictícia', color: '#2a88dd', description: 'Validar oportunidade de auditoria.',
  });
  await expect(manager.locator('.stage-list').getByText('Validar oportunidade de auditoria.')).toBeVisible();
  const stageRow = manager.locator('.stage-list > div').filter({ hasText: 'Qualificação fictícia' });
  await expect(stageRow.locator('i')).toHaveCSS('background-color', 'rgb(42, 136, 221)');
  expect(state.board.columns.find(column => column.id === labelId)).toMatchObject({
    id: labelId, name: 'Qualificação fictícia', color: '#2a88dd', description: 'Validar oportunidade de auditoria.',
  });
  await manager.getByRole('button', { name: 'Fechar', exact: true }).click();

  const source = page.locator('.kanban-column[aria-label="Etapa Novos"]');
  await source.getByRole('button', { name: 'Editar negociação de Ana Exemplo em Novos' }).click();
  const details = page.getByRole('dialog', { name: 'Detalhes da negociação' });
  await details.locator('.opportunity-move').getByRole('combobox').click();
  await details.getByRole('option', { name: 'Qualificação fictícia', exact: true }).click();
  await expect(details.getByRole('button', { name: 'Mover cartão', exact: true })).toBeEnabled();
  await details.getByRole('button', { name: 'Mover cartão', exact: true }).click();
  await expect.poll(() => state.mutations.filter(item => item.method === 'POST' && item.path.endsWith('/move')).length).toBe(1);
  await expect(page.locator('.kanban-column[aria-label="Etapa Qualificação fictícia"] .kanban-card')).toContainText('Ana Exemplo');
  expect(state.mutations.find(item => item.path.endsWith('/move'))?.body).toMatchObject({
    conversationId: 'audit-req021-ana', sourceLabelId: 'stage-new', targetLabelId: labelId,
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await openCrm(page);
  await expect(page.locator('.kanban-column[aria-label="Etapa Qualificação fictícia"] .kanban-card')).toContainText('Ana Exemplo');
  await page.getByRole('button', { name: 'Etapas', exact: true }).click();
  const reopenedManager = page.getByRole('dialog', { name: 'Etapas e etiquetas' });
  const reopenedStage = reopenedManager.locator('.stage-list > div').filter({ hasText: 'Qualificação fictícia' });
  await expect(reopenedStage).toContainText('Validar oportunidade de auditoria.');
  await expect(reopenedStage.locator('i')).toHaveCSS('background-color', 'rgb(42, 136, 221)');
  expect(state.board.columns.find(column => column.id === labelId)?.conversationIds).toEqual(['audit-req021-ana']);
});