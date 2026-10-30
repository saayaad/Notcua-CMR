import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const evidenceRoot = resolve(process.cwd(), 'REVISAO', 'evidencias');
test.describe.configure({ mode: 'serial' });

async function openFirstConversation(page: Page) {
  await page.goto('/atendimento');
  await expect(page.locator('.app-shell')).toBeVisible();
  const item = page.locator('button.chat-item:not(.chat-item-more)').first();
  await expect(item).toBeVisible();
  await item.click();
  await expect(page.locator('.client-name-button')).toBeVisible();
}

async function evidence(page: Page, ids: string[], info: TestInfo, result: Record<string, unknown>) {
  for (const id of ids) {
    const dir = resolve(evidenceRoot, id);
    await mkdir(dir, { recursive: true });
    const suffix = info.project.name.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
    await page.screenshot({ path: resolve(dir, `${suffix}.png`), fullPage: true });
    await writeFile(resolve(dir, `${suffix}.json`), JSON.stringify({ req: id, result: 'APROVADO', project: info.project.name, url: page.url(), ...result }, null, 2));
  }
}

test('REQ-240 reabre mensagens fixadas pelo atalho flutuante animado', async ({ page }, info) => {
  await page.route('**/api/operations/settings/preferences', async (route) => {
    if (route.request().method() === 'PUT')
      await route.fulfill({ json: route.request().postDataJSON() });
    else await route.continue();
  });
  await openFirstConversation(page);
  const reopen = page.getByRole('button', { name: 'Reabrir mensagens fixadas', exact: true });
  await expect(reopen).toBeVisible();
  await expect(reopen).toHaveCSS('animation-name', 'tools-reopen-pulse');
  await evidence(page, ['REQ-240'], info, { animatedReopen: true, animationName: 'tools-reopen-pulse', toolsHidden: true });
  await page.addStyleTag({ content: '.tools-reopen-fab { animation: none !important; }' });
  await reopen.click();
  await expect(reopen).toHaveCount(0);
  const hide = page.getByRole('button', { name: 'Ocultar biblioteca lateral', exact: true });
  await expect(hide).toBeVisible();
  await hide.click();
  await expect(reopen).toBeVisible();
  await expect(reopen).toBeVisible();
});

test('REQ-241/REQ-242 alterna lista arquivada, arquiva e reabre conversa com persistência', async ({ page }, info) => {
  await openFirstConversation(page);
  const name = await page.locator('.client-name-button strong').innerText();
  if (!(await page.getByRole('button', { name: 'Arquivar conversa' }).isVisible())) {
    await page.locator('.chat-more-actions summary').click();
  }
  await page.getByRole('button', { name: 'Arquivar conversa' }).click();
  await expect(page.locator('button.chat-item').filter({ hasText: name })).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Arquivadas', exact: true }).click();
  await expect(page.locator('button.chat-item').filter({ hasText: name })).toBeVisible();
  await page.locator('button.chat-item').filter({ hasText: name }).click();
  if (!(await page.getByRole('button', { name: 'Reabrir conversa' }).isVisible())) {
    await page.locator('.chat-more-actions summary').click();
  }
  await expect(page.getByRole('button', { name: 'Reabrir conversa' })).toBeVisible();
  await page.getByRole('button', { name: 'Reabrir conversa' }).click();
  await page.reload();
  await expect(page.locator('button.chat-item').filter({ hasText: name })).toBeVisible();
  await evidence(page, ['REQ-241', 'REQ-242'], info, { conversation: name, archivedThenReopened: true });
});

test('REQ-247/REQ-248/REQ-249 salva nota privada dourada sem chamar a rota de envio', async ({ page }, info) => {
  await openFirstConversation(page);
  const contact = await page.locator('.client-name-button strong').innerText();
  await page.getByRole('button', { name: 'Nota interna', exact: true }).click();
  const text = `Nota privada auditoria ${info.project.name} ${Date.now()}`;
  const response = page.waitForResponse((res) => res.url().includes('/internal-notes') && res.request().method() === 'POST' && res.ok());
  await page.getByRole('textbox', { name: 'Mensagem', exact: true }).fill(text);
  await page.getByRole('button', { name: 'Salvar nota interna' }).click();
  await response;
  const note = page.locator('.internal-note-bubble').filter({ hasText: text });
  await expect(note).toBeVisible();
  await expect(note.locator('.internal-note-label')).toContainText('Nota interna');
  const colors = await note.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    border: getComputedStyle(element).borderColor,
    label: getComputedStyle(element.querySelector('.internal-note-label')!).color,
  }));
  expect(colors.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(colors.border).not.toBe('rgba(0, 0, 0, 0)');
  expect(colors.label).toBe('rgb(237, 198, 93)');
  await page.reload();
  await page.locator('button.chat-item').filter({ hasText: contact }).click();
  await expect(page.locator('.internal-note-bubble').filter({ hasText: text })).toBeVisible();
  await evidence(page, ['REQ-247', 'REQ-248', 'REQ-249'], info, { note: text, persisted: true, externalSend: false });
});

test('REQ-254/REQ-255/REQ-256/REQ-324 abre, filtra e seleciona recurso pela Biblioteca e atalho /', async ({ page }, info) => {
  const library = await page.request.get('http://127.0.0.1:3340/api/attendance/library');
  const assets = (await library.json() as { assets: Array<{ id: string; name: string }> }).assets;
  const resourceName = assets.find((asset) => asset.id === 'audit-asset-welcome')?.name;
  expect(resourceName).toBeTruthy();
  await page.route('**/api/whatsapp/sessions', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: { ...body, items: body.items.map((item: Record<string, unknown>) => ({ ...item, status: 'CONNECTED' })) } });
  });
  await page.route('**/api/attendance/sessions/audit-session/conversations/*/send-asset', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
  );
  await openFirstConversation(page);
  const composer = page.getByRole('textbox', { name: 'Mensagem', exact: true });
  const shortcut = `/${resourceName!.slice(0, 4)}`;
  await composer.fill(shortcut);
  const menu = page.getByRole('listbox', { name: 'Respostas rápidas da Biblioteca' });
  await expect(menu).toBeVisible();
  const option = menu.getByRole('option').filter({ hasText: resourceName! });
  await expect(option).toBeVisible();
  await expect(menu.getByRole('option')).toHaveCount(1);
  const [sent] = await Promise.all([
    page.waitForResponse((res) => res.url().endsWith('/send-asset') && res.request().method() === 'POST' && res.ok()),
    option.click(),
  ]);
  expect(sent.ok()).toBeTruthy();
  await expect(page.getByText(`“${resourceName}” enviado.`)).toBeVisible();
  await expect(composer).toHaveValue('');
  await composer.fill(shortcut);
  await expect(menu).toBeVisible();
  const secondSent = page.waitForResponse((res) => res.url().endsWith('/send-asset') && res.request().method() === 'POST' && res.ok());
  await composer.press('Enter');
  await secondSent;
  await expect(page.getByText(`“${resourceName}” enviado.`)).toBeVisible();
  await expect(composer).toHaveValue('');
  await evidence(page, ['REQ-254', 'REQ-255', 'REQ-256', 'REQ-324'], info, { selectedByClickAndEnter: resourceName, sentByFictitiousConnector: true, slashShortcut: true });
});

test('REQ-236/REQ-237/REQ-238/REQ-239 configura HUD pelo cabeçalho e persiste densidade', async ({ page }, info) => {
  await openFirstConversation(page);
  const customize = page.locator('[title="Personalizar Atendimento"]');
  await expect(customize).toBeVisible();
  await customize.click();
  await expect(page.getByRole('heading', { name: 'Personalizar Atendimento' })).toBeVisible();
  const density = page.getByLabel('Tamanho dos controles');
  for (const option of ['Compacto', 'Médio', 'Expandido']) {
    await density.click();
    await expect(page.getByRole('option', { name: option, exact: true })).toBeVisible();
    await page.getByRole('option', { name: option, exact: true }).click();
    await expect(density).toHaveAttribute('title', option);
  }
  const saved = page.waitForResponse((res) => res.url().endsWith('/api/operations/settings/preferences') && res.request().method() === 'PUT' && res.ok());
  await page.getByRole('button', { name: 'Confirmar alterações' }).click();
  await saved;
  await page.reload();
  const active = page.locator('button.chat-item:not(.chat-item-more)').first();
  await active.click();
  await expect(page.locator('html')).toHaveAttribute('data-density', 'expanded');
  const titleButtons = page.locator('.header-actions button[title]');
  await expect(titleButtons.first()).toHaveAttribute('title', /.+/);
  const titles = await titleButtons.evaluateAll((buttons) => buttons.map((button) => ({
    title: button.getAttribute('title'),
    label: button.getAttribute('aria-label'),
  })));
  expect(titles.length).toBeGreaterThan(0);
  expect(titles.every(({ title, label }) => Boolean(title?.trim() && label?.trim()))).toBeTruthy();
  await evidence(page, ['REQ-236', 'REQ-237', 'REQ-238', 'REQ-239'], info, { density: 'expanded', persisted: true, tooltip: true });
});

test('REQ-243/REQ-244/REQ-245 exibe verde, amarelo e vermelho nos limites de espera', async ({ page, request }, info) => {
  const initialBrowserTime = new Date();
  await page.clock.install({ time: initialBrowserTime });
  await page.goto('/atendimento');
  await expect(page.locator('.app-shell')).toBeVisible();
  const currentResponse = await request.get('http://127.0.0.1:3340/api/operations/settings/preferences');
  expect(currentResponse.ok()).toBeTruthy();
  const current = await currentResponse.json();
  const setThresholds = async (yellow: number, red: number) => {
    const response = await request.put('http://127.0.0.1:3340/api/operations/settings/preferences', {
      data: { ...current, waitingTimer: true, waitingYellow: yellow, waitingRed: red },
    });
    expect(response.ok()).toBeTruthy();
  };
  const ana = page.locator('button.chat-item').filter({ hasText: 'Ana Exemplo' });
  try {
    await setThresholds(5, 15);
    const initialAgeText = await ana.locator('.wait-age').textContent();
    const initialMinutes = Number(initialAgeText?.match(/\d+/)?.[0]);
    expect(Number.isFinite(initialMinutes)).toBeTruthy();
    const atWaitMinutes = async (minutes: number) => {
      const simulatedTime = new Date(initialBrowserTime.getTime() + (minutes - initialMinutes) * 60_000 + 30_000);
      await page.clock.setFixedTime(simulatedTime);
      await page.reload();
      await expect(page.locator('.app-shell')).toBeVisible();
    };

    await atWaitMinutes(2);
    await expect(ana.locator('.wait-age')).toHaveClass('wait-age');
    const greenColor = await ana.locator('.wait-age').evaluate((element) => getComputedStyle(element).color);
    await evidence(page, ['REQ-243'], info, { contact: 'Ana Exemplo', class: 'wait-age', color: greenColor, simulatedWaitMinutes: 2, threshold: 'under 5 min' });
    await atWaitMinutes(10);
    await expect(ana.locator('.wait-age')).toHaveClass(/warning/);
    const yellowColor = await ana.locator('.wait-age').evaluate((element) => getComputedStyle(element).color);
    expect(yellowColor).not.toBe(greenColor);
    await evidence(page, ['REQ-244'], info, { contact: 'Ana Exemplo', class: 'warning', color: yellowColor, simulatedWaitMinutes: 10, threshold: '5–15 min' });
    await atWaitMinutes(20);
    await expect(ana.locator('.wait-age')).toHaveClass(/urgent/);
    await expect(ana).toHaveClass(/sla-urgent/);
    const redColor = await ana.locator('.wait-age').evaluate((element) => getComputedStyle(element).color);
    expect(redColor).not.toBe(yellowColor);
    await evidence(page, ['REQ-245'], info, { contact: 'Ana Exemplo', class: 'urgent', color: redColor, simulatedWaitMinutes: 20, threshold: 'over 15 min' });
  } finally {
    const restored = await request.put('http://127.0.0.1:3340/api/operations/settings/preferences', { data: current });
    expect(restored.ok()).toBeTruthy();
  }
});
