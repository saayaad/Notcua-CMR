import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const evidenceRoot = resolve(process.cwd(), 'REVISAO', 'evidencias');
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

test.describe.configure({ mode: 'serial' });

async function openApp(page: Page) {
  await page.goto('/atendimento');
  await expect(page.locator('.app-shell')).toBeVisible();
}

async function openPersonalization(page: Page) {
  await openApp(page);
  await page.getByRole('button', { name: 'Personalização', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Identidade e cores' })).toBeVisible();
}

async function waitPreference(page: Page, action: () => Promise<void>) {
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/operations/settings/preferences') &&
      response.request().method() === 'PUT' &&
      response.ok(),
  );
  await action();
  await saved;
}

async function selectOption(page: Page, control: Locator, name: string) {
  await control.click();
  await page.getByRole('option', { name, exact: true }).click();
}

async function saveEvidence(
  page: Page,
  ids: string | string[],
  info: TestInfo,
  result: Record<string, unknown> = {},
) {
  for (const id of Array.isArray(ids) ? ids : [ids]) {
    const directory = resolve(evidenceRoot, id);
    await mkdir(directory, { recursive: true });
    const suffix = info.project.name.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
    await page.screenshot({ path: resolve(directory, `${suffix}.png`), fullPage: true });
    await writeFile(
      resolve(directory, `${suffix}.json`),
      JSON.stringify({ req: id, result: 'APROVADO', project: info.project.name, url: page.url(), ...result }, null, 2),
      'utf8',
    );
  }
}

async function removeBrandImage(page: Page, name: 'Remover logotipo' | 'Remover ícone') {
  const button = page.getByRole('button', { name, exact: true });
  if (await button.isVisible()) await waitPreference(page, () => button.click());
}

async function openSearch(page: Page, viaShortcut = false) {
  if (viaShortcut) await page.keyboard.press('Control+k');
  else await page.getByRole('button', { name: 'Busca rápida', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Busca rápida' })).toBeVisible();
  return page.getByPlaceholder('Buscar conversas, telas e recursos…');
}

test('REQ-199/REQ-200/REQ-201/REQ-202/REQ-203/REQ-204 valida base CSS, viewports e escala efetiva', async ({ page }, info) => {
  await openApp(page);
  const original = page.viewportSize()!;
  const base = await page.evaluate(() => {
    const probe = document.createElement('div');
    document.body.append(probe);
    const style = getComputedStyle(probe);
    const before = getComputedStyle(probe, '::before');
    const html = getComputedStyle(document.documentElement);
    const shell = document.querySelector('.app-shell')!.getBoundingClientRect();
    const css = Array.from(document.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules ?? []))
      .map((rule) => rule.cssText)
      .join('\n');
    const result = {
      boxSizing: style.boxSizing,
      margin: style.margin,
      padding: style.padding,
      pseudoBoxSizing: before.boxSizing,
      fontSize: html.fontSize,
      textAdjust: html.getPropertyValue('-webkit-text-size-adjust') || html.getPropertyValue('text-size-adjust'),
      smoothing: html.getPropertyValue('-webkit-font-smoothing'),
      shellWidth: shell.width,
      shellHeight: shell.height,
      viewport: { width: innerWidth, height: innerHeight },
      units: {
        rem: /\d(?:\.\d+)?rem/.test(css),
        percent: /\d%/.test(css),
        fr: /\dfr/.test(css),
        minmax: /minmax\(/.test(css),
        clamp: /clamp\(/.test(css),
      },
    };
    probe.remove();
    return result;
  });
  expect(base.boxSizing).toBe('border-box');
  expect(base.pseudoBoxSizing).toBe('border-box');
  expect(base.margin).toBe('0px');
  expect(base.padding).toBe('0px');
  expect(base.fontSize).toBe('16px');
  expect(base.textAdjust).toBe('100%');
  expect(base.smoothing).toBe('antialiased');
  expect(Math.abs(base.shellWidth - base.viewport.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(base.shellHeight - base.viewport.height)).toBeLessThanOrEqual(1);
  expect(Object.values(base.units).every(Boolean)).toBeTruthy();

  const scaleChecks: { scale: number; width: number; overflow: number }[] = [];
  if (info.project.name === 'desktop-1366') {
    for (const scale of [0.8, 1, 1.25, 1.5]) {
      await page.setViewportSize({ width: Math.round(1366 / scale), height: Math.round(768 / scale) });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      scaleChecks.push({ scale, width: page.viewportSize()!.width, overflow });
    }
  }
  if (info.project.name === 'desktop-1920') {
    await page.setViewportSize({ width: 2560, height: 1080 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const directory = resolve(evidenceRoot, 'REQ-202');
    await mkdir(directory, { recursive: true });
    await page.screenshot({ path: resolve(directory, 'ultrawide-2560.png'), fullPage: true });
    await writeFile(resolve(directory, 'ultrawide-2560.json'), JSON.stringify({ result: 'APROVADO', viewport: { width: 2560, height: 1080 }, overflow }, null, 2));
  }
  await page.setViewportSize(original);
  const userAgent = await page.evaluate(() => navigator.userAgent);
  await saveEvidence(page, ['REQ-199', 'REQ-200', 'REQ-201', 'REQ-202', 'REQ-203', 'REQ-204'], info, {
    base,
    scaleChecks,
    engine: userAgent,
  });
});

test('REQ-206/REQ-214/REQ-217 persiste nomes, logotipo e favicon em outro contexto local', async ({ page, browser }, info) => {
  await openPersonalization(page);
  const suffix = info.project.name;
  const menuName = `Atender ${suffix}`;
  const folderName = `Respostas ${suffix}`;
  await waitPreference(page, () => page.getByLabel('Menu · Atendimento').fill(menuName));
  await waitPreference(page, () => page.getByLabel('Pasta · Textos').fill(folderName));
  await removeBrandImage(page, 'Remover logotipo');
  await removeBrandImage(page, 'Remover ícone');
  await waitPreference(page, () =>
    page.getByLabel('Logotipo').setInputFiles({ name: `logo-${suffix}.png`, mimeType: 'image/png', buffer: png }),
  );
  await waitPreference(page, () =>
    page.getByLabel('Ícone do navegador (favicon)').setInputFiles({ name: `favicon-${suffix}.png`, mimeType: 'image/png', buffer: png }),
  );
  await page.reload();
  await expect(page.getByRole('button', { name: menuName, exact: true })).toBeVisible();
  await expect(page.locator('img.branding-mark').first()).toHaveAttribute('src', /^data:image\/(?:png|webp);base64,/);
  await expect(page.locator('link[rel~="icon"]')).toHaveAttribute('href', /^data:image\/(?:png|webp);base64,/);

  const second = await browser.newContext();
  const other = await second.newPage();
  await other.goto('http://127.0.0.1:5180/atendimento');
  await expect(other.getByRole('button', { name: menuName, exact: true })).toBeVisible();
  await expect(other.locator('img.branding-mark').first()).toHaveAttribute('src', /^data:image\/(?:png|webp);base64,/);
  await expect(other.locator('link[rel~="icon"]')).toHaveAttribute('href', /^data:image\/(?:png|webp);base64,/);
  await second.close();
  await saveEvidence(page, ['REQ-206', 'REQ-214', 'REQ-217'], info, { menuName, folderName, secondContext: true, logo: true, favicon: true });
});

test('REQ-208/REQ-209 aplica cor e ícone personalizados da etiqueta no CRM', async ({ page }, info) => {
  await openPersonalization(page);
  const colors: Record<string, string> = { 'desktop-1366': '#123456', 'desktop-1920': '#654321', 'mobile-390': '#246810' };
  const icons: Record<string, string> = { 'desktop-1366': '◆', 'desktop-1920': '●', 'mobile-390': '★' };
  const color = colors[info.project.name]!;
  const icon = icons[info.project.name]!;
  await waitPreference(page, () => page.getByLabel('Cor visual de Novo lead').fill(color));
  await waitPreference(page, () => page.getByLabel('Ícone de Novo lead').fill(icon));
  await page.reload();
  await page.getByRole('button', { name: 'CRM e negócios', exact: true }).click();
  const column = page.getByLabel('Etapa Novo lead');
  await expect(column).toBeVisible();
  await expect(column.locator('.kanban-column-icon')).toHaveText(icon);
  const rgb = await page.evaluate((value) => {
    const probe = document.createElement('div');
    probe.style.color = value;
    document.body.append(probe);
    const result = getComputedStyle(probe).color;
    probe.remove();
    return result;
  }, color);
  await expect(column.locator('header i').first()).toHaveCSS('background-color', rgb);
  await saveEvidence(page, ['REQ-208', 'REQ-209'], info, { label: 'Novo lead', color, icon });
});

test('REQ-215/REQ-216/REQ-222 pré-visualiza densidades, posiciona painéis e mostra toast com progresso', async ({ page }, info) => {
  await openPersonalization(page);
  await page.getByRole('main').getByRole('button', { name: 'Personalizar Atendimento com prévia' }).click();
  const density = page.getByRole('combobox', { name: 'Tamanho dos controles' });
  for (const [option, css] of [['Compacto', 'compact'], ['Médio', 'medium'], ['Expandido', 'expanded']] as const) {
    await selectOption(page, density, option);
    await expect(page.locator(`.hud-preview-${css}`)).toBeVisible();
  }
  const finalDensity = info.project.name === 'desktop-1366' ? 'Compacto' : info.project.name === 'desktop-1920' ? 'Médio' : 'Expandido';
  await selectOption(page, density, finalDensity);
  const docking = page.getByLabel('Usar abas e painéis encaixáveis');
  if (await docking.isChecked()) await docking.uncheck();
  await selectOption(page, page.getByRole('combobox', { name: 'Distribuição dos painéis' }), 'Empilhados · em cima e embaixo');
  await selectOption(page, page.getByRole('combobox', { name: 'Posição dos atalhos de atendimento' }), 'Lateral esquerda');
  const saved = page.waitForResponse((response) => response.url().endsWith('/api/operations/settings/preferences') && response.request().method() === 'PUT' && response.ok());
  await page.getByRole('button', { name: 'Confirmar alterações' }).click();
  await saved;
  const toast = page.locator('.toast');
  await expect(toast).toContainText('Atendimento personalizado e salvo na sua conta.');
  await expect(toast.locator('.toast-progress')).toHaveCSS('animation-name', 'toast-progress');
  await expect(toast.locator('.toast-progress')).toHaveCSS('animation-duration', '4.5s');
  await page.reload();
  const densityValue = finalDensity === 'Compacto' ? 'compact' : finalDensity === 'Médio' ? 'medium' : 'expanded';
  await expect(page.locator('html')).toHaveAttribute('data-density', densityValue);
  await expect(page.locator('.inbox-layout')).toHaveClass(/hud-layout-rows/);
  await page.locator('button.chat-item:not(.chat-item-more)').first().click();
  await expect(page.locator('.attendance-chat-body')).toHaveClass(/shortcuts-position-left/);
  await saveEvidence(page, ['REQ-215', 'REQ-216', 'REQ-222'], info, { densitiesPreviewed: ['compact', 'medium', 'expanded'], persisted: densityValue, layout: 'rows', shortcuts: 'left', toastProgressSeconds: 4.5 });
});

test('REQ-218/REQ-219/REQ-220/REQ-221 aplica camadas, gradiente, animação e estados interativos', async ({ page }, info) => {
  await openPersonalization(page);
  const surface = page.locator('.personalization-card').first();
  const primary = page.locator('.button.primary').first();
  const baseStyles = await surface.evaluate((element) => {
    const style = getComputedStyle(element);
    return { backdropFilter: style.backdropFilter, borderColor: style.borderColor, boxShadow: style.boxShadow };
  });
  expect(baseStyles.backdropFilter).toContain('blur');
  expect(baseStyles.borderColor).not.toBe('rgba(0, 0, 0, 0)');
  await expect(primary).toHaveCSS('background-image', /linear-gradient/);
  await primary.hover();
  await expect(primary).not.toHaveCSS('transform', 'none');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  let reachedByKeyboard = false;
  for (let index = 0; index < 60 && !reachedByKeyboard; index++) {
    await page.keyboard.press('Tab');
    reachedByKeyboard = await primary.evaluate((element) => element === document.activeElement);
  }
  expect(reachedByKeyboard).toBeTruthy();
  await expect(primary).toHaveCSS('outline-style', 'solid');
  const box = await primary.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  const activeTransform = await primary.evaluate((element) => getComputedStyle(element).transform);
  expect(activeTransform).not.toBe('none');
  await page.mouse.up();
  await openSearch(page, true);
  const modal = page.locator('dialog.modal[open]');
  await expect(modal).toHaveCSS('animation-name', 'noctua-modal-in');
  await expect(modal).toHaveCSS('animation-duration', '0.18s');
  await expect(modal).not.toHaveCSS('box-shadow', 'none');
  await saveEvidence(page, ['REQ-218', 'REQ-219', 'REQ-220', 'REQ-221'], info, { ...baseStyles, activeTransform, modalAnimation: 'noctua-modal-in 180ms' });
  await page.keyboard.press('Escape');
});

test('REQ-224/REQ-225/REQ-226/REQ-227/REQ-228/REQ-229 percorre resultados da busca global', async ({ page }, info) => {
  await openApp(page);
  let search = await openSearch(page, true);
  await search.fill('Ana Exemplo');
  await page.getByRole('button', { name: /Ana Exemplo.*Conversa/ }).click();
  await expect(page.locator('.client-name-button')).toContainText('Ana Exemplo');
  await saveEvidence(page, ['REQ-224', 'REQ-226'], info, { shortcut: 'Ctrl+K', conversation: 'Ana Exemplo' });

  search = await openSearch(page);
  await search.fill('Campanha Auditoria');
  await page.getByRole('button', { name: /Campanha Auditoria.*Campanha/ }).click();
  await expect(page.getByRole('heading', { name: 'Campanha Auditoria' })).toBeVisible();
  await saveEvidence(page, ['REQ-225', 'REQ-227'], info, { trigger: 'header button', campaign: 'Campanha Auditoria' });

  search = await openSearch(page);
  await search.fill('Boas-vindas da auditoria');
  await page.getByRole('button', { name: /Boas-vindas da auditoria.*Biblioteca/ }).click();
  await expect(page.getByText('Boas-vindas da auditoria', { exact: true }).first()).toBeVisible();
  await saveEvidence(page, 'REQ-228', info, { resource: 'Boas-vindas da auditoria' });

  search = await openSearch(page);
  await search.fill('cores');
  await page.getByRole('button', { name: /Cores, tema e identidade.*Personalização/ }).click();
  await expect(page.getByRole('heading', { name: 'Identidade e cores' })).toBeVisible();
  await saveEvidence(page, 'REQ-229', info, { setting: 'Cores, tema e identidade' });
});

test('REQ-230/REQ-231/REQ-232/REQ-233 move card, persiste valor e mostra retorno por etiqueta e campanha', async ({ page }, info) => {
  await openApp(page);
  await page.getByRole('button', { name: 'CRM e negócios', exact: true }).click();
  const editAna = page.getByRole('button', { name: /Editar negociação de Ana Exemplo em/ });
  await expect(editAna).toBeVisible();
  const currentName = await editAna.getAttribute('aria-label');
  await editAna.click();
  const value = `${321 + ['desktop-1366', 'desktop-1920', 'mobile-390'].indexOf(info.project.name)}.00`;
  await page.getByLabel('Valor (R$)').fill(value);
  const saved = page.waitForResponse((response) => response.url().includes('/api/crm/sessions/') && response.url().includes('/opportunities/') && response.request().method() === 'PUT' && response.ok());
  await page.getByRole('button', { name: 'Salvar negociação' }).click();
  await saved;
  await expect(page.getByText('Negociação atualizada.')).toBeVisible();
  await page.getByRole('button', { name: /Editar negociação de Ana Exemplo em/ }).click();
  await expect(page.getByLabel('Valor (R$)')).toHaveValue(value);
  const move = page.locator('.opportunity-move');
  const target = currentName?.includes('Novo lead') ? 'Orçamento' : 'Novo lead';
  await selectOption(page, move.getByRole('combobox'), target);
  const moved = page.waitForResponse((response) => response.url().endsWith('/move') && response.request().method() === 'POST' && response.ok());
  await move.getByRole('button', { name: 'Mover cartão' }).click();
  await moved;
  await expect(page.getByRole('button', { name: new RegExp(`Editar negociação de Ana Exemplo em ${target}`) })).toBeVisible();
  await saveEvidence(page, ['REQ-230', 'REQ-231'], info, { contact: 'Ana Exemplo', target, value });

  await page.getByRole('button', { name: 'Visão geral', exact: true }).click();
  const labelFinance = page.locator('.label-finance').getByText(/Clientes.*1 vendas.*Receita.*100,00.*Investimento.*20,00/s);
  await expect(labelFinance).toBeVisible();
  await expect(page.locator('.label-finance')).toContainText('Retorno estimado: 400%');
  await saveEvidence(page, 'REQ-232', info, { label: 'Clientes', revenue: 100, investment: 20, roi: 400 });

  await page.getByRole('button', { name: 'Campanhas', exact: true }).click();
  const campaign = page.locator('article.surface').filter({ has: page.getByRole('heading', { name: 'Campanha Auditoria' }) });
  await expect(campaign).toContainText('Receita atribuída: R$ 100,00');
  await expect(campaign).toContainText('Investimento: R$ 20,00');
  await expect(campaign).toContainText('ROI 400%');
  await saveEvidence(page, 'REQ-233', info, { campaign: 'Campanha Auditoria', revenue: 100, investment: 20, roi: 400 });
});
