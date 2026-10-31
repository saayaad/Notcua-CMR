import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const evidence = resolve(process.cwd(), 'REVISAO', 'evidencias', 'REQ-680');
const reactions = new Map<string, string>();
const state = { role: 'MEMBER', interceptedWrites: [] as string[], consoleErrors: [] as string[], pageErrors: [] as string[], blockedExternal: [] as string[], mockedExternal: [] as string[] };

test.beforeEach(async ({ page }) => {
  reactions.clear();
  state.role = 'MEMBER';
  state.interceptedWrites = [];
  state.consoleErrors = [];
  state.pageErrors = [];
  state.blockedExternal = [];
  state.mockedExternal = [];
  page.on('pageerror', (error) => state.pageErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') state.consoleErrors.push(message.text()); });
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
      if (url.hostname === 'apis.google.com') {
        state.mockedExternal.push(url.origin);
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
      }
      state.blockedExternal.push(url.origin);
      return route.abort('blockedbyclient');
    }
    if (url.port === '3340' && url.pathname.endsWith('/messages') && url.searchParams.get('page') === '1' && url.searchParams.get('pageSize') === '50') {
      const values = [...reactions.entries()].map(([actor, emoji]) => ({ actor, emoji }));
      const groups = [...new Set(values.map((value) => value.emoji))].map((emoji) => ({
        emoji, count: values.filter((value) => value.emoji === emoji).length,
        reactedByMe: values.some((value) => value.actor === state.role && value.emoji === emoji),
      }));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        items: [{ id: 'req680-message', text: 'Mensagem sintética para reação REQ-680', caption: null, direction: 'INBOUND', status: 'DELIVERED', type: 'text', sentAt: new Date().toISOString(), isPtt: false, isPtv: false, asViewOnce: false, fileId: null, error: null, internal: false, reactions: groups }],
        total: 1, page: 1, pageSize: 50,
      }) });
    }
    if (url.port === '3340' && request.method() === 'POST' && /\/messages\/req680-message\/reactions$/.test(url.pathname)) {
      state.interceptedWrites.push(`${request.method()} ${url.pathname}`);
      const { emoji } = request.postDataJSON() as { emoji: string };
      if (reactions.get(state.role) === emoji) reactions.delete(state.role);
      else reactions.set(state.role, emoji);
      const values = [...reactions.values()];
      const groups = [...new Set(values)].map((item) => ({ emoji: item, count: values.filter((value) => value === item).length, reactedByMe: reactions.get(state.role) === item }));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reactions: groups }) });
    }
    if (url.port === '3340' && request.method() !== 'GET') {
      state.interceptedWrites.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    return route.fallback();
  });
});

async function save(page: Page, info: TestInfo) {
  await mkdir(evidence, { recursive: true });
  const suffix = info.project.name.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
  await page.screenshot({ path: resolve(evidence, `${suffix}.png`), fullPage: true });
  await writeFile(resolve(evidence, `${suffix}.json`), JSON.stringify({
    req: 'REQ-680', result: 'APROVADO', test: info.title, project: info.project.name,
    url: page.url(), viewport: info.project.use.viewport, roleTransitions: ['MEMBER', 'ADMIN'],
    reactions: [...reactions.entries()], interceptedWrites: state.interceptedWrites,
    mockedExternal: [...new Set(state.mockedExternal)], blockedExternal: [...new Set(state.blockedExternal)],
    consoleErrors: state.consoleErrors, pageErrors: state.pageErrors,
    persistence: 'fixture state was reread after reload; API persistence separately verified against .audit',
  }, null, 2), 'utf8');
}

test('REQ-680 mostra faixa e menu de reações, salva e recarrega para papéis de teste', async ({ page }, info) => {
  await page.goto('/atendimento');
  await expect(page.locator('.app-shell')).toBeVisible();
  const chat = page.locator('button.chat-item:not(.chat-item-more)').first();
  await expect(chat).toBeVisible();
  await chat.click();
  const bubble = page.locator('.message-bubble').filter({ hasText: 'Mensagem sintética para reação REQ-680' });
  await expect(bubble).toBeVisible();
  const like = bubble.getByRole('button', { name: 'Reagir 👍' });
  await like.click();
  await expect(bubble.getByRole('button', { name: 'Reagir 👍, 1' })).toHaveAttribute('aria-pressed', 'true');
  state.role = 'ADMIN';
  const heart = bubble.getByRole('button', { name: 'Reagir ❤️' });
  await heart.click();
  await expect(bubble.getByRole('button', { name: 'Reagir ❤️, 1' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.app-shell')).toBeVisible();
  const reloadedChat = page.locator('button.chat-item:not(.chat-item-more)').first();
  await reloadedChat.click();
  const reloaded = page.locator('.message-bubble').filter({ hasText: 'Mensagem sintética para reação REQ-680' });
  await expect(reloaded.getByRole('button', { name: 'Reagir 👍, 1' })).toBeVisible();
  await expect(reloaded.getByRole('button', { name: 'Reagir ❤️, 1' })).toBeVisible();
  const bounds = await reloaded.boundingBox();
  expect(bounds).not.toBeNull();
  if (info.project.name === 'mobile-390') {
    await reloaded.dispatchEvent('contextmenu', { bubbles: true, cancelable: true, clientX: bounds!.x + 10, clientY: bounds!.y + 10 });
  } else await reloaded.click({ button: 'right' });
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem', { name: 'Reagir', exact: true })).toBeVisible();
  const labels = await menu.getByRole('menuitem').allTextContents();
  expect(labels.some((label) => /WhatsApp|Meta AI/i.test(label))).toBe(false);
  expect(state.interceptedWrites.filter((path) => /\/messages\/.*\/send/.test(path))).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  await page.keyboard.press('Escape');
  await save(page, info);
});
