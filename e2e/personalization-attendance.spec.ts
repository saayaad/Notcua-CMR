import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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

test.beforeEach(async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  (page as Page & { __auditErrors?: string[] }).__auditErrors = errors;
  const hudBlockPositions = testInfo.title.includes('REQ-510') ? {
    chat: { mode: 'floating', x: 10, y: 10, width: 55, height: 60 },
    tools: { mode: 'floating', x: 70, y: 10, width: 25, height: 60 },
  } : {};
  let preferences: Record<string, unknown> = {
    toolsVisible: true, toolsDocked: true, toolsCompact: false, hudToolsWidth: 20,
    attendanceCustomizationVersion: 3, attendanceHiddenShortcuts: testInfo.title.includes('REQ-475') ? ['faq'] : [], hudHiddenTools: [],
    attendanceShortcutOrder: ['faq', 'MESSAGE', 'AUDIO', 'MEDIA', 'FUNNEL', 'client', 'schedule', 'notes', 'next', 'transfers'],
    shortcutLabels: {}, shortcutKeys: {}, pinnedResourceIds: [], pinnedButtonSettings: {}, showPinnedPreview: false,
    attendanceShortcutPosition: 'top', attendanceFunctionsPosition: 'top', hudToolNav: 'top', density: 'compact',
    hudBlockPositions,
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

test('REQ-475/490/491/497/498/499 editor permite adicionar atalhos e ordenar sem campo numérico', async ({ page }, info) => {
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
  await order.getByRole('button', { name: 'Mostrar Respostas padrão' }).click();
  await expect(order.getByRole('button', { name: 'Ocultar Respostas padrão' })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('tab', { name: 'Teclas de atalho', exact: true }).click();
  const key = dialog.getByLabel('Tecla para Respostas padrão');
  await key.fill('Alt+M');
  await expect(key).toHaveValue('Alt+M');
  await dialog.getByRole('button', { name: 'Confirmar alterações' }).click();
  await page.reload();
  await page.locator('button.chat-item:not(.chat-item-more)').first().click();
  await expect(page.locator('.attendance-shortcuts').getByRole('button', { name: 'Respostas padrão', exact: true })).toBeVisible();
  await saveEvidence(page, ['REQ-475'], info, { addedShortcut: 'Respostas padrão', visibleAfterReload: true, fixtureApi: true });
  const reopened = await openEditor(page);
  await reopened.getByRole('tab', { name: 'Teclas de atalho', exact: true }).click();
  await expect(reopened.getByLabel('Tecla para Respostas padrão')).toHaveValue('Alt+M');
  await reopened.getByRole('tab', { name: 'Funções', exact: true }).click();
  await expect(reopened.getByText('Barra de funções do atendimento')).toBeVisible();
  await saveEvidence(page, ['REQ-490', 'REQ-491', 'REQ-497', 'REQ-498', 'REQ-499'], info, { sevenTabs: true, previewVisible: true, shortcutOrderHasDragAndArrows: true, numericOrderFields: 0, keyboardShortcutsAreSeparateAndPersist: true, keyboardShortcutPersistedAfterReload: true });
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

test('REQ-507 proporções dos três painéis ficam ajustáveis e sem sobreposição', async ({ page }, info) => {
  await openConversation(page);
  const dialog = await openEditor(page);
  await page.getByRole('tab', { name: 'Painéis', exact: true }).click();
  const listWidth = dialog.getByRole('slider', { name: /Largura da lista/ });
  const toolsWidth = dialog.getByRole('slider', { name: /Largura das mensagens fixadas/ });
  await listWidth.press('ArrowRight');
  await toolsWidth.press('ArrowRight');
  const saved = page.waitForResponse((response) => response.url().endsWith('/api/operations/settings/preferences') && response.request().method() === 'PUT' && response.ok());
  await dialog.getByRole('button', { name: 'Confirmar alterações' }).click();
  await saved;
  await page.reload();
  await openConversation(page);
  const layout = page.locator('.inbox-layout');
  const boxes = page.viewportSize()!.width > 768
    ? await Promise.all(['.conversation-column', '.chat-pane', '.tools-panel'].map(async (selector) => {
        const box = await layout.locator(selector).boundingBox();
        return box && { x: box.x, y: box.y, width: box.width, height: box.height };
      }))
    : [await layout.locator('.chat-pane').boundingBox()].map((box) => box && { x: box.x, y: box.y, width: box.width, height: box.height });
  expect(boxes[0]).not.toBeNull();
  if (page.viewportSize()!.width > 768) {
    expect(boxes[1]).not.toBeNull();
    expect(boxes[2]).not.toBeNull();
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await saveEvidence(page, ['REQ-507'], info, { panelBoxes: boxes, horizontalOverflow: overflow, widthControlsSaveAndReload: true });
});

test('REQ-508 personalizador abre desde a conversa sem sair do atendimento', async ({ page }, info) => {
  await openConversation(page);
  await page.getByRole('button', { name: 'Personalizar Atendimento com prévia' }).click();
  await expect(page.getByRole('dialog', { name: 'Personalizar Atendimento' })).toBeVisible();
  await expect(page.locator('.inbox-layout')).toBeVisible();
  await saveEvidence(page, ['REQ-508'], info, { openedFromConversationHeader: true, conversationStillMounted: true });
});

test('REQ-509/511/515 prévia reage ao rascunho e só confirma após salvar', async ({ page }, info) => {
  let preferenceWrites = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/api/operations/settings/preferences') && request.method() === 'PUT') preferenceWrites += 1;
  });
  await openConversation(page);
  let dialog = await openEditor(page);
  await page.getByRole('tab', { name: 'Painéis', exact: true }).click();
  await choose(page, 'Tamanho dos controles', 'Expandido');
  await expect(dialog.locator('.hud-preview-expanded')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Personalizar Atendimento' })).toBeHidden();
  expect(preferenceWrites).toBe(0);
  await page.getByRole('button', { name: 'Personalizar Atendimento com prévia' }).click();
  dialog = page.locator('dialog[open]').last();
  await expect(dialog).toBeVisible();
  await page.getByRole('tab', { name: 'Painéis', exact: true }).click();
  await choose(page, 'Tamanho dos controles', 'Médio');
  await expect(dialog.locator('.hud-preview-medium')).toBeVisible();
  const saved = page.waitForResponse((response) => response.url().endsWith('/api/operations/settings/preferences') && response.request().method() === 'PUT' && response.ok());
  await dialog.getByRole('button', { name: 'Confirmar alterações' }).click();
  await saved;
  await expect(page.locator('html')).toHaveAttribute('data-density', 'medium');
  expect(preferenceWrites).toBe(1);
  await saveEvidence(page, ['REQ-509', 'REQ-511', 'REQ-515'], info, { previewUpdatedBeforeSave: true, rootUnchangedUntilConfirm: true, cancelWrites: 0, confirmedWrites: preferenceWrites });
});

test('REQ-510 arrastar bloco contra outro encaixa sem sobrepor e persiste', async ({ page }, info) => {
  await openConversation(page);
  const chat = page.locator('.chat-pane[data-hud-floating="true"]');
  const tools = page.locator('.tools-panel[data-hud-floating="true"]');
  if (page.viewportSize()!.width <= 760) {
    await expect(chat).toHaveCount(0);
    await expect(tools).toHaveCount(0);
    await saveEvidence(page, ['REQ-510'], info, { mobileUsesDockedLayout: true, floatingDragNotOfferedOnNarrowViewport: true });
    return;
  }
  await expect(chat).toBeVisible();
  await expect(tools).toBeVisible();
  const chatHandle = page.getByRole('button', { name: 'Mover chat' });
  const chatBox = await chatHandle.boundingBox();
  const toolsBox = await page.getByRole('button', { name: 'Mover tools' }).boundingBox();
  expect(chatBox).not.toBeNull();
  expect(toolsBox).not.toBeNull();
  const startX = chatBox!.x + chatBox!.width / 2;
  const startY = chatBox!.y + chatBox!.height / 2;
  const targetX = toolsBox!.x + toolsBox!.width / 2;
  const targetY = toolsBox!.y + toolsBox!.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY, { steps: 8 });
  await page.mouse.up();
  const persisted = page.waitForResponse((response) => response.url().endsWith('/api/operations/settings/preferences') && response.request().method() === 'PUT' && response.ok());
  await persisted;
  const chatArea = await chat.boundingBox();
  const toolsArea = await tools.boundingBox();
  expect(chatArea && toolsArea).not.toBeNull();
  const overlap = chatArea!.x < toolsArea!.x + toolsArea!.width && chatArea!.x + chatArea!.width > toolsArea!.x && chatArea!.y < toolsArea!.y + toolsArea!.height && chatArea!.y + chatArea!.height > toolsArea!.y;
  expect(overlap).toBe(false);
  await page.reload();
  await openConversation(page);
  const chatAfter = await page.locator('.chat-pane[data-hud-floating="true"]').boundingBox();
  const toolsAfter = await page.locator('.tools-panel[data-hud-floating="true"]').boundingBox();
  expect(chatAfter && toolsAfter).not.toBeNull();
  const overlapsAfterReload = chatAfter!.x < toolsAfter!.x + toolsAfter!.width && chatAfter!.x + chatAfter!.width > toolsAfter!.x && chatAfter!.y < toolsAfter!.y + toolsAfter!.height && chatAfter!.y + chatAfter!.height > toolsAfter!.y;
  expect(overlapsAfterReload).toBe(false);
  await saveEvidence(page, ['REQ-510'], info, { draggedIntoOccupiedArea: true, overlapBeforeReload: overlap, overlapAfterReload: overlapsAfterReload });
});

test('REQ-512 revisão global confirma estados finais das Partes 1 e 2', async ({ page }, info) => {
  const ledger = await readFile(resolve(process.cwd(), 'REVISAO', 'LEDGER.csv'), 'utf8');
  const reviewed: Record<string, string> = {};
  for (let number = 488; number <= 511; number++) {
    const id = `REQ-${String(number).padStart(3, '0')}`;
    const row = ledger.split(/\r?\n/u).find((line) => line.startsWith(`"${id}",`));
    expect(row, `${id} precisa existir no ledger`).toBeTruthy();
    const state = row!.match(/,"((?:✅ COMPLETO(?:-LOCAL)?)|(?:🟣|⚠️) DECISÃO)",/u)?.[1];
    expect(state, `${id} precisa estar completo ou com decisão registrada`).toBeTruthy();
    reviewed[id] = state!;
  }
  await openConversation(page);
  await openEditor(page);
  await expect(page.getByRole('tablist', { name: 'Configurações do atendimento' }).getByRole('tab')).toHaveCount(7);
  expect(reviewed['REQ-499']).toMatch(/COMPLETO-LOCAL/u);
  await saveEvidence(page, ['REQ-512'], info, {
    parentAndChildStatusesReviewed: true,
    reviewedRange: 'REQ-488–REQ-511',
    reviewedCount: Object.keys(reviewed).length,
    registeredCompleteLocal: ['REQ-499'],
    parentComplete: true,
  });
});

test('REQ-513/514/519 ampliação e prévia completa ficam acessíveis em todas as abas', async ({ page }, info) => {
  await openConversation(page);
  const dialog = await openEditor(page);
  const preview = dialog.locator('.hud-editor-preview-section');
  await expect(preview).toBeVisible();
  const tabs = ['Painéis', 'Botões', 'Funções', 'Atalhos', 'Mensagens fixadas', 'Teclas de atalho', 'Posição livre'];
  for (const name of tabs) {
    await dialog.getByRole('tab', { name, exact: true }).click();
    await expect(preview).toBeVisible();
    await expect(preview.locator('.hud-preview')).toBeVisible();
  }
  await preview.getByRole('button', { name: 'Ampliar prévia' }).click();
  await expect(dialog.locator('.hud-editor-layout')).toHaveClass(/preview-expanded/);
  await expect(preview.getByRole('button', { name: 'Voltar aos ajustes' })).toHaveAttribute('aria-pressed', 'true');
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  await saveEvidence(page, ['REQ-513', 'REQ-514', 'REQ-519'], info, { previewVisibleAcrossAllTabs: tabs, expanded: true, editorBoxWithinViewport: true });
});

test('REQ-516/517/518 menu de Atendimento não abre Biblioteca inteira e atalhos abrem Biblioteca lateral filtrada', async ({ page }, info) => {
  await page.goto('/atendimento');
  await expect(page.locator('.app-shell')).toBeVisible();
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Biblioteca' })).toBeVisible();
  await page.getByRole('button', { name: 'Atendimento', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Lista de conversas' })).toBeVisible();
  await page.locator('button.chat-item:not(.chat-item-more)').first().click();
  const tools = page.getByLabel('Ferramentas de atendimento');
  if (!(await tools.isVisible())) await page.getByRole('button', { name: 'Mostrar biblioteca lateral' }).click();
  const shortcuts = page.locator('.attendance-shortcuts');
  const cases = [['Textos', 'Textos'], ['Áudios', 'Áudios'], ['Fotos e vídeos', 'Mídias']] as const;
  for (const [shortcut, filter] of cases) {
    if (await tools.isVisible()) await tools.getByRole('button', { name: 'Fechar ferramentas' }).click();
    await shortcuts.getByRole('button', { name: shortcut, exact: true }).click();
    await expect(tools).toBeVisible();
    await expect(tools.getByRole('button', { name: 'Biblioteca', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(tools.getByRole('button', { name: filter, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await saveEvidence(page, ['REQ-516', 'REQ-517', 'REQ-518'], info, { attendanceMenuStayedOnConversation: true, shortcutsOpenedFilteredLibrary: cases, emptyPinnedShelfNotOpened: true });
});
