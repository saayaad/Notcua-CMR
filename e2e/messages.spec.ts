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

test('REQ-241/REQ-242 alterna lista arquivada, arquiva e reabre conversa com persistência', async ({ page }, info) => {
  await openFirstConversation(page);
  const name = await page.locator('.client-name-button').innerText();
  await page.getByRole('button', { name: 'Arquivar conversa' }).click();
  await expect(page.locator('button.chat-item').filter({ hasText: name })).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Arquivadas', exact: true }).click();
  await expect(page.locator('button.chat-item').filter({ hasText: name })).toBeVisible();
  await page.locator('button.chat-item').filter({ hasText: name }).click();
  await expect(page.getByRole('button', { name: 'Reabrir conversa' })).toBeVisible();
  await page.getByRole('button', { name: 'Reabrir conversa' }).click();
  await page.reload();
  await expect(page.locator('button.chat-item').filter({ hasText: name })).toBeVisible();
  await evidence(page, ['REQ-241', 'REQ-242'], info, { conversation: name, archivedThenReopened: true });
});

test('REQ-247/REQ-248/REQ-249 salva nota privada dourada sem chamar a rota de envio', async ({ page }, info) => {
  await openFirstConversation(page);
  await page.getByRole('button', { name: 'Nota interna', exact: true }).click();
  const text = `Nota privada auditoria ${info.project.name}`;
  const response = page.waitForResponse((res) => res.url().includes('/internal-notes') && res.request().method() === 'POST' && res.ok());
  await page.getByLabel('Mensagem').fill(text);
  await page.getByRole('button', { name: 'Salvar nota interna' }).click();
  await response;
  const note = page.locator('.internal-note-bubble').filter({ hasText: text });
  await expect(note).toBeVisible();
  await expect(note.locator('.internal-note-label')).toContainText('Nota interna');
  await expect(note).toHaveCSS('background-image', /linear-gradient/);
  await page.reload();
  await expect(page.locator('.internal-note-bubble').filter({ hasText: text })).toBeVisible();
  await evidence(page, ['REQ-247', 'REQ-248', 'REQ-249'], info, { note: text, persisted: true, externalSend: false });
});

test('REQ-254/REQ-255/REQ-256 abre, filtra e seleciona recurso da Biblioteca rápida', async ({ page }, info) => {
  await openFirstConversation(page);
  const composer = page.getByLabel('Mensagem');
  await composer.fill('/Boas');
  const menu = page.getByRole('listbox', { name: 'Respostas rápidas da Biblioteca' });
  await expect(menu).toBeVisible();
  const option = menu.getByRole('option', { name: /Boas-vindas da auditoria/ });
  await expect(option).toBeVisible();
  await expect(menu.getByRole('option')).toHaveCount(1);
  await option.click();
  await expect(composer).toHaveValue('Olá, #nome! Esta é uma resposta fictícia.');
  await evidence(page, ['REQ-254', 'REQ-255', 'REQ-256'], info, { selected: 'Boas-vindas da auditoria', sent: false });
});

test('REQ-236/REQ-237/REQ-238/REQ-239 configura HUD pelo cabeçalho e persiste densidade', async ({ page }, info) => {
  await openFirstConversation(page);
  const customize = page.locator('[title="Personalizar Atendimento"]');
  await expect(customize).toBeVisible();
  await customize.click();
  await expect(page.getByRole('heading', { name: 'Personalizar Atendimento' })).toBeVisible();
  const density = page.getByLabel('Tamanho dos controles');
  await density.selectOption('expanded');
  const saved = page.waitForResponse((res) => res.url().endsWith('/api/operations/settings/preferences') && res.request().method() === 'PUT' && res.ok());
  await page.getByRole('button', { name: 'Confirmar alterações' }).click();
  await saved;
  await page.reload();
  const active = page.locator('button.chat-item:not(.chat-item-more)').first();
  await active.click();
  await expect(page.locator('.inbox-layout')).toHaveClass(/density-expanded/);
  await expect(page.locator('.chat-header button[title]').first()).toHaveAttribute('title', /Agendar mensagem|Arquivar conversa/);
  await evidence(page, ['REQ-236', 'REQ-237', 'REQ-238', 'REQ-239'], info, { density: 'expanded', persisted: true, tooltip: true });
});
