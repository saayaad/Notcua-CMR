import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';



type AuditState = {
  preferences: Record<string, unknown>;
  preferenceWrites: Record<string, unknown>[];
  interceptedMutations: string[];
  blockedExternal: string[];
  consoleErrors: string[];
  pageErrors: string[];
  notes: Record<string, unknown>;
  popup?: Page;
};
const states = new WeakMap<Page, AuditState>();
const evidenceRoot = resolve(process.cwd(), 'REVISAO', 'evidencias');
const labels = { list: 'Conversas', chat: 'Conversa', tools: 'Biblioteca e fixados' } as const;

test.beforeEach(async ({ page }) => {
  const state: AuditState = {
    preferences: { dockingEnabled: true, dockingLayout: '', toolsVisible: true, toolsDocked: true, toolsCompact: false, hudHiddenTools: [], attendanceCustomizationVersion: 3 },
    preferenceWrites: [], interceptedMutations: [], blockedExternal: [], consoleErrors: [], pageErrors: [], notes: {},
  };
  states.set(page, state);
  page.on('console', message => {
    if (message.type() === 'error') state.consoleErrors.push(`${message.text()} @ ${message.location().url}`);
  });
  page.on('pageerror', error => state.pageErrors.push(error.message));
  await page.addInitScript(() => {
    localStorage.removeItem('noctua-preferences:local');
  });
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    if (!local) {
      state.blockedExternal.push(url.origin);
      return route.abort('blockedbyclient');
    }
    if (url.port === '3340' && url.pathname.endsWith('/operations/settings/preferences')) {
      if (method === 'GET') return route.fulfill({ json: state.preferences });
      if (method === 'PUT') {
        const patch = request.postDataJSON() as Record<string, unknown>;
        state.preferenceWrites.push(patch);
        state.preferences = { ...state.preferences, ...patch };
        return route.fulfill({ json: { saved: true } });
      }
    }
    if (url.port === '3340' && method !== 'GET') {
      state.interceptedMutations.push(`${method} ${url.pathname}`);
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"saved":true}' });
    }
    return route.fallback();
  });
});

test.afterEach(async ({ page }, info) => {
  const state = states.get(page);
  const id = info.title.match(/REQ-\d+/)?.[0];
  if (!state || !id) return;
  const suffix = info.project.name.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
  const directory = resolve(evidenceRoot, id);
  await mkdir(directory, { recursive: true });
  const result = info.status === 'passed' && state.pageErrors.length === 0 ? 'APROVADO' : 'FALHOU';
  let screenshotError = '';
  try {
    if (!page.isClosed()) await page.screenshot({ path: resolve(directory, `panels-${suffix}.png`), fullPage: true, animations: 'disabled' });
  } catch (error) { screenshotError = String(error); }
  if (state.popup && !state.popup.isClosed()) {
    try { await state.popup.screenshot({ path: resolve(directory, `panels-${suffix}-janela.png`), fullPage: true, animations: 'disabled' }); }
    catch (error) { screenshotError += `; popup: ${String(error)}`; }
  }
  await writeFile(resolve(directory, `panels-${suffix}.json`), JSON.stringify({
    req: id, result, project: info.project.name, url: page.isClosed() ? '' : page.url(),
    viewport: page.viewportSize(), consoleErrors: state.consoleErrors, pageErrors: state.pageErrors,
    blockedExternal: [...new Set(state.blockedExternal)], interceptedMutations: state.interceptedMutations,
    preferenceWrites: state.preferenceWrites.map(write => Object.keys(write)), notes: state.notes,
    failures: info.errors.map(error => error.message), screenshotError,
  }, null, 2), 'utf8');
  if (info.status === 'passed') expect(state.pageErrors, `${id}: erro de página`).toEqual([]);
});

function stateOf(page: Page) { return states.get(page)!; }
async function start(page: Page, req: string): Promise<boolean> {
  await page.goto('/atendimento', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 });
  const width = page.viewportSize()?.width ?? 1366;
  if (width <= 480) {
    await expect(page.locator('.inbox-layout')).toBeVisible();
    await expect(page.locator('.noctua-dock-workspace')).toHaveCount(0);
    stateOf(page).notes = { viewportMode: 'fallback clássico para tela estreita', req };
    return false;
  }
  await expect(page.locator('.noctua-dock-workspace')).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => page.locator('.noctua-dock .dv-tab').count()).toBeGreaterThan(1);
  return true;
}
async function enterEditing(page: Page) {
  await page.locator('.attendance-settings-menu summary').click();
  await page.getByRole('button', { name: 'Habilitar arraste e organizar painéis' }).click();
  await expect(page.locator('.noctua-dock-editor')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-dock-editing', 'true');
}
async function selectPanel(page: Page, id: keyof typeof labels) {
  await page.getByLabel('Painel para organizar').selectOption(id);
}
async function positionPanel(page: Page, direction: 'left' | 'right' | 'above' | 'below' | 'within') {
  await page.getByLabel('Posicionar painel').selectOption(direction);
}
function tabFor(page: Page, id: keyof typeof labels) {
  const pattern = id === 'list' ? /^Conversas$/ : id === 'chat' ? /^Conversa$/ : /^Biblioteca e fixados$/;
  return page.locator('.noctua-dock .dv-tab').filter({ hasText: pattern });
}
async function groupMap(page: Page): Promise<Record<string, number>> {
  return page.locator('.noctua-dock .dv-tab').evaluateAll(tabs => {
    const groups: Element[] = [];
    const result: Record<string, number> = {};
    for (const tab of tabs) {
      const title = (tab.textContent ?? '').replace(/\s+/g, ' ').trim();
      const key = title === 'Conversas' ? 'list' : title === 'Conversa' ? 'chat' : title === 'Biblioteca e fixados' ? 'tools' : '';
      const group = tab.closest('.dv-groupview');
      if (!key || !group) continue;
      let index = groups.indexOf(group);
      if (index < 0) { groups.push(group); index = groups.length - 1; }
      result[key] = index;
    }
    return result;
  });
}
async function sameGroup(page: Page, first: keyof typeof labels, second: keyof typeof labels) {
  const map = await groupMap(page);
  return map[first] !== undefined && map[first] === map[second];
}
async function openConversation(page: Page) {
  const info = page.locator('.client-name-button');
  if (!(await info.isVisible().catch(() => false))) {
    const first = page.locator('button.chat-item:not(.chat-item-more)').first();
    await expect(first).toBeVisible({ timeout: 10_000 });
    await first.click();
  }
  await expect(info).toBeVisible({ timeout: 10_000 });
}
async function openPopout(page: Page, id: keyof typeof labels = 'tools') {
  await enterEditing(page);
  await selectPanel(page, id);
  const popupEvent = page.waitForEvent('popup', { timeout: 10_000 });
  await page.getByRole('region', { name: labels[id], exact: true }).getByRole('button', { name: 'Abrir painel em outra janela' }).click();
  const popup = await popupEvent;
  stateOf(page).popup = popup;
  await popup.waitForLoadState('domcontentloaded');
  await expect(popup.getByRole('tab', { name: labels[id] })).toBeVisible({ timeout: 15_000 });
  return popup;
}

// Mobile assertions verify the supported classic fallback; desktop projects exercise each panel behavior.
test('REQ-574 painéis podem ser agrupados em abas', async ({ page }) => {
  if (!(await start(page, 'REQ-574'))) return;
  await enterEditing(page);
  await selectPanel(page, 'chat');
  await positionPanel(page, 'within');
  await expect.poll(() => sameGroup(page, 'chat', 'list')).toBe(true);
  stateOf(page).notes = { groupedTabs: await groupMap(page) };
});

test('REQ-575 arrastar uma aba encaixa o painel no grupo alvo', async ({ page }) => {
  if (!(await start(page, 'REQ-575'))) return;
  await enterEditing(page);
  const source = tabFor(page, 'list');
  const target = tabFor(page, 'chat');
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  await source.dragTo(target, { targetPosition: { x: box!.width / 2, y: box!.height / 2 } });
  await expect.poll(() => sameGroup(page, 'list', 'chat'), { timeout: 7_000 }).toBe(true);
  stateOf(page).notes = { drag: 'Conversas encaixada como aba de Conversa', groups: await groupMap(page) };
});

test('REQ-576 divisórias redimensionam a área dos painéis', async ({ page }) => {
  if (!(await start(page, 'REQ-576'))) return;
  await enterEditing(page);
  const sash = page.locator('.noctua-dock .dv-sash').first();
  await expect(sash).toBeVisible();
  const sashBox = await sash.boundingBox();
  const before = await page.locator('.noctua-dock .dv-groupview').first().boundingBox();
  expect(sashBox).not.toBeNull(); expect(before).not.toBeNull();
  const x = sashBox!.x + sashBox!.width / 2; const y = sashBox!.y + sashBox!.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  if (sashBox!.width < sashBox!.height) await page.mouse.move(x + 70, y, { steps: 8 });
  else await page.mouse.move(x, y + 70, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => {
    const after = await page.locator('.noctua-dock .dv-groupview').first().boundingBox();
    return !after || !before ? 0 : Math.abs(after.width - before.width) + Math.abs(after.height - before.height);
  }, { timeout: 5_000 }).toBeGreaterThan(20);
  stateOf(page).notes = { dividerBefore: before, dividerAfter: await page.locator('.noctua-dock .dv-groupview').first().boundingBox() };
});

test('REQ-577 painel pode flutuar dentro do espaço de atendimento', async ({ page }) => {
  if (!(await start(page, 'REQ-577'))) return;
  await enterEditing(page); await selectPanel(page, 'tools');
  await page.getByRole('region', { name: 'Biblioteca e fixados', exact: true }).getByRole('button', { name: 'Tornar painel flutuante' }).click();
  const floating = page.getByRole('dialog', { name: 'Biblioteca e fixados' });
  await expect(floating).toBeVisible();
  await expect(floating.getByRole('tab', { name: 'Biblioteca e fixados' })).toBeVisible();
  stateOf(page).notes = { floatingDialogVisible: true, toolsTabVisible: true };
});

test('REQ-578 layout salvo persiste ao reabrir o Atendimento', async ({ page }) => {
  if (!(await start(page, 'REQ-578'))) return;
  await enterEditing(page); await selectPanel(page, 'chat'); await positionPanel(page, 'within');
  await expect.poll(() => sameGroup(page, 'chat', 'list')).toBe(true);
  await page.getByRole('button', { name: 'Confirmar layout' }).click();
  await expect.poll(() => String(stateOf(page).preferences.dockingLayout ?? '')).not.toBe('');
  const saved = String(stateOf(page).preferences.dockingLayout);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.noctua-dock-workspace')).toBeVisible();
  await expect.poll(() => sameGroup(page, 'chat', 'list')).toBe(true);
  stateOf(page).notes = { persistedLayout: true, savedCharacters: saved.length, reloadedGroup: await groupMap(page) };
});

test('REQ-579 painel abre em janela separada', async ({ page }) => {
  if (!(await start(page, 'REQ-579'))) return;
  const popup = await openPopout(page, 'tools');
  await expect(popup).toHaveURL(/popout\.html/);
  stateOf(page).notes = { popupUrl: popup.url(), popupTitle: await popup.title() };
});

test('REQ-580 fechar janela separada devolve o painel ao Atendimento', async ({ page }) => {
  if (!(await start(page, 'REQ-580'))) return;
  const popup = await openPopout(page, 'tools');
  await expect(popup.locator('.noctua-dock-content .tools-panel')).toBeVisible();
  await popup.close();
  await expect(tabFor(page, 'tools')).toBeVisible({ timeout: 10_000 });
  stateOf(page).notes = { returnedToMain: true, toolsPanelVisible: await tabFor(page, 'tools').isVisible() };
});

test('REQ-581 janela externa renderiza o conteúdo do painel', async ({ page }) => {
  if (!(await start(page, 'REQ-581'))) return;
  const popup = await openPopout(page, 'tools');
  await expect(popup.locator('.noctua-dock-content .tools-panel')).toBeVisible();
  await expect(popup.locator('.noctua-dock-content .workbench-library-body')).toBeVisible();
  stateOf(page).notes = { externalWindowRendered: true, url: popup.url(), content: 'Biblioteca e fixados' };
});

test('REQ-582 encaixe por arraste funciona no Chromium', async ({ page }) => {
  if (!(await start(page, 'REQ-582'))) return;
  await enterEditing(page);
  const source = tabFor(page, 'tools'); const target = tabFor(page, 'chat');
  const box = await target.boundingBox(); expect(box).not.toBeNull();
  await source.dragTo(target, { targetPosition: { x: box!.width / 2, y: box!.height / 2 } });
  await expect.poll(() => sameGroup(page, 'tools', 'chat'), { timeout: 7_000 }).toBe(true);
  stateOf(page).notes = { browser: 'Chromium Playwright', dragDocked: await groupMap(page) };
});

test('REQ-583 controles de layout ficam reunidos no menu de organização', async ({ page }) => {
  if (!(await start(page, 'REQ-583'))) return;
  await expect(page.locator('.noctua-dock-editor')).toHaveCount(0);
  await page.locator('.attendance-settings-menu summary').click();
  await expect(page.getByRole('button', { name: 'Habilitar arraste e organizar painéis' })).toBeVisible();
  await expect(page.getByLabel('Posicionar painel')).toHaveCount(0);
  await page.getByRole('button', { name: 'Habilitar arraste e organizar painéis' }).click();
  await expect(page.getByLabel('Posicionar painel')).toBeVisible();
  stateOf(page).notes = { oneEntryPoint: true, editControlsVisibleAfterClick: true };
});

test('REQ-584 painel permanece visível depois de reposicionar', async ({ page }) => {
  if (!(await start(page, 'REQ-584'))) return;
  await enterEditing(page); await selectPanel(page, 'chat'); await positionPanel(page, 'above');
  await expect(tabFor(page, 'chat')).toBeVisible();
  await expect(tabFor(page, 'list')).toBeVisible();
  await expect.poll(() => page.locator('.noctua-dock .dv-tab').count()).toBeGreaterThanOrEqual(3);
  stateOf(page).notes = { allPanelTabsPreserved: await groupMap(page) };
});

test('REQ-585 conteúdo mantém dimensões e formatação depois de encaixar', async ({ page }) => {
  if (!(await start(page, 'REQ-585'))) return;
  await openConversation(page); await enterEditing(page); await selectPanel(page, 'chat'); await positionPanel(page, 'within');
  const chat = page.locator('.noctua-dock-content .chat-pane').first();
  await expect(chat).toBeVisible();
  const metrics = await chat.evaluate(element => {
    const box = element.getBoundingClientRect();
    return { width: box.width, height: box.height, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, writingMode: getComputedStyle(element).writingMode };
  });
  expect(metrics.width).toBeGreaterThan(280); expect(metrics.height).toBeGreaterThan(180);
  expect(metrics.writingMode).toBe('horizontal-tb');
  await expect(page.locator('.noctua-dock-content .client-name-button')).toBeVisible();
  stateOf(page).notes = { chatMetrics: metrics, contentVisible: true };
});

test('REQ-586 há botão claro para habilitar alterações de layout', async ({ page }) => {
  if (!(await start(page, 'REQ-586'))) return;
  await expect(page.locator('html')).toHaveAttribute('data-dock-editing', 'false');
  await page.locator('.attendance-settings-menu summary').click();
  const toggle = page.getByRole('button', { name: 'Habilitar arraste e organizar painéis' });
  await expect(toggle).toBeVisible(); await toggle.click();
  await expect(page.locator('.noctua-dock-editor')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-dock-editing', 'true');
  stateOf(page).notes = { explicitEditButton: true, editModeEnabled: true };
});

test('REQ-587 configurações completas da conversa continuam acessíveis', async ({ page }) => {
  if (!(await start(page, 'REQ-587'))) return;
  await openConversation(page);
  await page.locator('.client-name-button').click();
  await expect(page.getByRole('dialog', { name: 'Informações do cliente' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar etiquetas do cliente' })).toBeVisible();
  stateOf(page).notes = { conversationSettingsDialog: true, tagEditorAvailable: true };
});

test('REQ-588 modo normal impede arraste acidental', async ({ page }) => {
  if (!(await start(page, 'REQ-588'))) return;
  const before = await groupMap(page);
  await expect(page.locator('html')).toHaveAttribute('data-dock-editing', 'false');
  const sash = page.locator('.noctua-dock .dv-sash').first();
  if (await sash.count()) await expect.poll(() => sash.evaluate(element => getComputedStyle(element).pointerEvents)).toBe('none');
  const source = tabFor(page, 'list'); const target = tabFor(page, 'chat');
  const box = await target.boundingBox(); expect(box).not.toBeNull();
  await source.dragTo(target, { targetPosition: { x: box!.width / 2, y: box!.height / 2 } });
  await expect.poll(() => groupMap(page)).toEqual(before);
  stateOf(page).notes = { editingDisabled: true, groupsStable: before };
});

test('REQ-589 recolher painel mantém atalho para reabri-lo', async ({ page }) => {
  if (!(await start(page, 'REQ-589'))) return;
  await tabFor(page, 'tools').click();
  await page.getByRole('button', { name: 'Recolher Biblioteca e fixados' }).click();
  await expect(tabFor(page, 'tools')).toHaveCount(0);
  await expect(page.locator('.dock-reopen-tray').getByRole('button', { name: 'Abrir Biblioteca e fixados' })).toBeVisible();
  stateOf(page).notes = { panelRetainedInReopenTray: true };
});

test('REQ-590 painel recolhido reabre sem entrar nas configurações', async ({ page }) => {
  if (!(await start(page, 'REQ-590'))) return;
  await tabFor(page, 'tools').click();
  await page.getByRole('button', { name: 'Recolher Biblioteca e fixados' }).click();
  const reopen = page.getByRole('button', { name: 'Abrir Biblioteca e fixados' });
  await expect(reopen).toBeVisible(); await reopen.click();
  await expect(tabFor(page, 'tools')).toBeVisible();
  await expect(page.locator('.noctua-dock-editor')).toHaveCount(0);
  stateOf(page).notes = { reopenedWithoutSettings: true };
});

test('REQ-591 minimizar e restaurar pop-up preserva o formulário', async ({ page }) => {
  if (!(await start(page, 'REQ-591'))) return;
  await openConversation(page);
  await page.locator('.client-name-button').click();
  const dialog = page.getByRole('dialog', { name: 'Informações do cliente' });
  const form = page.getByLabel('Resumo do atendimento');
  await expect(dialog).toBeVisible();
  await form.fill('rascunho fictício REQ-591 — não salvar');
  await dialog.getByRole('button', { name: 'Minimizar janela' }).click();
  await expect(dialog).toBeHidden();
  const restore = page.getByRole('button', { name: 'Restaurar Informações do cliente' });
  await expect(restore).toBeVisible();
  await restore.click();
  await expect(dialog).toBeVisible();
  await expect(form).toHaveValue('rascunho fictício REQ-591 — não salvar');
  stateOf(page).notes = { minimizedAndRestored: true, formPreserved: true, saved: false };
});

test('REQ-592 funções do atendimento mantêm texto e orientação legíveis', async ({ page }) => {
  if (!(await start(page, 'REQ-592'))) return;
  await openConversation(page);
  const functions = page.locator('.noctua-dock-content .attendance-functions').first();
  await expect(functions).toBeVisible();
  const metrics = await functions.evaluate(element => {
    const buttons = [...element.querySelectorAll('button')];
    return { width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height,
      writingMode: getComputedStyle(element).writingMode,
      labels: buttons.map(button => (button.getAttribute('aria-label') || button.title || button.innerText).trim()) };
  });
  expect(metrics.width).toBeGreaterThan(180); expect(metrics.writingMode).toBe('horizontal-tb');
  expect(metrics.labels.length).toBeGreaterThan(0); expect(metrics.labels.every(Boolean)).toBe(true);
  stateOf(page).notes = { functionMetrics: metrics };
});

test('REQ-593 rascunho do compositor permanece ao mover Conversa', async ({ page }) => {
  if (!(await start(page, 'REQ-593'))) return;
  await openConversation(page);
  const composer = page.getByRole('textbox', { name: 'Mensagem', exact: true });
  await composer.fill('rascunho fictício REQ-593 — não enviar');
  await enterEditing(page); await selectPanel(page, 'chat'); await positionPanel(page, 'within');
  await expect(composer).toHaveValue('rascunho fictício REQ-593 — não enviar');
  await expect.poll(() => sameGroup(page, 'chat', 'list')).toBe(true);
  stateOf(page).notes = { draftPreserved: true, layoutMoved: true, sent: false };
});

test('REQ-594 cancelar alterações restaura o layout salvo', async ({ page }) => {
  if (!(await start(page, 'REQ-594'))) return;
  const before = await groupMap(page);
  await enterEditing(page); await selectPanel(page, 'chat'); await positionPanel(page, 'within');
  await expect.poll(() => sameGroup(page, 'chat', 'list')).toBe(true);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.locator('.noctua-dock-editor')).toHaveCount(0);
  await expect.poll(() => sameGroup(page, 'chat', 'list')).toBe(false);
  stateOf(page).notes = { groupsBefore: before, groupsAfterCancel: await groupMap(page) };
});

test('REQ-595 voltar ao layout clássico desativa os painéis encaixáveis', async ({ page }) => {
  if (!(await start(page, 'REQ-595'))) return;
  await page.locator('.attendance-settings-menu summary').click();
  await page.getByRole('button', { name: 'Voltar ao layout clássico' }).click();
  await expect(page.locator('.noctua-dock-workspace')).toHaveCount(0);
  await expect(page.locator('.inbox-layout')).toBeVisible();
  await expect.poll(() => stateOf(page).preferences.dockingEnabled).toBe(false);
  stateOf(page).notes = { classicLayoutVisible: true, dockingDisabled: true };
});
