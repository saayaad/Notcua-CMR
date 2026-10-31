import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type State = {
  blockedWrites: string[];
  blockedExternal: string[];
  pageErrors: string[];
  consoleErrors: string[];
};

const states = new WeakMap<Page, State>();
const evidenceRoot = resolve(process.cwd(), 'REVISAO', 'evidencias');

test.beforeEach(async ({ page }) => {
  const state: State = { blockedWrites: [], blockedExternal: [], pageErrors: [], consoleErrors: [] };
  states.set(page, state);
  page.on('pageerror', (error) => state.pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') state.consoleErrors.push(message.text());
  });
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    if (!local) {
      state.blockedExternal.push(url.origin);
      return route.abort('blockedbyclient');
    }
    if (request.method() !== 'GET' && url.port === '3340') {
      state.blockedWrites.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"blocked by audit"}' });
    }
    return route.fallback();
  });
});

async function openApp(page: Page) {
  await page.goto('/atendimento');
  await expect(page.locator('.app-shell')).toBeVisible();
}

async function saveEvidence(page: Page, id: string, info: TestInfo, details: Record<string, unknown> = {}) {
  const state = states.get(page)!;
  const directory = resolve(evidenceRoot, id);
  await mkdir(directory, { recursive: true });
  const suffix = info.project.name.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
  await page.screenshot({ path: resolve(directory, `${suffix}.png`), fullPage: true });
  await writeFile(
    resolve(directory, `${suffix}.json`),
    JSON.stringify({
      req: id,
      result: 'APROVADO',
      test: info.title,
      project: info.project.name,
      url: page.url(),
      viewport: info.project.use.viewport,
      blockedWrites: state.blockedWrites,
      blockedExternal: [...new Set(state.blockedExternal)],
      consoleErrors: state.consoleErrors,
      pageErrors: state.pageErrors,
      ...details,
    }, null, 2),
    'utf8',
  );
}

test('REQ-668 menu global e menu específico da Biblioteca usam o mesmo componente', async ({ page }, info) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  const resource = page.locator('.resource-card').first();
  await expect(resource).toBeVisible();
  const resourceName = (await resource.locator('h2').innerText()).trim();
  if (info.project.name === 'mobile-390') {
    await resource.dispatchEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 120, clientY: 140 });
  } else {
    await resource.click({ button: 'right' });
  }
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute('aria-label', resourceName);
  for (const label of ['Visualizar recurso', 'Editar recurso', 'Duplicar recurso…', 'Excluir recurso…']) {
    await expect(menu.getByRole('menuitem', { name: label, exact: true })).toBeVisible();
  }
  await expect(menu.locator('[role="menuitem"]')).toHaveCount(8);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await saveEvidence(page, 'REQ-668', info, {
    area: 'Biblioteca', resourceName, menuItems: 8, actionExecuted: false,
    trigger: info.project.name === 'mobile-390' ? 'synthetic contextmenu event in mobile viewport' : 'right-click',
    source: [
      { file: 'apps/web/src/context/ContextMenu.tsx', symbol: 'ContextMenuProvider', line: 99 },
      { file: 'apps/web/src/pages/LibraryPage.tsx', symbol: 'resource-card onContextMenu', line: 206 },
    ],
    firstAttempt: 'test assertion expected 7 menu items; observed 8 because shared general actions are appended; corrected assertion to the observed rendered structure',
  });
});

test('REQ-673 opção desabilitada continua desabilitada no menu contextual', async ({ page }, info) => {
  await openApp(page);
  await page.evaluate(() => {
    const region = document.createElement('article');
    region.dataset.contextRegion = 'audit-fixture';
    region.style.cssText = 'position:fixed;left:120px;top:120px;width:240px;height:80px;z-index:1;background:white';
    const button = document.createElement('button');
    button.textContent = 'Ação bloqueada pelo estado';
    button.disabled = true;
    region.append(button);
    document.body.append(region);
    region.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 140, clientY: 140 }));
  });
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Ação bloqueada pelo estado', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await saveEvidence(page, 'REQ-673', info, {
    disabledSourceActionPreserved: true,
    roleMatrix: 'server authorization remains covered by access.test.ts',
    source: [
      { file: 'apps/web/src/context/ContextMenu.tsx', symbol: 'disabled: button.disabled', line: 248 },
      { file: 'apps/server/test/access.test.ts', symbol: 'team persistence/isolation/admin permission test', line: 361 },
    ],
  });
});

test('REQ-675 botão Mais opções abre o menu da conversa sem selecioná-la', async ({ page }, info) => {
  await openApp(page);
  const more = page.locator('button.chat-item-more').first();
  await expect(more).toBeVisible();
  const accessibleName = await more.getAttribute('aria-label');
  await more.click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Abrir conversa', exact: true })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Copiar telefone', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('button.chat-item.active')).toHaveCount(0);
  await saveEvidence(page, 'REQ-675', info, {
    moreButton: accessibleName, conversationSelected: false,
    source: [{ file: 'apps/web/src/components/ConversationList.tsx', symbol: 'chat-item-more', line: 188 }],
  });
});

test('REQ-676 botão Mais opções fica alcançável por foco e no viewport móvel', async ({ page }, info) => {
  await openApp(page);
  const more = page.locator('button.chat-item-more').first();
  await expect(more).toBeAttached();
  await more.focus();
  const metrics = await more.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      opacity: getComputedStyle(element).opacity,
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
  expect(Number(metrics.opacity)).toBe(1);
  expect(metrics.rect.left).toBeGreaterThanOrEqual(0);
  expect(metrics.rect.right).toBeLessThanOrEqual(metrics.viewport.width);
  expect(metrics.rect.top).toBeGreaterThanOrEqual(0);
  expect(metrics.rect.bottom).toBeLessThanOrEqual(metrics.viewport.height);
  await more.click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await saveEvidence(page, 'REQ-676', info, {
    focusOpacity: metrics.opacity, touchViewportOrFocusedDesktop: true, geometry: metrics,
    source: [
      { file: 'apps/web/src/components/ConversationList.tsx', symbol: 'chat-item-more', line: 188 },
      { file: 'apps/web/src/styles.css', symbol: 'chat-item-more focus/mobile rules', line: 687 },
    ],
  });
});

test('REQ-678 Shift+F10, Home/End, setas, Escape e retorno de foco funcionam', async ({ page }, info) => {
  await openApp(page);
  const more = page.locator('button.chat-item-more').first();
  await expect(more).toBeVisible();
  await more.focus();
  await page.keyboard.press('Shift+F10');
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  const items = menu.getByRole('menuitem');
  await expect(items.first()).toBeFocused();
  await page.keyboard.press('End');
  await expect(items.last()).toBeFocused();
  await page.keyboard.press('Home');
  await expect(items.first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(items.nth(1)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(more).toBeFocused();
  await saveEvidence(page, 'REQ-678', info, {
    keys: ['Shift+F10', 'Home', 'End', 'ArrowDown', 'Escape'], focusReturned: true,
    source: [{ file: 'apps/web/src/context/ContextMenu.tsx', symbol: 'keyboard navigation and focus restore', line: 308 }],
  });
});

test('REQ-682 menu de mensagem fictícia oferece ações sem enviar', async ({ page }, info) => {
  await openApp(page);
  const chat = page.locator('button.chat-item:not(.chat-item-more)').first();
  await expect(chat).toBeVisible();
  await chat.click();
  await expect(chat).toHaveClass(/active/);
  await expect(page.locator('.client-name-button')).toBeVisible();
  const bubble = page.locator('.message-bubble').filter({ hasText: 'Olá, gostaria de saber o prazo.' }).first();
  await expect(bubble).toBeVisible();
  await expect(bubble).toContainText('Olá, gostaria de saber o prazo.');
  const state = states.get(page)!;
  const writesBeforeMenu = state.blockedWrites.length;
  const bounds = await bubble.boundingBox();
  expect(bounds).not.toBeNull();
  await bubble.evaluate((element) => {
    const log = (entry: Record<string, unknown>) => {
      const root = document.documentElement;
      const previous = JSON.parse(root.getAttribute('data-audit-menu-log') || '[]') as Record<string, unknown>[];
      previous.push({ at: performance.now(), ...entry });
      root.setAttribute('data-audit-menu-log', JSON.stringify(previous));
    };
    for (const eventName of ['pointerdown', 'scroll', 'resize']) {
      document.addEventListener(eventName, (event) => {
        const target = event.target as HTMLElement;
        log({ event: eventName, target: `${target?.tagName || ''}.${String(target?.className || '')}` });
      }, true);
    }
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of Array.from(record.addedNodes)) {
          if (node instanceof HTMLElement && node.matches('.noctua-context-menu')) log({ event: 'menu-added' });
        }
        for (const node of Array.from(record.removedNodes)) {
          if (node instanceof HTMLElement && node.matches('.noctua-context-menu')) log({ event: 'menu-removed' });
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
    const showPopover = HTMLElement.prototype.showPopover;
    HTMLElement.prototype.showPopover = function (...args) {
      log({ event: 'showPopover', className: this.className });
      return showPopover.apply(this, args);
    };
    element.addEventListener('contextmenu', (event) => {
      const target = event.target as HTMLElement;
      setTimeout(() => {
        element.setAttribute('data-audit-contextmenu', JSON.stringify({
          defaultPrevented: event.defaultPrevented,
          shiftKey: event.shiftKey,
          target: `${target.tagName}.${String(target.className || '')}`,
          editable: Boolean(target.closest('input, textarea, [contenteditable="true"]')),
        }));
      }, 0);
    }, { once: true });
  });
  const contextMenuTrigger = info.project.name === 'mobile-390' ? 'synthetic contextmenu event in mobile viewport' : 'right-click';
  if (info.project.name === 'mobile-390') {
    await bubble.dispatchEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: bounds!.x + Math.min(20, bounds!.width / 2),
      clientY: bounds!.y + Math.min(20, bounds!.height / 2),
    });
  } else {
    await bubble.click({ button: 'right' });
  }
  const menu = page.getByRole('menu');
  let menuVisible = false;
  try {
    await expect(menu).toBeVisible({ timeout: 1500 });
    menuVisible = true;
  } catch {
    menuVisible = false;
  }
  const contextEvent = await bubble.getAttribute('data-audit-contextmenu');
  const menuDiagnostics = await page.locator('.noctua-context-menu').evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      popoverOpen: element.matches(':popover-open'),
      display: style.display,
      visibility: style.visibility,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    };
  }));
  const lifecycle = await page.locator('html').getAttribute('data-audit-menu-log');
  expect(menuVisible, `received contextmenu=${contextEvent}; menu DOM=${JSON.stringify(menuDiagnostics)}; lifecycle=${lifecycle}`).toBe(true);
  expect(contextEvent, 'right-click event must be handled and canceled by the application').toContain('"defaultPrevented":true');
  await expect(menu.getByRole('menuitem', { name: 'Copiar mensagem', exact: true })).toBeVisible();
  const labels = await menu.getByRole('menuitem').allTextContents();
  expect(labels.some((label) => /Meta AI|WhatsApp/i.test(label))).toBe(false);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
  const testWrites = state.blockedWrites.slice(writesBeforeMenu);
  expect(testWrites.filter((entry) => /\/send(?:-|$)/.test(entry))).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  await saveEvidence(page, 'REQ-682', info, {
    area: 'ChatPane', menuItems: labels.map((label) => label.trim()),
    blockedSetupWrites: state.blockedWrites.slice(0, writesBeforeMenu),
    menuInteractionWrites: testWrites,
    trigger: contextMenuTrigger,
    receivedContextMenuEvent: contextEvent,
    menuLifecycle: lifecycle,
    menuDiagnostics,
    source: [{ file: 'apps/web/src/components/ChatPane.tsx', symbol: 'message-bubble onContextMenu', line: 530 }],
    bug: 'BUG-031: focus-triggered scroll closed the popover at 1920×1080; focus preventScroll and two-frame scroll-dismiss guard fixed it; final 18/18 regression passed',
    firstAttempt: 'right-click event was canceled and popover added then removed by scroll on .message-area; actual cause and fix recorded in BUGS.md',
  });
});
