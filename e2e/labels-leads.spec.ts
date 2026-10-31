import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type Rule = {
  enabled: boolean;
  recordSale: boolean;
  askValue: boolean;
  fixedValueInCents: number;
  internalNote: string;
  pinConversation: boolean;
  investmentInCents: number;
};
type FinanceRow = {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  sales: number;
  revenueInCents: number;
};
type Mutation = { method: string; path: string; body: Record<string, unknown> | null };
type AuditState = {
  rules: Record<string, Rule>;
  mutations: Mutation[];
  blockedExternal: string[];
  consoleErrors: string[];
  pageErrors: string[];
  notes: Record<string, unknown>;
};
const states = new WeakMap<Page, AuditState>();
const evidenceRoot = resolve(process.cwd(), 'REVISAO', 'evidencias');

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    enabled: false, recordSale: false, askValue: true, fixedValueInCents: 0,
    internalNote: '', pinConversation: false, investmentInCents: 0, ...overrides,
  };
}
function stateOf(page: Page): AuditState { return states.get(page)!; }
function baseRows(): FinanceRow[] {
  return [
    { id: 'audit-label-paid', name: 'Pagamento concluído', color: '#16A34A', archived: false, sales: 1, revenueInCents: 10_000 },
    { id: 'audit-label-note', name: 'Nota interna', color: '#2563EB', archived: false, sales: 0, revenueInCents: 0 },
    { id: 'audit-label-pin', name: 'Fixar conversa', color: '#9333EA', archived: false, sales: 0, revenueInCents: 0 },
  ];
}

test.beforeEach(async ({ page }) => {
  const state: AuditState = {
    rules: {
      'audit-label-paid': makeRule({ investmentInCents: 2_000 }),
      'audit-label-note': makeRule({ enabled: true, internalNote: 'Anotação interna fictícia da auditoria.' }),
      'audit-label-pin': makeRule({ enabled: true, pinConversation: true }),
    },
    mutations: [], blockedExternal: [], consoleErrors: [], pageErrors: [], notes: {},
  };
  states.set(page, state);
  page.on('console', message => {
    if (message.type() === 'error') state.consoleErrors.push(message.text() + ' @ ' + message.location().url);
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
      if (method === 'GET' && url.pathname.endsWith('/label-finance')) {
        const items = baseRows().map(row => {
          const rule = state.rules[row.id] ?? makeRule();
          const roiPercent = rule.investmentInCents > 0
            ? (100 * (row.revenueInCents - rule.investmentInCents)) / rule.investmentInCents
            : null;
          return { ...row, rule, roiPercent };
        });
        return route.fulfill({ json: { items } });
      }
      if (method === 'GET' && url.pathname.includes('/label-rules/')) {
        const id = url.pathname.split('/').pop() ?? '';
        return route.fulfill({ json: state.rules[id] ?? makeRule() });
      }
      if (method === 'GET' && url.pathname.includes('/whatsapp/sessions/') && url.pathname.endsWith('/labels')) {
        return route.fulfill({ json: { items: [
          { id: 'audit-label-new', name: 'Novo lead', color: '#8B5CF6', whatsappId: null },
          { id: 'audit-label-budget', name: 'Orçamento', color: '#F59E0B', whatsappId: null },
          { id: 'audit-label-client', name: 'Cliente', color: '#10B981', whatsappId: null },
          { id: 'audit-label-paid', name: 'Pagamento concluído', color: '#16A34A', whatsappId: null },
          { id: 'audit-label-note', name: 'Nota interna', color: '#2563EB', whatsappId: null },
          { id: 'audit-label-pin', name: 'Fixar conversa', color: '#9333EA', whatsappId: null },
        ] } });
      }
      if (method !== 'GET') {
        let body: Record<string, unknown> | null = null;
        try { body = request.postDataJSON() as Record<string, unknown>; } catch {}
        state.mutations.push({ method, path: url.pathname, body });
        if (method === 'PUT' && url.pathname.includes('/label-rules/')) {
          const id = url.pathname.split('/').pop() ?? '';
          state.rules[id] = { ...makeRule(), ...(body ?? {}) } as Rule;
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{"saved":true}' });
      }
    }
    if (url.port === '3340' && method !== 'GET') {
      state.mutations.push({ method, path: url.pathname, body: null });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"saved":true}' });
    }
    return route.fallback();
  });
});

test.afterEach(async ({ page }, info) => {
  const state = states.get(page);
  if (!state) return;
  const ids = [...new Set([...info.title.matchAll(/REQ-\d{3}/g)].map(match => match[0]))];
  const unexpectedConsole = state.consoleErrors.filter(error => !error.includes('ERR_BLOCKED_BY_CLIENT'));
  const result = info.status === 'passed' && state.pageErrors.length === 0 && unexpectedConsole.length === 0
    ? 'APROVADO' : 'FALHOU';
  let screenshotError = '';
  for (const id of ids) {
    const directory = resolve(evidenceRoot, id);
    const suffix = info.project.name.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
    await mkdir(directory, { recursive: true });
    try { await page.screenshot({ path: resolve(directory, 'labels-' + suffix + '.png'), fullPage: true, animations: 'disabled' }); }
    catch (error) { screenshotError = String(error); }
    await writeFile(resolve(directory, 'labels-' + suffix + '.json'), JSON.stringify({
      req: id, result, project: info.project.name, url: page.isClosed() ? '' : page.url(),
      viewport: page.viewportSize(), consoleErrors: state.consoleErrors, pageErrors: state.pageErrors,
      blockedExternal: [...new Set(state.blockedExternal)],
      interceptedMutations: state.mutations.map(item => item.method + ' ' + item.path),
      notes: state.notes, failures: info.errors.map(error => error.message), screenshotError,
    }, null, 2), 'utf8');
  }
  if (info.status === 'passed') {
    expect(state.pageErrors, 'erros de página').toEqual([]);
    expect(unexpectedConsole, 'erros inesperados de console').toEqual([]);
  }
});

async function openApp(page: Page) {
  await page.goto('/atendimento', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 });
}
async function openCrm(page: Page) {
  await openApp(page);
  await page.getByRole('button', { name: 'CRM e negócios', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'CRM e negócios' })).toBeVisible();
}
async function openFinance(page: Page) {
  await openCrm(page);
  await page.getByRole('button', { name: 'Etiquetas e ações', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Etiquetas e ações' });
  await expect(dialog.locator('.label-finance')).toBeVisible();
}
function financeRow(page: Page, name: string) {
  return page.locator('.label-finance-list article').filter({ hasText: name });
}
async function openAnaDetails(page: Page) {
  await openApp(page);
  const ana = page.locator('button.chat-item:not(.chat-item-more)').filter({ hasText: 'Ana Exemplo' }).first();
  await expect(ana).toBeVisible();
  await ana.click();
  await expect(page.locator('.client-name-button')).toBeVisible();
  await page.locator('.client-name-button').click();
  const dialog = page.getByRole('dialog', { name: 'Informações do cliente' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Editar etiquetas do cliente' }).click();
  await expect(dialog.locator('.tag-picker')).toBeVisible();
  return dialog;
}
async function chooseLabel(dialog: ReturnType<Page['getByRole']>, name: string) {
  await dialog.locator('.tag-picker').getByRole('button', { name, exact: true }).click();
}

test('REQ-596 configura ações personalizadas por etiqueta e recupera após recarregar', async ({ page }) => {
  await openFinance(page);
  await financeRow(page, 'Pagamento concluído').getByRole('button', { name: 'Configurar ações' }).click();
  let editor = page.getByRole('dialog', { name: 'Ações · Pagamento concluído' });
  await expect(editor).toBeVisible();
  await editor.getByRole('button', { name: /Usar modelo/ }).click();
  await editor.getByLabel('Adicionar nota interna (opcional)').fill('Nota fictícia configurada em REQ-596.');
  await editor.getByLabel('Fixar a conversa ao aplicar').check();
  await editor.getByLabel('Investimento atribuído a esta etiqueta (R$)').fill('50,00');
  const investment = editor.getByLabel('Investimento atribuído a esta etiqueta (R$)');
  await editor.getByRole('button', { name: 'Salvar ações' }).click();
  await expect.poll(() => stateOf(page).mutations.some(item => item.method === 'PUT' && item.path.includes('/label-rules/audit-label-paid'))).toBe(true);
  stateOf(page).notes = { ruleSaved: stateOf(page).rules['audit-label-paid'] };
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openFinance(page);
  await financeRow(page, 'Pagamento concluído').getByRole('button', { name: 'Configurar ações' }).click();
  editor = page.getByRole('dialog', { name: 'Ações · Pagamento concluído' });
  await expect(editor.getByLabel('Ativar ações desta etiqueta')).toBeChecked();
  await expect(editor.getByLabel('Registrar venda e marcar negócio como ganho')).toBeChecked();
  await expect(editor.getByLabel('Perguntar o valor a cada venda')).toBeChecked();
  await expect(editor.getByLabel('Adicionar nota interna (opcional)')).toHaveValue('Nota fictícia configurada em REQ-596.');
  await expect(editor.getByLabel('Fixar a conversa ao aplicar')).toBeChecked();
  await expect(editor.getByLabel('Investimento atribuído a esta etiqueta (R$)')).toHaveValue('50.00');
  stateOf(page).notes = { ...stateOf(page).notes, reloadedRule: stateOf(page).rules['audit-label-paid'], investmentField: await investment.inputValue() };
});

test('REQ-597 pede o valor de venda antes de aplicar Pagamento concluído', async ({ page }) => {
  stateOf(page).rules['audit-label-paid'] = makeRule({ enabled: true, recordSale: true, askValue: true, investmentInCents: 2_000 });
  const details = await openAnaDetails(page);
  await chooseLabel(details, 'Pagamento concluído');
  const prompt = page.getByRole('dialog', { name: 'Registrar venda ao aplicar etiqueta' });
  await expect(prompt.getByLabel(/Qual foi o valor da venda/)).toBeVisible();
  await prompt.getByRole('button', { name: 'Confirmar e aplicar etiqueta' }).click();
  await expect(prompt.getByRole('alert')).toContainText('maior que zero');
  const path = '/api/attendance/sessions/audit-session/conversations/audit-conversation-1/labels/audit-label-paid';
  expect(stateOf(page).mutations.filter(item => item.path === path)).toHaveLength(0);
  await prompt.getByLabel(/Qual foi o valor da venda/).fill('89,90');
  await prompt.getByRole('button', { name: 'Confirmar e aplicar etiqueta' }).click();
  await expect.poll(() => stateOf(page).mutations.filter(item => item.path === path).length).toBe(1);
  const body = stateOf(page).mutations.find(item => item.path === path)?.body;
  expect(body).toMatchObject({ active: true, confirmActions: true, saleValueInCents: 8_990 });
  stateOf(page).notes = { promptRequiredValue: true, invalidValueBlocked: true, requestBody: body, outboundMessage: false };
});

test('REQ-598 exige confirmação e cancelar não aplica ação de etiqueta', async ({ page }) => {
  const details = await openAnaDetails(page);
  await chooseLabel(details, 'Nota interna');
  const prompt = page.getByRole('dialog', { name: 'Confirmar ações da etiqueta' });
  await expect(prompt).toContainText('Anotação interna fictícia da auditoria.');
  await expect(prompt.getByRole('button', { name: 'Confirmar e aplicar etiqueta' })).toBeVisible();
  const path = '/api/attendance/sessions/audit-session/conversations/audit-conversation-1/labels/audit-label-note';
  expect(stateOf(page).mutations.filter(item => item.path === path)).toHaveLength(0);
  await prompt.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(stateOf(page).mutations.filter(item => item.path === path)).toHaveLength(0);
  stateOf(page).notes = { confirmationShownBeforeMutation: true, cancelledWithoutWrite: true };
});

test('REQ-599 exibe receita e ROI calculado por vendas atribuídas e investimento', async ({ page }) => {
  await openFinance(page);
  const row = financeRow(page, 'Pagamento concluído');
  await expect(row).toContainText(/1 vendas.*Receita.*100,00.*Investimento.*20,00/s);
  await expect(row).toContainText(/Retorno estimado: 400%/);
  stateOf(page).notes = { wonSales: 1, revenueInCents: 10_000, investmentInCents: 2_000, roiPercent: 400 };
});

test('REQ-600 explica que o retorno estimado não é lucro líquido', async ({ page }) => {
  await openFinance(page);
  await financeRow(page, 'Pagamento concluído').getByRole('button', { name: 'Configurar ações' }).click();
  const editor = page.getByRole('dialog', { name: 'Ações · Pagamento concluído' });
  await expect(editor).toContainText(/ROI compara receita de vendas ganhas e investimento informado/);
  await expect(editor).toContainText('Não representa lucro líquido.');
  stateOf(page).notes = { roiUsesWonRevenueAndInvestment: true, profitNotInferred: true };
});

test('REQ-601 mostra e aplica nota interna da etiqueta sem enviar ao cliente', async ({ page }) => {
  const details = await openAnaDetails(page);
  await chooseLabel(details, 'Nota interna');
  const prompt = page.getByRole('dialog', { name: 'Confirmar ações da etiqueta' });
  await expect(prompt).toContainText('Nota interna: Anotação interna fictícia da auditoria.');
  await expect(prompt).toContainText('Nenhuma mensagem será enviada ao cliente.');
  await prompt.getByRole('button', { name: 'Confirmar e aplicar etiqueta' }).click();
  const path = '/api/attendance/sessions/audit-session/conversations/audit-conversation-1/labels/audit-label-note';
  await expect.poll(() => stateOf(page).mutations.filter(item => item.path === path).length).toBe(1);
  const body = stateOf(page).mutations.find(item => item.path === path)?.body;
  expect(body).toMatchObject({ active: true, confirmActions: true });
  expect(stateOf(page).mutations.some(item => item.path.includes('/send'))).toBe(false);
  stateOf(page).notes = { internalNotePreviewed: true, actionConfirmed: true, requestBody: body, outboundMessage: false };
});

test('REQ-602 mostra e aplica a ação de fixar conversa após confirmação', async ({ page }) => {
  const details = await openAnaDetails(page);
  await chooseLabel(details, 'Fixar conversa');
  const prompt = page.getByRole('dialog', { name: 'Confirmar ações da etiqueta' });
  await expect(prompt).toContainText('A conversa será fixada.');
  await expect(prompt.getByRole('button', { name: 'Confirmar e aplicar etiqueta' })).toBeVisible();
  const path = '/api/attendance/sessions/audit-session/conversations/audit-conversation-1/labels/audit-label-pin';
  expect(stateOf(page).mutations.filter(item => item.path === path)).toHaveLength(0);
  await prompt.getByRole('button', { name: 'Confirmar e aplicar etiqueta' }).click();
  await expect.poll(() => stateOf(page).mutations.filter(item => item.path === path).length).toBe(1);
  expect(stateOf(page).mutations.find(item => item.path === path)?.body).toMatchObject({ active: true, confirmActions: true });
  stateOf(page).notes = { pinPreviewed: true, actionConfirmed: true, pinnedConversationAction: true };
});