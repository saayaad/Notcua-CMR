import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
async function openEditor(page: Page, enabled = true, failFirstSave = false) {
  const posts: any[] = [];
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith('/operations/features'))
      return route.fulfill({
        json: { aiEnabled: false, canManage: true, campaignAlternativesEnabled: enabled },
      });
    if (path.endsWith('/audience'))
      return route.fulfill({
        json: {
          count: 2,
          items: [
            { id: 'lead-1', name: 'Ana', phoneNumber: '5511000000001' },
            { id: 'lead-2', name: 'Bia', phoneNumber: '5511000000002' },
          ],
        },
      });
    if (path.endsWith('/file')) return route.fulfill({ contentType: 'image/png', body: png });
    if (path.endsWith('/batches') && route.request().method() === 'POST') {
      posts.push(route.request().postDataJSON());
      return posts.length === 1 && failFirstSave
        ? route.fulfill({ status: 503, json: { error: { message: 'Falha fictícia. Tente novamente.' } } })
        : route.fulfill({ status: 201, json: { id: 'draft-ficticio' } });
    }
    return route.fulfill({ json: { items: [] } });
  });
  await page.goto('/phase3-editor.html');
  await page.getByLabel('Nome', { exact: true }).fill('Campanha fictícia');
  if (enabled) await page.getByLabel('Usar alternativas completas por contato').check();
  return posts;
}
async function choose(page: Page, label: string, name: string | RegExp) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name, exact: typeof name === 'string' }).click();
}

test('Fase 3: limites, duplicação independente, confirmação e seleção após remover', async ({ page }) => {
  await openEditor(page);
  await expect(page.getByRole('button', { name: 'Remover alternativa', exact: true })).toBeDisabled();
  await page.getByLabel('Texto da etapa 1', { exact: true }).fill('Texto original');
  await page.getByRole('button', { name: 'Duplicar alternativa', exact: true }).click();
  await expect(page.getByLabel('Nome da alternativa', { exact: true })).toHaveValue('Alternativa 1 (cópia)');
  await page.getByLabel('Texto da etapa 1', { exact: true }).fill('Texto da cópia');
  await choose(page, 'Alternativa na prévia', '1. Alternativa 1');
  await expect(page.getByLabel('Texto da etapa 1', { exact: true })).toHaveValue('Texto original');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Remover alternativa', exact: true }).click();
  await expect(page.getByText('2 / 10 alternativas', { exact: true })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Remover alternativa', exact: true }).click();
  await expect(page.getByLabel('Texto da etapa 1', { exact: true })).toHaveValue('Texto da cópia');
  for (let i = 1; i < 10; i++)
    await page.getByRole('button', { name: 'Adicionar alternativa', exact: true }).click();
  await expect(page.getByText('10 / 10 alternativas', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adicionar alternativa', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Duplicar alternativa', exact: true })).toBeDisabled();
});

test('Fase 3: texto, mídia e espera preservam ordem na prévia e no rascunho; erro permite repetir', async ({
  page,
}, info) => {
  const posts = await openEditor(page, true, true);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByLabel('Nome da alternativa', { exact: true }).fill('Boas-vindas');
  await page.getByLabel('Texto da etapa 1', { exact: true }).fill('Olá, {{nome}}!');
  await expect(page.getByTestId('alternative-summary')).toContainText('14 caracteres de texto');
  await page.getByRole('button', { name: 'Adicionar etapa', exact: true }).click();
  await choose(page, 'Conteúdo da etapa 2', 'Mídia ou recurso da biblioteca');
  await choose(page, 'Recurso da etapa 2', 'Imagem fictícia');
  await page.getByLabel('Espera antes da etapa 2 (s)', { exact: true }).fill('25');
  await page.getByRole('button', { name: 'Adicionar etapa', exact: true }).click();
  await page.getByLabel('Texto da etapa 3', { exact: true }).fill('Até logo');
  const preview = page.locator('.campaign-phone-panel');
  await expect(preview.locator('.phone-message').first()).toContainText('Olá, Ana!');
  await expect(preview.getByText('Espera de 25 s', { exact: true })).toBeVisible();
  await expect(preview.getByRole('img', { name: 'Imagem fictícia' })).toBeVisible();
  await expect(preview.locator('.phone-message')).toHaveCount(3);
  await expect(preview.locator('.phone-message').nth(0)).toContainText('Olá, Ana!');
  await expect(preview.locator('.phone-message').nth(2)).toContainText('Até logo');
  await page.getByRole('button', { name: 'Mover etapa 3 para cima', exact: true }).click();
  await expect(preview.locator('.phone-message').nth(1)).toContainText('Até logo');
  await expect(page.getByLabel('Espera antes da etapa 3 (s)', { exact: true })).toHaveValue('25');
  await page.getByRole('button', { name: 'Duplicar alternativa', exact: true }).click();
  await page.getByLabel('Nome da alternativa', { exact: true }).fill('Segunda opção');
  await page.getByLabel('Texto da etapa 1', { exact: true }).fill('Outra abordagem');
  await choose(page, 'Alternativa na prévia', '1. Boas-vindas');
  await expect(preview.locator('.phone-message').first()).toContainText('Olá, Ana!');
  await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Falha fictícia');
  await expect(page.getByLabel('Texto da etapa 1', { exact: true })).toHaveValue('Olá, {{nome}}!');
  await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
  await expect.poll(() => posts.length).toBe(2);
  expect(posts[1].alternatives).toEqual(posts[0].alternatives);
  expect(posts[1].alternatives.map((item: any) => item.name)).toEqual(['Boas-vindas', 'Segunda opção']);
  expect(posts[1].alternatives[0].delivery.steps).toEqual([
    { kind: 'text', text: 'Olá, {{nome}}!', waitSeconds: 0 },
    { kind: 'text', text: 'Até logo', waitSeconds: 0 },
    { kind: 'asset', assetId: 'test-image', waitSeconds: 25 },
  ]);
  expect(posts[1].alternatives[1].delivery.steps[0].text).toBe('Outra abordagem');
  expect(errors).toEqual([]);
  await preview.scrollIntoViewIfNeeded();
  const dimensions = await page
    .locator('dialog')
    .evaluate((dialog) => ({
      width: dialog.getBoundingClientRect().width,
      viewport: innerWidth,
      overflow: dialog.scrollWidth > dialog.clientWidth + 1,
    }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.overflow).toBe(false);
  await mkdir(resolve('.audit/phase3-screenshots'), { recursive: true });
  await page.screenshot({
    path: resolve(`.audit/phase3-screenshots/${info.project.name}.png`),
    fullPage: true,
  });
});

test('Fase 3: valida alternativa fora da seleção e mantém editor legado com flag desligada', async ({
  page,
}) => {
  const posts = await openEditor(page);
  await page.getByRole('button', { name: 'Adicionar alternativa', exact: true }).click();
  await page.getByLabel('Texto da etapa 1', { exact: true }).fill('Segunda preenchida');
  await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Alternativa 1, etapa 1');
  expect(posts).toHaveLength(0);
  await page.unrouteAll({ behavior: 'wait' });
  await openEditor(page, false);
  await expect(page.getByLabel('Usar alternativas completas por contato')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Conteúdo', exact: true })).toBeVisible();
});
