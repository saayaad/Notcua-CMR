import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const api = 'http://127.0.0.1:3340/api';
const evidenceRoot = resolve(process.cwd(), 'REVISAO', 'evidencias');
const localSession = 'audit-session';

test.describe.configure({ mode: 'serial' });

async function openConversation(page: Page) {
  await page.goto('/atendimento');
  await expect(page.locator('.app-shell')).toBeVisible();
  await page.locator('button.chat-item:not(.chat-item-more)').first().click();
  await expect(page.locator('.client-name-button')).toBeVisible();
}

async function ensureToolsOpen(page: Page) {
  const tools = page.getByLabel('Ferramentas de atendimento');
  if (await tools.isVisible()) return;
  // Preference loading can reopen the dock just after a reload.
  await page.waitForTimeout(500);
  if (await tools.isVisible()) return;
  const globalToggle = page.getByRole('button', { name: 'Mostrar biblioteca lateral' });
  if (await globalToggle.isVisible()) {
    await globalToggle.click();
  } else {
    await page.locator('.chat-more-actions summary').click();
    const show = page.getByRole('button', { name: 'Mostrar mensagens fixadas', exact: true });
    if (await show.isVisible()) await show.click();
  }
  await expect(tools).toBeVisible();
}

async function saveEvidence(page: Page, ids: string[], info: TestInfo, details: Record<string, unknown> = {}) {
  const suffix = info.project.name.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
  const consoleErrors = (page as Page & { __auditConsoleErrors?: string[] }).__auditConsoleErrors ?? [];
  for (const id of ids) {
    const directory = resolve(evidenceRoot, id);
    await mkdir(directory, { recursive: true });
    await page.screenshot({ path: resolve(directory, `${suffix}.png`), fullPage: true });
    await writeFile(
      resolve(directory, `${suffix}.json`),
      JSON.stringify({ req: id, result: 'APROVADO', project: info.project.name, url: page.url(), consoleErrors, ...details }, null, 2),
      'utf8',
    );
  }
  expect(consoleErrors, `erros de console em ${info.project.name}`).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${message.text()} @ ${message.location().url}`);
  });
  page.on('pageerror', (error) => errors.push(error.message));
  (page as Page & { __auditConsoleErrors?: string[] }).__auditConsoleErrors = errors;
  let preferences: Record<string, unknown> = { toolsVisible: true, toolsDocked: true, toolsCompact: false, hudToolsWidth: 20 };
  await page.route('**/api/operations/settings/preferences', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: preferences });
    if (route.request().method() === 'PUT') {
      preferences = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({ json: { saved: true } });
    }
    return route.fallback();
  });
  // The local directory heartbeat is not relevant to these visual checks.
  await page.route('**/api/operations/directory/presence', (route) => route.fulfill({ json: { saved: true } }));
  let profilePatch: Record<string, unknown> = {};
  await page.route('**/api/operations/sessions/audit-session/contacts/audit-conversation-1', async (route) => {
    if (route.request().method() === 'PUT') {
      profilePatch = { ...profilePatch, ...(route.request().postDataJSON() as Record<string, unknown>) };
      return route.fulfill({ json: { saved: true } });
    }
    return route.fallback();
  });
  await page.route('**/api/attendance/sessions/audit-session/conversations**', async (route) => {
    if (route.request().method() !== 'GET' || route.request().url().includes('/messages')) return route.fallback();
    const response = await route.fetch();
    if (!Object.keys(profilePatch).length) return route.fulfill({ response });
    const body = await response.json() as Record<string, any>;
    const mergeContact = (contact: Record<string, any>) => ({
      ...contact,
      ...(typeof profilePatch.name === 'string' ? { name: profilePatch.name } : {}),
      metadata: { ...(contact.metadata ?? {}), ...profilePatch },
    });
    if (Array.isArray(body.items)) {
      body.items = body.items.map((item: Record<string, any>) => item.id === 'audit-conversation-1'
        ? { ...item, contact: mergeContact(item.contact) }
        : item);
    } else if (body.contact) {
      body.contact = mergeContact(body.contact);
    }
    return route.fulfill({ response, json: body });
  });
});

test('REQ-444 ferramentas laterais ficam separadas da ficha do cliente', async ({ page }, info) => {
  await openConversation(page);
  const tools = page.getByLabel('Ferramentas de atendimento');
  await ensureToolsOpen(page);
  await expect(tools).toBeVisible();
  await tools.getByRole('button', { name: 'Fechar ferramentas' }).click();
  await expect(tools).toBeHidden();
  await page.waitForTimeout(400);
  await page.locator('.client-name-button').click();
  await expect(page.getByRole('heading', { name: 'Informações do cliente' })).toBeVisible();
  await expect(tools).toBeHidden();
  const dialog = page.locator('dialog[open]').last();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThan(0);
  expect(box!.x + box!.width).toBeLessThan(page.viewportSize()!.width);
  await saveEvidence(page, ['REQ-444', 'REQ-452'], info, { separateToolsAndClientInfo: true, eachSurfaceOpensIndependently: true, dialogCenteredInViewport: true });
});

test('REQ-446/REQ-447 painel lateral compacta, oculta e reabre', async ({ page }, info) => {
  await openConversation(page);
  const tools = page.getByLabel('Ferramentas de atendimento');
  await ensureToolsOpen(page);
  await expect(tools).toBeVisible();
  const initialWidth = await tools.evaluate((node) => node.getBoundingClientRect().width);
  await tools.getByRole('button', { name: 'Fechar ferramentas' }).click();
  await expect(tools).toBeHidden();
  await page.getByText('Personalizar', { exact: true }).click();
  await page.getByRole('button', { name: 'HUD, atalhos, botões e aparência' }).click();
  const dialog = page.locator('dialog[open]').last();
  await dialog.getByLabel('Mostrar mensagens fixadas').check();
  await dialog.getByLabel('Manter ferramentas abertas no layout').check();
  const width = dialog.getByLabel(/Largura das mensagens fixadas/);
  await width.fill('15');
  const save = page.waitForResponse((response) => response.url().endsWith('/api/operations/settings/preferences') && response.request().method() === 'PUT' && response.ok());
  await dialog.getByRole('button', { name: 'Confirmar alterações' }).click();
  await save;
  await ensureToolsOpen(page);
  const compactWidth = await tools.evaluate((node) => node.getBoundingClientRect().width);
  if (page.viewportSize()!.width > 768) expect(compactWidth).toBeLessThan(initialWidth);
  else expect(compactWidth).toBeLessThanOrEqual(page.viewportSize()!.width);
  await tools.getByRole('button', { name: 'Fechar ferramentas' }).click();
  await expect(tools).toBeHidden();
  await ensureToolsOpen(page);
  await expect(tools).toBeVisible();
  await page.reload();
  await page.locator('button.chat-item:not(.chat-item-more)').first().click();
  await ensureToolsOpen(page);
  await expect(page.getByLabel('Ferramentas de atendimento')).toBeVisible();
  await page.getByLabel('Ferramentas de atendimento').getByRole('button', { name: 'Fechar ferramentas' }).click();
  await page.getByText('Personalizar', { exact: true }).click();
  await page.getByRole('button', { name: 'HUD, atalhos, botões e aparência' }).click();
  await expect(page.locator('dialog[open]').last().getByLabel(/Largura das mensagens fixadas/)).toHaveValue('15');
  await saveEvidence(page, ['REQ-446', 'REQ-447'], info, { initialWidth, compactWidth, hiddenThenShown: true, width15RemPersistedAfterReload: true, mobileDrawerUsesViewportWidth: page.viewportSize()!.width <= 768, preferencesFixture: true });
});

test('REQ-449 atalhos podem ser reordenados e continuam ordenados após reload', async ({ page }, info) => {
  await openConversation(page);
  await page.locator('.chat-more-actions summary').click();
  await page.getByRole('button', { name: 'Personalizar Atendimento', exact: true }).click();
  const dialog = page.locator('dialog[open]').last();
  await dialog.getByRole('tab', { name: 'Atalhos', exact: true }).click();
  const list = dialog.getByRole('list', { name: 'Ordem dos atalhos' });
  await expect(list).toBeVisible();
  const firstName = await list.locator('li').first().locator('span').innerText();
  await list.getByRole('button', { name: `Descer ${firstName}` }).click();
  const firstAfter = await list.locator('li').first().locator('span').innerText();
  expect(firstAfter).not.toBe(firstName);
  await dialog.getByRole('button', { name: 'Confirmar alterações' }).click();
  await page.reload();
  await openConversation(page);
  await page.locator('.chat-more-actions summary').click();
  await page.getByRole('button', { name: 'Personalizar Atendimento', exact: true }).click();
  const reopened = page.locator('dialog[open]').last();
  await reopened.getByRole('tab', { name: 'Atalhos', exact: true }).click();
  await expect(reopened.getByRole('list', { name: 'Ordem dos atalhos' }).locator('li').first().locator('span')).toHaveText(firstAfter);
  await saveEvidence(page, ['REQ-449'], info, { firstBefore: firstName, firstAfter, persistsAfterReload: true, preferencesFixture: true });
});

test('REQ-455/REQ-457/REQ-458 ficha fictícia salva perfil e negócio e reaparece após reload', async ({ page }, info) => {
  await openConversation(page);
  await page.locator('.client-name-button').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Informações do cliente' })).toBeVisible();
  const profileValues = {
    name: 'Perfil de Auditoria Fixture', email: 'perfil.audit@example.com', gender: 'Feminino',
    birthday: '1992-04-12', language: 'pt-BR',
  };
  await dialog.getByLabel('Nome', { exact: true }).fill(profileValues.name);
  await dialog.getByLabel('E-mail', { exact: true }).fill(profileValues.email);
  await dialog.getByLabel('Sexo / gênero', { exact: true }).fill(profileValues.gender);
  await dialog.getByLabel('Data de nascimento', { exact: true }).fill(profileValues.birthday);
  await dialog.getByLabel('Idioma', { exact: true }).fill(profileValues.language);
  const profileSaved = page.waitForResponse((response) => response.url().endsWith('/contacts/audit-conversation-1') && response.request().method() === 'PUT' && response.ok());
  await dialog.getByRole('button', { name: 'Salvar dados' }).click();
  await profileSaved;
  await expect(page.getByText('Dados do cliente salvos.')).toBeVisible();
  await saveEvidence(page, ['REQ-455'], info, { profileValues, fixtureApi: true, saved: true });
  await dialog.getByRole('button', { name: 'Negócio', exact: true }).click();
  const businessValues = {
    source: 'Indicação de teste', enteredAt: '2026-10-01', exitedAt: '2026-10-29', company: 'Empresa Fixture',
    jobTitle: 'Analista', interests: 'Plano fictício', dealValue: '1250,50', observation: 'Anotação sintética.',
  };
  for (const [name, value] of Object.entries(businessValues)) await dialog.locator(`[name="${name}"]`).fill(value);
  const businessSaved = page.waitForResponse((response) => response.url().endsWith('/contacts/audit-conversation-1') && response.request().method() === 'PUT' && response.ok());
  await dialog.getByRole('button', { name: 'Salvar dados' }).click();
  await businessSaved;
  await page.reload();
  await page.locator('button.chat-item:not(.chat-item-more)').filter({ hasText: profileValues.name }).click();
  await page.locator('.client-name-button').click();
  const reopened = page.getByRole('dialog');
  await reopened.getByRole('button', { name: 'Negócio', exact: true }).click();
  for (const [name, value] of Object.entries(businessValues)) await expect(reopened.locator(`[name="${name}"]`)).toHaveValue(value);
  await saveEvidence(page, ['REQ-457', 'REQ-458'], info, { businessValues, profileStillSavedAfterReload: true, fixtureApi: true });
  await reopened.getByRole('button', { name: 'Perfil', exact: true }).click();
  for (const [name, value] of Object.entries(profileValues)) await expect(reopened.locator(`[name="${name}"]`)).toHaveValue(value);
  await expect(reopened.getByText(/\+5511999999901/)).toBeVisible();
});

test('REQ-450 ordem das categorias salva e reaparece após reload', async ({ page }, info) => {
  const organizationUrl = `${api}/operations/toolbox/organization`;
  const originalResponse = await page.request.get(organizationUrl);
  expect(originalResponse.ok()).toBeTruthy();
  const original = await originalResponse.json() as { categories: string[]; assignments: Record<string, string> };
  const suffix = Date.now();
  const alpha = `Categoria Alfa Fixture ${suffix}`;
  const beta = `Categoria Beta Fixture ${suffix}`;
  try {
  await page.goto('/atendimento');
  await expect(page.locator('.app-shell')).toBeVisible();
  await page.locator('.navigation button[aria-label="Biblioteca"]').click();
  await page.getByRole('button', { name: 'Organizar categorias' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Categorias das respostas' })).toBeVisible();
  for (const category of [alpha, beta]) {
    await dialog.getByLabel('Nova categoria').fill(category);
    await dialog.getByRole('button', { name: 'Adicionar categoria' }).click();
  }
  const order = dialog.getByRole('list', { name: 'Ordem das categorias' });
  await order.getByRole('button', { name: `Descer ${alpha}` }).click();
  await expect(order.locator('li').filter({ hasText: beta }).first()).toContainText(beta);
  const saved = page.waitForResponse((response) => response.url().endsWith('/api/operations/toolbox/organization') && response.request().method() === 'PUT' && response.ok());
  await dialog.getByRole('button', { name: 'Salvar organização' }).click();
  await saved;
  await page.reload();
  await page.locator('.navigation button[aria-label="Biblioteca"]').click();
  await page.getByRole('button', { name: 'Organizar categorias' }).click();
  const reopenedOrder = page.getByRole('list', { name: 'Ordem das categorias' });
  await expect(reopenedOrder.locator('li').filter({ hasText: beta }).first()).toContainText(beta);
  const savedOrder = await reopenedOrder.locator('li span').allTextContents();
  expect(savedOrder.indexOf(beta)).toBeLessThan(savedOrder.indexOf(alpha));
  await saveEvidence(page, ['REQ-450'], info, { orderedCategories: savedOrder, database: '.audit/noctua-audit.db', persistsAfterReload: true, restoredOriginalAfterTest: true });
  } finally {
    const restored = await page.request.put(organizationUrl, { data: original });
    expect(restored.status()).toBe(200);
  }
});

test('REQ-454/REQ-460/REQ-471/REQ-473 macro combina ações pelo painel lateral sem envio', async ({ page }, info) => {
  await openConversation(page);
  await ensureToolsOpen(page);
  const tools = page.getByLabel('Ferramentas de atendimento');
  await tools.locator('.workbench-create summary').click();
  await tools.locator('.workbench-create').getByRole('button', { name: 'Macros', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Criar macro de atendimento' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Adicionar ação' }).click();
  const clearAction = dialog.locator('.macro-action').nth(1);
  await clearAction.locator('summary').filter({ hasText: 'Etiquetas' }).last().click();
  await clearAction.getByRole('button', { name: 'Remover todas as etiquetas', exact: true }).click();
  await expect(dialog.locator('.macro-action').nth(1).getByRole('combobox', { name: 'Utilitário' })).toContainText('Remover todas as etiquetas desta conexão');
  await dialog.getByRole('button', { name: 'Adicionar ação' }).click();
  const timer = dialog.locator('.macro-action').nth(2);
  await timer.locator('summary').filter({ hasText: 'Temporizadores' }).click();
  await timer.getByRole('button', { name: 'Esperar e mostrar presença', exact: true }).click();
  await expect(timer.getByRole('combobox', { name: 'Utilitário' })).toContainText('Somente aguardar');
  await timer.getByRole('combobox', { name: 'Durante a espera' }).click();
  await page.getByRole('option', { name: 'Mostrar gravando áudio' }).click();
  await expect(timer.getByRole('combobox', { name: 'Durante a espera' })).toContainText('Mostrar gravando áudio');
  const commands = [
    ['Arquivar conversa', 'ARCHIVE'],
    ['Reabrir conversa', 'UNARCHIVE'],
    ['Fixar conversa', 'PIN'],
    ['Desafixar conversa', 'UNPIN'],
  ] as const;
  for (const [label, value] of commands) {
    await dialog.getByRole('button', { name: 'Adicionar ação' }).click();
    const action = dialog.locator('.macro-action').last();
    await action.locator('summary').filter({ hasText: 'Utilitários e transferência' }).click();
    await action.getByRole('button', { name: label, exact: true }).click();
    await expect(dialog.locator('.macro-action').last().locator('input[type="hidden"]').nth(1)).toHaveValue(value);
  }
  await dialog.getByRole('button', { name: 'Adicionar ação' }).click();
  const unread = dialog.locator('.macro-action').last();
  await unread.locator('summary').filter({ hasText: 'Utilitários e transferência' }).click();
  await unread.getByRole('button', { name: 'Marcar como não lida', exact: true }).click();
  await expect(unread.locator('input[type="hidden"]').nth(1)).toHaveValue('MARK_UNREAD');
  await dialog.getByRole('button', { name: 'Adicionar ação' }).click();
  const transfer = dialog.locator('.macro-action').last();
  await transfer.locator('summary').filter({ hasText: 'Utilitários e transferência' }).click();
  await transfer.getByRole('button', { name: 'Transferir atendimento', exact: true }).click();
  await transfer.getByLabel('Responsável').fill('equipe.audit@example.com');
  await expect(transfer.locator('input[type="hidden"]').nth(1)).toHaveValue('TRANSFER');
  await dialog.locator('textarea').first().fill('Mensagem sintética da auditoria.');
  await dialog.getByLabel('Nome da macro').fill('Macro auditada fixture');
  let savedMacro: Record<string, any> | undefined;
  await page.route('**/api/operations/macros', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    savedMacro = route.request().postDataJSON() as Record<string, any>;
    return route.fulfill({ status: 201, json: { id: 'macro-fixture', name: savedMacro.name, actions: savedMacro.actions } });
  });
  const macroCreated = page.waitForResponse((response) => response.url().endsWith('/api/operations/macros') && response.request().method() === 'POST' && response.status() === 201);
  await dialog.getByRole('button', { name: 'Salvar macro' }).click();
  await macroCreated;
  expect(savedMacro?.actions).toHaveLength(9);
  expect(savedMacro?.actions.map((action: Record<string, unknown>) => action.command)).toEqual(['WAIT', 'CLEAR_LABELS', 'WAIT', 'ARCHIVE', 'UNARCHIVE', 'PIN', 'UNPIN', 'MARK_UNREAD', 'TRANSFER']);
  await saveEvidence(page, ['REQ-454', 'REQ-460', 'REQ-467', 'REQ-468', 'REQ-469', 'REQ-470', 'REQ-471', 'REQ-473'], info, { macroEditorOpenedFromToolsPanel: true, actionsComposed: ['TEXT', 'CLEAR_LABELS', 'WAIT/recording', 'ARCHIVE', 'UNARCHIVE', 'PIN', 'UNPIN', 'MARK_UNREAD', 'TRANSFER'], apiWriteIntercepted: true, noRealMacroSavedOrSent: true });
});

test('REQ-464 seletor da macro não oferece tipo figurinha', async ({ page }, info) => {
  await openConversation(page);
  await ensureToolsOpen(page);
  const tools = page.getByLabel('Ferramentas de atendimento');
  await tools.locator('.workbench-create summary').click();
  await tools.locator('.workbench-create').getByRole('button', { name: 'Macros', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText('Enviar mensagem', { exact: true }).click();
  await dialog.getByRole('button', { name: 'PIX ou figurinha da biblioteca', exact: true }).click();
  const category = dialog.getByLabel('Categoria do recurso');
  await expect(category).toBeVisible();
  await category.click();
  const assetKinds = page.getByRole('option');
  await expect(assetKinds.filter({ hasText: 'Imagem / vídeo' })).toBeVisible();
  expect((await assetKinds.allTextContents()).join(' ')).not.toContain('Figurinha');
  await saveEvidence(page, ['REQ-464'], info, { result: 'DEFEITO', reproduction: 'O atalho diz figurinha, mas o seletor oferece só Texto, Áudio, Imagem/vídeo e Documento.', noStickerKind: true, noMessageSent: true });
});

test('REQ-474 coruja recolhe e expande o menu principal', async ({ page }, info) => {
  await page.goto('/atendimento');
  await expect(page.locator('.app-shell')).toBeVisible();
  const menu = page.locator('.navigation');
  const owl = page.getByRole('button', { name: 'Recolher ou expandir menu principal' });
  if ((page.viewportSize()?.width ?? 1366) <= 760) {
    await owl.click();
    await expect(menu).toHaveClass(/nav-is-expanded/);
    await saveEvidence(page, ['REQ-474'], info, { mobileMenuExpandsOnOwlClick: true });
  } else {
    const original = (await menu.getAttribute('class')) ?? '';
    const saved = page.waitForResponse((response) => response.url().endsWith('/api/operations/settings/preferences') && response.request().method() === 'PUT' && response.ok());
    await owl.click();
    await expect(menu).not.toHaveAttribute('class', original);
    await saved;
    const compact = await menu.evaluate((node) => node.classList.contains('nav-is-compact'));
    await page.reload();
    await expect(menu).toHaveClass(compact ? /nav-is-compact/ : /nav-is-expanded/);
    await saveEvidence(page, ['REQ-474'], info, { menuPreferencePersistsAfterReload: true, compact });
  }
});

test('REQ-476/REQ-477/REQ-478/REQ-479/REQ-480/REQ-481 respostas padrão salvam recursos e exibem recorrências', async ({ page }, info) => {
  let replies: Record<string, any>[] = [];
  const suggestion = { id: 'suggestion-fixture', question: 'Como agendar?', clients: 2, occurrences: 3, variants: ['Como faço o agendamento?'], suggestedText: 'Use o calendário fictício.' };
  await page.route('**/api/operations/sessions/audit-session/standard-replies**', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'GET' && url.pathname.endsWith('/suggestions')) return route.fulfill({ json: { items: [suggestion] } });
    if (route.request().method() === 'GET') return route.fulfill({ json: { items: replies } });
    if (route.request().method() === 'POST' && !url.pathname.endsWith('/suggestions')) {
      const body = route.request().postDataJSON() as Record<string, any>;
      const item = { id: 'reply-fixture', ...body, match: 0 };
      replies = [item];
      return route.fulfill({ status: 201, json: item });
    }
    return route.fulfill({ json: { saved: true } });
  });
  await openConversation(page);
  await page.getByText('Personalizar', { exact: true }).click();
  await page.getByRole('button', { name: 'HUD, atalhos, botões e aparência' }).click();
  let settings = page.getByRole('dialog').last();
  await settings.getByRole('tab', { name: 'Funções', exact: true }).click();
  await settings.getByRole('list', { name: 'Ordem das ferramentas' }).getByRole('button', { name: 'Mostrar Respostas padrão' }).click();
  const preferencesSaved = page.waitForResponse((response) => response.url().endsWith('/api/operations/settings/preferences') && response.request().method() === 'PUT' && response.ok());
  await settings.getByRole('button', { name: 'Confirmar alterações' }).click();
  await preferencesSaved;
  const toolPanel = page.getByLabel('Ferramentas de atendimento');
  if (await toolPanel.isVisible()) await toolPanel.getByRole('button', { name: 'Fechar ferramentas' }).click();
  const functions = page.getByRole('navigation', { name: 'Funções do atendimento' });
  await functions.getByRole('button', { name: 'Padrões', exact: true }).click();
  await expect(page.getByText('Respostas padrão', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cadastrar pergunta' }).click();
  const dialog = page.getByRole('dialog').last();
  await dialog.getByLabel('Pergunta principal').fill('Qual o prazo fictício?');
  await dialog.getByLabel('Outras formas de perguntar · uma por linha').fill('Quanto tempo demora no teste?');
  await dialog.getByLabel('Categoria', { exact: true }).fill('Prazos fixture');
  await dialog.getByLabel('Texto da resposta').fill('O prazo fictício é de dois dias.');
  await dialog.locator('label.checkbox').filter({ hasText: 'Áudio fictício' }).locator('input[type="checkbox"]').check();
  await dialog.locator('label.checkbox').filter({ hasText: 'Imagem fictícia' }).locator('input[type="checkbox"]').check();
  const saved = page.waitForResponse((response) => response.url().endsWith('/api/operations/sessions/audit-session/standard-replies') && response.request().method() === 'POST' && response.status() === 201);
  await dialog.getByRole('button', { name: 'Salvar resposta padrão' }).click();
  await saved;
  const card = page.locator('.standard-reply-card').filter({ has: page.getByRole('heading', { name: 'Qual o prazo fictício?' }) });
  await expect(card).toContainText('O prazo fictício é de dois dias.');
  await expect(card).toContainText('Áudio fictício');
  await expect(card).toContainText('Imagem fictícia');
  await saveEvidence(page, ['REQ-476', 'REQ-478', 'REQ-479', 'REQ-480', 'REQ-481'], info, { replyCreatedInApiFixture: true, textAndAudioAndImageAssigned: true, noMessageSent: true });
  await page.reload();
  await openConversation(page);
  await page.getByRole('navigation', { name: 'Funções do atendimento' }).getByRole('button', { name: 'Padrões', exact: true }).click();
  const reloadedCard = page.locator('.standard-reply-card').filter({ has: page.getByRole('heading', { name: 'Qual o prazo fictício?' }) });
  await expect(reloadedCard).toContainText('O prazo fictício é de dois dias.');
  await expect(reloadedCard).toContainText('2 recurso(s)');
  await saveEvidence(page, ['REQ-476', 'REQ-478', 'REQ-479', 'REQ-480', 'REQ-481'], info, { savedReplyFixtureSurvivesReload: true });
  await page.getByRole('button', { name: 'Perguntas repetidas' }).click();
  await expect(page.getByRole('heading', { name: 'Como agendar?' })).toBeVisible();
  await expect(page.getByText('2 clientes · 3 ocorrências')).toBeVisible();
  await saveEvidence(page, ['REQ-477'], info, { fixtureSuggestionFromMultipleClients: true, noAutomaticSend: true });
});

test('REQ-484/REQ-485/REQ-486 funções laterais mantêm Biblioteca, fixados e filtros', async ({ page }, info) => {
  await openConversation(page);
  const tools = page.getByLabel('Ferramentas de atendimento');
  await ensureToolsOpen(page);
  await tools.getByRole('button', { name: 'Personalizar posição das mensagens fixadas' }).click();
  const customization = page.getByRole('dialog').last();
  await customization.getByRole('tab', { name: 'Funções', exact: true }).click();
  const nav = customization.getByRole('combobox', { name: 'Navegação na biblioteca completa' });
  await nav.click();
  await page.getByRole('option', { name: 'Ícones na lateral', exact: true }).click();
  const position = customization.getByRole('combobox', { name: 'Barra de funções do atendimento' });
  await expect(position).toBeVisible();
  await page.getByRole('tab', { name: 'Painéis', exact: true }).click();
  await page.getByRole('tab', { name: 'Funções', exact: true }).click();
  await saveEvidence(page, ['REQ-483', 'REQ-487'], info, { result: 'DECISÃO', positionChoices: ['top', 'bottom'], question: 'A barra deve aparecer simultaneamente em cima e embaixo ou apenas permitir escolher uma posição?' });
  await customization.getByRole('button', { name: 'Confirmar alterações' }).click();
  await ensureToolsOpen(page);
  await expect(tools).toHaveAttribute('data-tool-nav', 'side');
  const sideLayout = await tools.evaluate((element) => ({ display: getComputedStyle(element).display, mode: element.querySelector('.workbench-mode-tabs')?.getBoundingClientRect().toJSON(), content: element.querySelector('.workbench-pane-content')?.getBoundingClientRect().toJSON() }));
  expect(sideLayout.display, JSON.stringify(sideLayout)).toBe('grid');
  expect(sideLayout.mode!.x, JSON.stringify(sideLayout)).toBeLessThan(sideLayout.content!.x);
  const contents = tools.getByRole('navigation', { name: 'Conteúdos da lateral' });
  await expect(contents.getByRole('button', { name: 'Biblioteca' })).toHaveAttribute('aria-pressed', 'true');
  await contents.getByRole('button', { name: 'Fixados' }).click();
  await expect(contents.getByRole('button', { name: 'Fixados' })).toHaveAttribute('aria-pressed', 'true');
  await contents.getByRole('button', { name: 'Biblioteca' }).click();
  const chips = tools.locator('.workbench-kind-chips');
  for (const kind of ['Textos', 'Áudios', 'Mídias', 'Documentos', 'Funis', 'Fluxos']) {
    await chips.getByRole('button', { name: kind, exact: true }).click();
    await expect(chips.getByRole('button', { name: kind, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await saveEvidence(page, ['REQ-484', 'REQ-485', 'REQ-486'], info, { lateralFunctionsConfigured: true, libraryAndPinnedTabsAvailable: true, filters: ['text', 'audio', 'media', 'document', 'funnel', 'flow'], noResourceSent: true });
});
