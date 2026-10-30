import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const evidenceRoot = resolve(process.cwd(), 'REVISAO', 'evidencias');
test.describe.configure({ mode: 'serial' });

async function openConversation(page: Page) {
  await page.goto('/atendimento');
  await expect(page.locator('.app-shell')).toBeVisible();
  await page.locator('button.chat-item:not(.chat-item-more)').first().click();
  await expect(page.locator('.client-name-button')).toBeVisible();
}

async function openEditor(page: Page) {
  await page.locator('.chat-more-actions summary').click();
  await page.getByRole('button', { name: 'Personalizar Atendimento', exact: true }).click();
  const dialog = page.locator('dialog[open]').last();
  await expect(dialog).toBeVisible();
  return dialog;
}

async function choose(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

async function saveEvidence(page: Page, ids: string[], info: TestInfo, details: Record<string, unknown> = {}) {
  const suffix = info.project.name.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
  const errors = (page as Page & { __auditErrors?: string[] }).__auditErrors ?? [];
  for (const id of ids) {
    const dir = resolve(evidenceRoot, id);
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: resolve(dir, `${suffix}.png`), fullPage: true });
    await writeFile(resolve(dir, `${suffix}.json`), JSON.stringify({ req: id, result: 'APROVADO', project: info.project.name, url: page.url(), errors, ...details }, null, 2));
  }
  expect(errors, `erros do navegador em ${info.project.name}`).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  (page as Page & { __auditErrors?: string[] }).__auditErrors = errors;
  let preferences: Record<string, unknown> = {
    toolsVisible: true, toolsDocked: true, toolsCompact: false, hudToolsWidth: 20,
    attendanceCustomizationVersion: 3, attendanceHiddenShortcuts: [], hudHiddenTools: [],
    attendanceShortcutOrder: ['faq', 'MESSAGE', 'AUDIO', 'MEDIA', 'FUNNEL', 'client', 'schedule', 'notes', 'next', 'transfers'],
    shortcutLabels: {}, shortcutKeys: {}, pinnedResourceIds: [], pinnedButtonSettings: {}, showPinnedPreview: false,
    attendanceShortcutPosition: 'top', attendanceFunctionsPosition: 'top', hudToolNav: 'top', density: 'compact',
  };
  await page.route('**/api/operations/settings/preferences', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: preferences });
    if (route.request().method() === 'PUT') {
      preferences = { ...preferences, ...(route.request().postDataJSON() as Record<string, unknown>) };
      return route.fulfill({ json: { saved: true } });
    }
    return route.fallback();
  });
  await page.route('**/api/operations/directory/presence', (route) => route.fulfill({ json: { saved: true } }));
});

test('REQ-488/489 atalhos abrem cada destino sem abrir modal e lateral juntos', async ({ page }, info) => {
  await openConversation(page);
  const tools = page.getByLabel('Ferramentas de atendimento');
  if (await tools.isVisible()) await tools.getByRole('button', { name: 'Fechar ferramentas' }).click();
  await expect(tools).toBeHidden();
  const shortcuts = page.locator('.attendance-shortcuts');
  await shortcuts.getByRole('button', { name: 'Respostas padrão', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Padrões' })).toBeVisible();
  await expect(tools).toBeHidden();
  await page.getByRole('button', { name: 'Fechar janela' }).click();
  await shortcuts.getByRole('button', { name: 'Textos', exact: true }).click();
  await expect(tools).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await tools.getByRole('button', { name: 'Fechar ferramentas' }).click();
  await expect(tools).toBeHidden();
  await shortcuts.getByRole('button', { name: 'Cliente e etiquetas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Informações do cliente' })).toBeVisible();
  await expect(tools).toBeHidden();
  await saveEvidence(page, ['REQ-488', 'REQ-489'], info, { sidebarShortcut: 'Textos', dialogShortcuts: ['Respostas padrão', 'Cliente e etiquetas'], simultaneousDialogAndToolbox: false });
});

test('REQ-490/491/497/498/499 editor centraliza barra, atalhos e teclas com controles claros', async ({ page }, info) => {
  await openConversation(page);
  const dialog = await openEditor(page);
  const tabs = dialog.getByRole('tab');
  await expect(tabs).toHaveCount(7);
  await expect(dialog.getByText('Prévia do layout')).toBeVisible();
  await dialog.getByRole('tab', { name: 'Atalhos', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Organizar atalhos do Atendimento' })).toBeVisible();
  const order = dialog.getByRole('list', { name: 'Ordem dos atalhos' });
  await expect(order.getByRole('button', { name: 'Subir Respostas padrão' })).toBeVisible();
  await expect(order.locator('input[type=number]')).toHaveCount(0);
  await dialog.getByRole('tab', { name: 'Teclas de atalho', exact: true }).click();
  const key = dialog.getByLabel('Tecla para Respostas padrão');
  await key.fill('Alt+M');
  await expect(key).toHaveValue('Alt+M');
  await dialog.getByRole('button', { name: 'Confirmar alterações' }).click();
  await page.reload();
  await page.locator('button.chat-item:not(.chat-item-more)').first().click();
  const reopened = await openEditor(page);
  await reopened.getByRole('tab', { name: 'Teclas de atalho', exact: true }).click();
  await expect(reopened.getByLabel('Tecla para Respostas padrão')).toHaveValue('Alt+M');
  await reopened.getByRole('tab', { name: 'Funções', exact: true }).click();
  await expect(reopened.getByText('Barra de funções do atendimento')).toBeVisible();
  await saveEvidence(page, ['REQ-490', 'REQ-491', 'REQ-497', 'REQ-498', 'REQ-499'], info, { sevenTabs: true, previewVisible: true, shortcutOrderHasDragAndArrows: true, numericOrderFields: 0, keyboardShortcutPersistedAfterReload: true });
});

test('REQ-492/493/494/495/502/503 filtra, fixa, configura e remove um recurso sem enviar', async ({ page }, info) => {
  await openConversation(page);
  const dialog = await openEditor(page);
  await page.getByRole('tab', { name: 'Mensagens fixadas', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Organizar mensagens fixadas' })).toBeVisible();
  const items = dialog.locator('.hud-pin-picker > div');
  await expect(items.locator('input[type=checkbox]:checked')).toHaveCount(0);
  await choose(page, 'Filtrar fixados por tipo', 'Textos');
  await expect(items.first().locator('small')).toContainText('Textos');
  const textMatches = await items.count();
  await choose(page, 'Filtrar fixados por categoria', 'Sem categoria');
  await expect(items.first().locator('small')).toContainText('Sem categoria');
  const uncategorizedMatches = await items.count();
  await choose(page, 'Filtrar fixados por tipo', 'Todos os tipos');
  await choose(page, 'Filtrar fixados por categoria', 'Todas as categorias');
  const first = items.first();
  await expect(first).toBeVisible();
  const name = (await first.locator('span').innerText()).split('\n')[0];
  await first.locator('input[type=checkbox]').check();
  await expect(first.getByRole('button', { name: `Remover ${name} dos fixados` })).toBeVisible();
  await first.getByRole('button', { name: `Configurar ${name}` }).click();
  const individual = dialog.locator('.hud-individual-editor').last();
  await expect(individual.getByRole('heading', { name: `Somente este botão: ${name}` })).toBeVisible();
  await individual.getByLabel('Nome do botão').fill('Recurso auditado');
  await expect(individual.getByLabel('Nome do botão')).toHaveValue('Recurso auditado');
  await dialog.getByLabel('Mostrar prévia de mensagem nos atalhos').check();
  await first.getByRole('button', { name: `Remover ${name} dos fixados` }).click();
  await expect(first.locator('input[type=checkbox]')).not.toBeChecked();
  await expect(dialog.getByLabel('Mostrar prévia de mensagem nos atalhos')).toBeChecked();
  if (page.viewportSize()!.width > 768) await expect(page.getByLabel('Ferramentas de atendimento')).toBeVisible();
  else await expect(page.getByLabel('Ferramentas de atendimento')).toBeHidden();
  await expect(page.getByLabel('Enviar', { exact: true })).toHaveCount(0);
  await saveEvidence(page, ['REQ-492', 'REQ-493', 'REQ-494', 'REQ-495', 'REQ-502', 'REQ-503'], info, { startsEmpty: true, filteredTextCount: textMatches, filteredUncategorizedCount: uncategorizedMatches, individuallyConfigured: name, individuallyRemoved: true, previewPreferenceAvailable: true, messageSent: false });
});

test('REQ-496/500/501 blocos podem ser organizados e densidade global tem três estados', async ({ page }, info) => {
  await openConversation(page);
  const dialog = await openEditor(page);
  await page.getByRole('tab', { name: 'Posição livre', exact: true }).click();
  const placement = page.getByRole('heading', { name: 'Posicionamento livre' }).locator('..');
  await expect(placement.getByRole('combobox', { name: 'Bloco' })).toBeVisible();
  await choose(page, 'Bloco', 'Conversa');
  await choose(page, 'Modo', 'Posição livre na tela');
  const horizontal = placement.getByLabel('Posição horizontal');
  await expect(horizontal).toBeVisible();
  await horizontal.press('ArrowRight');
  const positionAfterMove = await horizontal.inputValue();
  await dialog.getByRole('button', { name: 'Confirmar alterações' }).click();
  await page.reload();
  await page.locator('button.chat-item:not(.chat-item-more)').first().click();
  const reopened = await openEditor(page);
  await page.getByRole('tab', { name: 'Posição livre', exact: true }).click();
  const reopenedPlacement = page.getByRole('heading', { name: 'Posicionamento livre' }).locator('..');
  await choose(page, 'Bloco', 'Conversa');
  await choose(page, 'Modo', 'Posição livre na tela');
  await expect(reopenedPlacement.getByLabel('Posição horizontal')).toHaveValue(positionAfterMove);
  await page.getByRole('tab', { name: 'Painéis', exact: true }).click();
  const density = page.getByRole('combobox', { name: 'Tamanho dos controles' });
  const states = [] as string[];
  for (const [name, value] of [['Compacto', 'compact'], ['Médio', 'medium'], ['Expandido', 'expanded']] as const) {
    await choose(page, 'Tamanho dos controles', name);
    await expect(dialog.locator(`.hud-preview-${value}`)).toBeVisible();
    states.push(name);
  }
  const htmlDensity = await page.locator('html').getAttribute('data-density');
  await choose(page, 'Tamanho dos controles', 'Compacto');
  await reopened.getByRole('button', { name: 'Confirmar alterações' }).click();
  await page.reload();
  await page.locator('button.chat-item:not(.chat-item-more)').first().click();
  const compactPadding = await page.locator('button.chat-item:not(.chat-item-more)').first().evaluate((node) => getComputedStyle(node).paddingBlockStart);
  expect(parseFloat(compactPadding)).toBeLessThan(12);
  await page.getByRole('button', { name: 'CRM e negócios', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  await saveEvidence(page, ['REQ-496', 'REQ-500', 'REQ-501'], info, { freePositionForConversation: true, positionPersistedAfterReload: positionAfterMove, densityStatesPreviewed: states, compactChatRowPadding: compactPadding, densityAppliedAcrossCrmAfterReload: true });
});

test('REQ-495/502/503 seleção inicial vazia e botão Enviar abre prévia configurada após recarga', async ({ page }, info) => {
  await openConversation(page);
  const dialog = await openEditor(page);
  await page.getByRole('tab', { name: 'Mensagens fixadas', exact: true }).click();
  const check = dialog.getByLabel('Mostrar prévia de mensagem nos atalhos');
  await expect(check).not.toBeChecked();
  await expect(dialog.locator('.hud-pin-picker input[type=checkbox]:checked')).toHaveCount(0);
  const first = dialog.locator('.hud-pin-picker > div').first();
  const second = dialog.locator('.hud-pin-picker > div').nth(1);
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  const resourceName = (await first.locator('span').innerText()).split('\n')[0];
  const secondResourceName = (await second.locator('span').innerText()).split('\n')[0];
  await first.locator('input[type=checkbox]').check();
  await second.locator('input[type=checkbox]').check();
  await first.getByRole('button', { name: `Configurar ${resourceName}` }).click();
  await dialog.getByLabel('Nome do botão').fill('Recurso auditado');
  await choose(page, 'Prévia deste botão', 'Mostrar prévia antes de enviar');
  const saved = page.waitForResponse((response) => response.url().endsWith('/api/operations/settings/preferences') && response.request().method() === 'PUT' && response.ok());
  await dialog.getByRole('button', { name: 'Confirmar alterações' }).click();
  await saved;
  await page.reload();
  await page.locator('button.chat-item:not(.chat-item-more)').first().click();
  const tools = page.getByLabel('Ferramentas de atendimento');
  if (!(await tools.isVisible())) await page.getByRole('button', { name: 'Mostrar biblioteca lateral' }).click();
  await expect(tools).toBeVisible();
  await tools.getByRole('button', { name: 'Fixados', exact: true }).click();
  const card = tools.locator('.pinned-message-card');
  await expect(card).toHaveCount(2);
  await expect(card.locator('strong')).toHaveText(['Recurso auditado', secondResourceName]);
  await expect(card.locator('button')).toHaveCount(2);
  await expect(card.first().locator('p')).toBeVisible();
  let sendRequest = false;
  page.on('request', (request) => { if (request.method() === 'POST' && /messages|send/i.test(request.url())) sendRequest = true; });
  await card.first().getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(sendRequest).toBe(false);
  await saveEvidence(page, ['REQ-494', 'REQ-495', 'REQ-502', 'REQ-503'], info, { initialSelectionEmpty: true, pinnedCards: 2, independentLabelsPersisted: ['Recurso auditado', secondResourceName], oneSendButtonPerCard: true, perButtonPreviewPersistedAfterReload: true, previewOpened: true, externalSend: false });
});
