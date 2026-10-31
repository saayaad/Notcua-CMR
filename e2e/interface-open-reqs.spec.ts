import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const evidenceRoot = resolve(process.cwd(), 'REVISAO', 'evidencias');

async function save(page: Page, req: string, info: TestInfo, name: string, data: Record<string, unknown>) {
  const dir = resolve(evidenceRoot, req);
  await mkdir(dir, { recursive: true });
  const suffix = info.project.name.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
  await page.screenshot({ path: resolve(dir, `${suffix}-${name}.png`), fullPage: true });
  await writeFile(resolve(dir, `${suffix}-${name}.json`), JSON.stringify({
    req, result: 'APROVADO', project: info.project.name, viewport: info.project.use.viewport,
    url: page.url(), ...data,
  }, null, 2), 'utf8');
}

async function open(page: Page) {
  await page.goto('/atendimento');
  await expect(page.locator('.app-shell')).toBeVisible();
  await expect(page.locator('[aria-label="Atendimento com painéis encaixáveis"], .inbox-layout')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Carregando painéis…/)).toBeHidden({ timeout: 15_000 });
}

async function navigate(page: Page, name: string, heading: RegExp) {
  const navName = name === 'CRM' ? 'CRM e negócios' : name;
  await page.getByRole('button', { name: navName, exact: true }).click();
  await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
}

test('REQ-194 telas definidas cabem nas resoluções acordadas com tolerância de 2 px', async ({ page }, info) => {
  await open(page);
  const screens = [
    { name: 'Atendimento', heading: /Atendimento|Conversa/i },
    { name: 'CRM', heading: /CRM e negócios/i },
    { name: 'Campanhas', heading: /Campanhas/i },
    { name: 'Configurações', heading: /Configurações/i },
  ];
  const measurements: Record<string, unknown>[] = [];
  for (const screen of screens) {
    if (screen.name !== 'Atendimento') await navigate(page, screen.name, screen.heading);
    const metric = await page.evaluate((screenName) => {
      const root = document.documentElement;
      const selector = screenName === 'Atendimento'
        ? '[aria-label="Atendimento com painéis encaixáveis"], .inbox-layout'
        : screenName === 'CRM' ? '.crm-page'
          : screenName === 'Campanhas' ? '.operations-page'
            : '.settings-page, [data-page="settings"], main';
      const main = document.querySelector(selector) ?? document.querySelector('.app-shell');
      const rect = main?.getBoundingClientRect();
      return {
        viewport: { width: innerWidth, height: innerHeight },
        horizontalOverflowPx: Math.max(0, root.scrollWidth - root.clientWidth),
        mainLeft: rect?.left ?? null, mainRightExcess: rect ? Math.max(0, rect.right - innerWidth) : null,
        mainTop: rect?.top ?? null, mainBottomExcess: rect ? Math.max(0, rect.bottom - innerHeight) : null,
      };
    }, screen.name);
    expect(metric.horizontalOverflowPx, `${screen.name}: overflow horizontal`).toBeLessThanOrEqual(2);
    expect(metric.mainLeft, `${screen.name}: conteúdo fora à esquerda`).toBeGreaterThanOrEqual(-2);
    expect(metric.mainRightExcess, `${screen.name}: conteúdo fora à direita`).toBeLessThanOrEqual(2);
    measurements.push({ screen: screen.name, ...metric });
    await save(page, 'REQ-194', info, screen.name.toLowerCase(), { criterion: 'overflow/limites do conteúdo até 2 px', ...metric });
  }
  expect(measurements).toHaveLength(4);
});

test('REQ-195 compara a identidade visual atual nas quatro telas definidas', async ({ page }, info) => {
  await open(page);
  const reports: Record<string, unknown>[] = [];
  const screens = [
    { name: 'Atendimento', heading: /Atendimento|Conversa/i },
    { name: 'CRM', heading: /CRM e negócios/i },
    { name: 'Campanhas', heading: /Campanhas/i },
    { name: 'Configurações', heading: /Configurações/i },
  ];
  for (const screen of screens) {
    if (screen.name !== 'Atendimento') await navigate(page, screen.name, screen.heading);
    if (screen.name === 'Configurações') {
      await page.getByRole('main').getByRole('button', { name: 'Personalização', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Identidade e cores' })).toBeVisible();
    }
    const visual = await page.evaluate(() => {
      const visible = (element: Element) => {
        const rect = element.getBoundingClientRect();
        const css = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && css.visibility !== 'hidden' && css.display !== 'none';
      };
      const style = (element: Element | null) => element ? {
        fontFamily: getComputedStyle(element).fontFamily,
        borderRadius: getComputedStyle(element).borderRadius,
        borderStyle: getComputedStyle(element).borderStyle,
        backgroundColor: getComputedStyle(element).backgroundColor,
      } : null;
    const root = getComputedStyle(document.documentElement);
      const button = [...document.querySelectorAll('button.button')].find(visible) ?? [...document.querySelectorAll('button')].find(visible);
      const input = [...document.querySelectorAll('input:not([type="checkbox"]):not([type="file"]):not([type="color"])')].find(visible);
      const card = [...document.querySelectorAll('.surface, .personalization-card, .crm-column, article, [class*="card"]')].find(visible);
      return {
        tokens: Object.fromEntries(['--bg', '--surface', '--line', '--text', '--accent'].map((key) => [key, root.getPropertyValue(key).trim()])),
        button: style(button), input: style(input), card: style(card),
        tableCount: document.querySelectorAll('table, [role="table"]').length,
      };
    });
    for (const [token, value] of Object.entries(visual.tokens)) expect(value, `${screen.name}: ${token} definido no tema atual`).not.toBe('');
    expect(visual.button, `${screen.name}: botão visível`).not.toBeNull();
    expect(visual.button!.fontFamily, `${screen.name}: botão usa tipografia computada`).not.toBe('');
    if (visual.input) expect(visual.input.fontFamily, `${screen.name}: campo usa tipografia computada`).not.toBe('');
    if (visual.card) expect(visual.card.fontFamily, `${screen.name}: card usa tipografia computada`).not.toBe('');
    reports.push({ screen: screen.name, ...visual });
    await save(page, 'REQ-195', info, `visual-${screen.name.toLowerCase()}`, { reference: 'visual atual do app', ...visual });
  }
  expect(reports.every((report) => (report as { tableCount: number }).tableCount === 0), 'telas cobertas não usam tabela HTML/role=table').toBe(true);
  await page.getByRole('button', { name: 'Personalizar Atendimento com prévia' }).click();
  const modal = page.locator('dialog.modal[open]');
  await expect(modal).toBeVisible();
  const modalVisual = await modal.evaluate((el) => ({
    borderRadius: getComputedStyle(el).borderRadius,
    backgroundColor: getComputedStyle(el).backgroundColor,
    animationName: getComputedStyle(el).animationName,
  }));
  expect(modalVisual.borderRadius).not.toBe('0px');
  await save(page, 'REQ-195', info, 'visual-modal', { reports, modalVisual, reference: 'tokens e controles do visual atual nas quatro telas' });
});

test('REQ-196 páginas e modal animam normalmente e respeitam movimento reduzido', async ({ page }, info) => {
  await open(page);
  const loadingAnimation = await page.evaluate(() => {
    const spinner = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    spinner.classList.add('spin');
    document.body.append(spinner);
    const animation = getComputedStyle(spinner).animationName;
    spinner.remove();
    return animation;
  });
  expect(loadingAnimation).toBe('rotate');
  await page.getByRole('button', { name: 'Campanhas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Campanhas', exact: true })).toBeVisible();
  const pageAnimation = await page.locator('.operations-page').evaluate((el) => getComputedStyle(el).animationName);
  await page.getByRole('button', { name: 'Nova campanha' }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  const normal = await modal.evaluate((el) => getComputedStyle(el).animationName);
  expect(normal).not.toBe('none');
  await page.getByRole('button', { name: /Fechar|Cancelar/ }).first().click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Nova campanha' }).click();
  await expect(modal).toBeVisible();
  const reduced = await modal.evaluate((el) => getComputedStyle(el).animationName);
  expect(reduced).toBe('none');
  await save(page, 'REQ-196', info, 'animacao-e-movimento-reduzido', { pageAnimation, modalAnimation: normal, reducedMotionAnimation: reduced });
});

test('REQ-197 navegação e ações verificáveis têm nomes acessíveis nos quatro módulos globais', async ({ page }, info) => {
  await open(page);
  const reports: Record<string, unknown>[] = [];
  for (const screen of [
    { name: 'Atendimento', heading: /Atendimento|Conversa/i },
    { name: 'CRM', heading: /CRM e negócios/i },
    { name: 'Campanhas', heading: /Campanhas/i },
    { name: 'Configurações', heading: /Configurações/i },
  ]) {
    if (screen.name !== 'Atendimento') await navigate(page, screen.name, screen.heading);
    const unnamed = await page.locator('button:visible').evaluateAll((buttons) => buttons
      .filter((button) => ![button.getAttribute('aria-label'), button.getAttribute('title'), button.textContent]
        .some((value) => value?.trim()))
      .map((button) => button.outerHTML.slice(0, 180)));
    reports.push({ screen: screen.name, visibleButtons: await page.locator('button:visible').count(), unnamed });
    expect(unnamed, `${screen.name}: botões visíveis precisam de nome acessível`).toEqual([]);
    if (screen.name === 'CRM') {
      await page.getByRole('button', { name: 'Nova etapa', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: /Fechar|Cancelar/ }).first().click();
    }
    if (screen.name === 'Campanhas') {
      await page.getByRole('button', { name: 'Nova campanha' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: /Fechar|Cancelar/ }).first().click();
    }
    if (screen.name === 'Configurações') {
      await page.getByRole('main').getByRole('button', { name: 'Personalização', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Identidade e cores', exact: true })).toBeVisible();
    }
  }
  await save(page, 'REQ-197', info, 'acoes-e-nomes-acessiveis', { reports, checked: 'nomes acessíveis de botões visíveis nas quatro telas definidas da REQ-194' });
});
