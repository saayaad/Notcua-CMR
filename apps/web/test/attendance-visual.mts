import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, type Page } from '@playwright/test';

const currentDirectory = process.cwd();
const webRoot = currentDirectory.replaceAll('\\', '/').endsWith('/apps/web') ? currentDirectory : resolve('apps/web');
const nodeExecutable = [process.execPath, ...(process.env.PATH ?? '').split(delimiter).map((directory) => resolve(directory, 'node.exe'))].find(existsSync);
assert.ok(nodeExecutable, 'Executável Node disponível para o teste visual');
const server = spawn(nodeExecutable, [resolve(webRoot, '../../node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5174'], { cwd: webRoot, stdio: 'inherit' });
let serverReady = false;
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    const response = await fetch('http://127.0.0.1:5174/attendance-layout-preview.html');
    if (response.ok) { serverReady = true; break; }
  } catch { /* O servidor de fixture ainda está iniciando. */ }
  await delay(250);
}
if (!serverReady) {
  server.kill();
  assert.fail('Servidor local da fixture iniciou sem depender do navegador do usuário');
}
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await context.newPage();
const output = (name: string) => join(tmpdir(), `noctua-attendance-${name}.png`);

async function groups(page: Page) {
  return page.locator('.noctua-dock .dv-groupview').evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) };
  }));
}
async function dragSash(selector: string, dx: number, dy: number) {
  const sash = page.locator(selector).first();
  await sash.waitFor({ state: 'visible' });
  const rect = await sash.boundingBox();
  assert.ok(rect, `Divisória visível: ${selector}`);
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 + dx, rect.y + rect.height / 2 + dy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(650);
}

try {
  await page.goto('http://127.0.0.1:5174/attendance-layout-preview.html');
  await page.getByText('Texto atualizado pelo cliente.').waitFor();
  await page.getByLabel('Mensagem apagada pelo cliente').waitFor();
  const original = page.getByText('Ver texto original');
  await original.click();
  await page.getByText('Texto original enviado pelo cliente.').waitFor();
  await page.locator('[data-fixture-message="edited-text"]').screenshot({ path: output('mensagem-editada-com-original') });
  const deletedText = page.locator('[data-fixture-message="deleted-text"] .message-text');
  assert.equal(await deletedText.evaluate((node) => getComputedStyle(node).opacity), '0.48');
  await original.click();
  await page.locator('[data-fixture-message="edited-text"]').screenshot({ path: output('mensagem-editada-desktop') });
  await page.locator('[data-fixture-message="deleted-text"]').screenshot({ path: output('mensagem-apagada-desktop') });
  await page.screenshot({ path: output('mensagens-escuro-desktop'), fullPage: true });
  await page.getByRole('button', { name: 'Tema claro' }).click();
  await page.screenshot({ path: output('mensagens-claro-desktop'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-fixture-message="edited-text"]').screenshot({ path: output('mensagem-editada-claro-mobile') });
  await page.locator('[data-fixture-message="deleted-text"]').screenshot({ path: output('mensagem-apagada-claro-mobile') });
  await page.screenshot({ path: output('mensagens-claro-mobile'), fullPage: true });
  await page.getByRole('button', { name: 'Tema escuro' }).click();
  await page.screenshot({ path: output('mensagens-escuro-mobile'), fullPage: true });

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.locator('[data-fixture-panel="chat"]').waitFor();
  await page.waitForTimeout(100);
  await page.getByRole('button', { name: 'Opções' }).click();
  await page.locator('#conversation-list-options').waitFor({ state: 'visible' });
  await page.waitForTimeout(650);
  let listPreferences = await page.evaluate(() => JSON.parse(localStorage.getItem('noctua-preferences:local') || '{}'));
  assert.equal(listPreferences.conversationOptionsExpanded, true, 'Estado do botão Opções salvo nas preferências');
  await page.reload();
  await page.locator('#conversation-list-options').waitFor({ state: 'visible' });
  assert.equal(await page.getByRole('button', { name: 'Ocultar opções' }).count(), 1, 'Opções seguem abertas após recarregar');
  const horizontalCount = await page.locator('.noctua-dock .dv-split-view-container.dv-horizontal .dv-sash').count();
  assert.ok(horizontalCount >= 1, 'Divisória horizontal disponível fora do modo de organização');
  await dragSash('.noctua-dock .dv-split-view-container.dv-horizontal .dv-sash', 70, 0);
  const widthPreferences = await page.evaluate(() => JSON.parse(localStorage.getItem('noctua-preferences:local') || '{}'));
  assert.ok(widthPreferences.dockingPanelSizes?.list?.width > 220, 'Largura arrastada gravada');
  const beforeHide = await groups(page);
  await page.getByRole('tab', { name: 'Conversas' }).click();
  await page.getByRole('button', { name: 'Recolher Conversas' }).click();
  const afterHide = await groups(page);
  assert.deepEqual(afterHide, beforeHide, 'Recolher mantém dimensões e posição de todos os grupos');
  await page.screenshot({ path: output('painel-recolhido-desktop') });
  await page.getByRole('button', { name: 'Abrir Conversas' }).click();
  const afterReopen = await groups(page);
  assert.deepEqual(afterReopen, beforeHide, 'Reabrir mantém dimensões e posição de todos os grupos');

  await page.getByRole('button', { name: 'Organizar painéis' }).click();
  await page.getByRole('combobox', { name: 'Painel para organizar' }).selectOption('tools');
  await page.getByRole('combobox', { name: 'Posicionar painel' }).selectOption('below');
  await page.getByRole('button', { name: 'Confirmar layout' }).click();
  const verticalCount = await page.locator('.noctua-dock .dv-split-view-container.dv-vertical .dv-sash').count();
  assert.ok(verticalCount > 0, 'Divisória vertical disponível para arrastar a altura');
  await dragSash('.noctua-dock .dv-split-view-container.dv-vertical .dv-sash', 0, 55);
  const savedLayout = await page.evaluate(() => JSON.parse(localStorage.getItem('noctua-preferences:local') || '{}'));
  assert.ok(Object.values(savedLayout.dockingPanelSizes ?? {}).some((size: any) => size.height > 130), 'Altura arrastada gravada');
  const beforeReload = await groups(page);
  await page.reload();
  await page.locator('[data-fixture-panel="chat"]').waitFor();
  await page.waitForTimeout(250);
  const afterReload = await groups(page);
  assert.deepEqual(afterReload, beforeReload, 'Tamanhos permanecem após recarregar a página');
  await page.screenshot({ path: output('painéis-redimensionados-desktop'), fullPage: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.screenshot({ path: output('painéis-desktop-grande'), fullPage: true });
  console.log(JSON.stringify({ result: 'passed', screenshots: 'arquivos noctua-attendance-*.png na pasta temporária', horizontalSashes: horizontalCount, verticalSashes: verticalCount, sizes: afterReload }));
} finally {
  await browser.close();
  server.kill();
}
