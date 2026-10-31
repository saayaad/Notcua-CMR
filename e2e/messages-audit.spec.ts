import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const api = 'http://127.0.0.1:3340/api';
const evidenceRoot = resolve(process.cwd(), 'REVISAO', 'evidencias');
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

type Row = Record<string, any>;
type Library = { assets: Row[]; funnels: Row[]; macros: Row[]; pixKeys: Row[] };
type AuditState = {
  library: Library;
  preferences: Row;
  files: Map<string, Row>;
  macros: Map<string, Row>;
  requests: Row[];
  blockedExternal: string[];
  consoleErrors: string[];
  pageErrors: string[];
  notes: Row;
};
const states = new WeakMap<Page, AuditState>();

async function installAuditFixture(page: Page, preferences: Row = {}): Promise<AuditState> {
  // This GET reads only the already-running local audit fixture. All browser writes are intercepted below.
  const response = await page.request.get(`${api}/attendance/library`);
  expect(response.ok(), 'a biblioteca do servidor local deve responder').toBeTruthy();
  const library = (await response.json()) as Library;
  const sessionsResponse = await page.request.get(`${api}/whatsapp/sessions`);
  expect(sessionsResponse.ok(), 'as sessões fictícias locais devem responder').toBeTruthy();
  const sessions = await sessionsResponse.json();
  const state: AuditState = {
    library,
    preferences: {
      dockingEnabled: true,
      dockingLayout: '',
      toolsVisible: true,
      toolsDocked: true,
      toolsCompact: false,
      hudHiddenTools: [],
      attendanceCustomizationVersion: 3,
      pinnedResourceIds: [],
      pinnedButtonSettings: {},
      favoriteResourceIds: [],
      workbenchResourceOrder: [],
      showPinnedPreview: true,
      ...preferences,
    },
    files: new Map(),
    macros: new Map(),
    requests: [],
    blockedExternal: [],
    consoleErrors: [],
    pageErrors: [],
    notes: {},
  };
  states.set(page, state);
  page.on('console', (message) => {
    if (message.type() === 'error') state.consoleErrors.push(`${message.text()} @ ${message.location().url}`);
  });
  page.on('pageerror', (error) => state.pageErrors.push(error.message));
  await page.addInitScript(() => localStorage.removeItem('noctua-preferences:local'));

  // Block external HTTPS/production traffic without wrapping Socket.IO polling, then intercept local API writes only.
  await page.route('https://**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    state.blockedExternal.push(url.origin);
    return route.abort('blockedbyclient');
  });
  await page.route('http://notcua.vercel.app/**', async (route) => {
    const url = new URL(route.request().url());
    state.blockedExternal.push(url.origin);
    return route.abort('blockedbyclient');
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.port === '3340' && request.method() !== 'GET') {
      let body: unknown;
      try { body = request.postDataJSON(); } catch { body = request.postData(); }
      state.requests.push({ method: request.method(), path: url.pathname, body });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ saved: true, id: 'audit-intercepted' }) });
    }
    return route.continue();
  });
  await page.route('**/api/operations/settings/preferences', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: state.preferences });
    if (route.request().method() === 'PUT') {
      state.preferences = { ...state.preferences, ...(route.request().postDataJSON() as Row) };
      state.requests.push({ method: 'PUT', path: '/api/operations/settings/preferences', body: state.preferences });
      return route.fulfill({ json: { saved: true } });
    }
    return route.fallback();
  });
  await page.route('**/api/attendance/library', (route) => route.fulfill({ json: state.library }));
  await page.route('**/api/whatsapp/sessions**', async (route) => {
    if (new URL(route.request().url()).pathname !== '/api/whatsapp/sessions') return route.fallback();
    return route.fulfill({ json: { ...sessions, items: sessions.items.map((item: Row) => ({ ...item, status: 'CONNECTED' })) } });
  });
  await page.route('**/api/whatsapp/sessions/audit-session/labels', (route) => route.fulfill({ json: { items: [
    { id: 'audit-label-warm', name: 'Lead morno' },
    { id: 'audit-label-customer', name: 'Cliente teste' },
  ] } }));
  await page.route('**/api/attendance/files', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = route.request().postDataJSON() as Row;
    const id = `audit-ui-file-${state.files.size + 1}`;
    const file = { id, filename: body.filename, mimeType: body.mimeType, byteLength: String(body.base64 ?? '').length };
    state.files.set(id, file);
    state.requests.push({ method: 'POST', path: '/api/attendance/files', body: { filename: body.filename, mimeType: body.mimeType, voice: body.voice } });
    return route.fulfill({ status: 201, json: { id } });
  });
  await page.route('**/api/attendance/assets', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = route.request().postDataJSON() as Row;
    const id = `audit-ui-asset-${state.library.assets.length + 1}`;
    const file = body.fileId ? state.files.get(body.fileId) ?? { id: body.fileId, filename: 'fixture.bin', mimeType: 'application/octet-stream', byteLength: 0 } : null;
    const asset = { id, kind: body.kind, name: body.name, text: body.text ?? null, caption: body.caption ?? null, fileId: body.fileId ?? null, file, isFavorite: false, isPtt: Boolean(body.isPtt), isPtv: Boolean(body.isPtv), asViewOnce: Boolean(body.asViewOnce) };
    state.library.assets.push(asset);
    state.requests.push({ method: 'POST', path: '/api/attendance/assets', body });
    return route.fulfill({ status: 201, json: asset });
  });
  await page.route('**/api/attendance/assets/*', async (route) => {
    const url = new URL(route.request().url());
    const id = decodeURIComponent(url.pathname.split('/').at(-1) ?? '');
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as Row;
      const index = state.library.assets.findIndex((asset) => asset.id === id);
      if (index >= 0) state.library.assets[index] = { ...state.library.assets[index], ...body, file: state.library.assets[index]?.file };
      state.requests.push({ method: 'PUT', path: url.pathname, body });
      return route.fulfill({ json: state.library.assets[index] ?? { id, ...body } });
    }
    if (route.request().method() === 'DELETE') {
      state.library.assets = state.library.assets.filter((asset) => asset.id !== id);
      state.requests.push({ method: 'DELETE', path: url.pathname });
      return route.fulfill({ json: { deleted: true } });
    }
    return route.fallback();
  });
  await page.route('**/api/attendance/pix-keys', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = route.request().postDataJSON() as Row;
    const key = { id: `audit-pix-${state.library.pixKeys.length + 1}`, ...body };
    state.library.pixKeys.push(key);
    state.requests.push({ method: 'POST', path: '/api/attendance/pix-keys', body });
    return route.fulfill({ status: 201, json: key });
  });
  await page.route('**/api/attendance/pix-preview', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = route.request().postDataJSON() as Row;
    state.requests.push({ method: 'POST', path: '/api/attendance/pix-preview', body });
    const key = state.library.pixKeys.find((item) => item.id === body.keyId);
    return route.fulfill({ json: { payload: '00020101021226890014br.gov.bcb.pix.fixture', qrDataUrl: `data:image/png;base64,${png.toString('base64')}`, key: key?.value ?? '' } });
  });
  await page.route('**/api/attendance/funnels', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = route.request().postDataJSON() as Row;
    const id = 'audit-ui-funnel';
    const funnel = makeFunnel(state, id, body);
    state.library.funnels = [...state.library.funnels.filter((item) => item.id !== id), funnel];
    state.requests.push({ method: 'POST', path: '/api/attendance/funnels', body });
    return route.fulfill({ status: 201, json: funnel });
  });
  await page.route('**/api/attendance/funnels/*', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'PUT') return route.fallback();
    const body = route.request().postDataJSON() as Row;
    const id = decodeURIComponent(url.pathname.split('/').at(-1) ?? '');
    const funnel = makeFunnel(state, id, body);
    state.library.funnels = [...state.library.funnels.filter((item) => item.id !== id), funnel];
    state.requests.push({ method: 'PUT', path: url.pathname, body });
    return route.fulfill({ json: funnel });
  });
  await page.route('**/api/operations/macros', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = route.request().postDataJSON() as Row;
    const macro = { id: 'audit-ui-macro', name: body.name, text: body.actions.find((action: Row) => action.type === 'TEXT')?.text ?? '', actions: body.actions, _count: { actions: body.actions.length } };
    state.macros.set(macro.id, macro);
    state.library.macros = [...state.library.macros.filter((item) => item.id !== macro.id), macro];
    state.requests.push({ method: 'POST', path: '/api/operations/macros', body });
    return route.fulfill({ status: 201, json: macro });
  });
  await page.route('**/api/operations/macros/*', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1) ?? '';
    if (route.request().method() === 'GET') return route.fulfill({ json: state.macros.get(id) ?? { name: '', actions: [] } });
    return route.fallback();
  });
  await page.route('**/api/attendance/sessions/*/conversations/*/sequences', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { items: [] } });
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Row;
      state.requests.push({ method: 'POST', path: new URL(route.request().url()).pathname, body });
      return route.fulfill({ status: 201, json: { id: 'audit-sequence-run', status: 'QUEUED', ...body } });
    }
    return route.fallback();
  });
  return state;
}

function makeFunnel(state: AuditState, id: string, body: Row) {
  const items = (body.itemsSequence as Row[]).map((step, index) => {
    const asset = state.library.assets.find((item) => item.id === step.itemId);
    return { id: `audit-ui-funnel-item-${index + 1}`, funnelId: id, assetId: step.itemId, position: index, delayBeforeSendMs: step.delayBeforeSend, asset: { name: asset?.name ?? 'Recurso de teste', kind: asset?.kind ?? 'MESSAGE' } };
  });
  return { id, name: body.name, metadata: { source: 'AUDIT_UI_FIXTURE' }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), items };
}

async function openApp(page: Page) {
  await page.goto('/atendimento');
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 });
}
async function openConversation(page: Page) {
  await openApp(page);
  const first = page.locator('button.chat-item:not(.chat-item-more)').first();
  if (!(await page.locator('.client-name-button').isVisible().catch(() => false))) await first.click();
  await expect(page.locator('.client-name-button')).toBeVisible();
}
async function returnToConversation(page: Page) {
  await page.locator('.navigation button[aria-label="Atendimento"]').click();
  await expect(page.locator('.app-shell')).toBeVisible();
  if (!(await page.locator('.client-name-button').isVisible().catch(() => false)))
    await page.locator('button.chat-item:not(.chat-item-more)').first().click();
  await expect(page.locator('.client-name-button')).toBeVisible();
}
async function ensureToolsOpen(page: Page) {
  const tools = page.getByLabel('Ferramentas de atendimento');
  if (await tools.isVisible()) return tools;
  const globalToggle = page.getByRole('button', { name: 'Mostrar biblioteca lateral' });
  if (await globalToggle.isVisible()) await globalToggle.click();
  else {
    await page.locator('.chat-more-actions summary').click();
    await page.getByRole('button', { name: 'Mostrar mensagens fixadas', exact: true }).click();
  }
  await expect(tools).toBeVisible();
  return tools;
}
async function openLibrary(page: Page) {
  await openApp(page);
  await page.locator('.navigation button[aria-label="Biblioteca"]').click();
  await expect(page.getByRole('heading', { name: 'Biblioteca', exact: true })).toBeVisible();
}
async function chooseOption(page: Page, control: Locator, name: string, exact = true) {
  await control.click();
  await page.getByRole('option', { name, exact }).click();
}
async function capture(page: Page, ids: string[], info: TestInfo, result: Row) {
  const suffix = info.project.name.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
  const state = states.get(page)!;
  for (const id of ids) {
    const directory = resolve(evidenceRoot, id);
    await mkdir(directory, { recursive: true });
    await page.screenshot({ path: resolve(directory, `messages-${suffix}.png`), fullPage: true, animations: 'disabled' });
    await writeFile(resolve(directory, `messages-${suffix}.json`), JSON.stringify({ req: id, result: 'APROVADO', project: info.project.name, viewport: page.viewportSize(), url: page.url(), consoleErrors: state.consoleErrors, pageErrors: state.pageErrors, blockedExternal: [...new Set(state.blockedExternal)], interceptedWrites: state.requests, ...result }, null, 2), 'utf8');
  }
}

test.afterEach(async ({ page }, info) => {
  const state = states.get(page);
  if (!state) return;
  const ids = [...new Set(info.title.match(/REQ-\d+/g) ?? [])];
  const suffix = info.project.name.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
  for (const id of ids) {
    const directory = resolve(evidenceRoot, id);
    await mkdir(directory, { recursive: true });
    const result = info.status === 'passed' && state.pageErrors.length === 0 ? 'APROVADO' : 'FALHOU';
    const path = resolve(directory, `audit-${suffix}.json`);
    await writeFile(path, JSON.stringify({ req: id, result, project: info.project.name, viewport: page.viewportSize(), url: page.isClosed() ? '' : page.url(), consoleErrors: state.consoleErrors, pageErrors: state.pageErrors, blockedExternal: [...new Set(state.blockedExternal)], interceptedWrites: state.requests, notes: state.notes, failures: info.errors.map((error) => error.message) }, null, 2), 'utf8');
  }
  if (info.status === 'passed') expect(state.pageErrors, 'erros de página no teste visual').toEqual([]);
});

test('REQ-024 lista, conversa e ferramentas permanecem acessíveis no layout responsivo', async ({ page }, info) => {
  const state = await installAuditFixture(page);
  await openApp(page);
  if ((page.viewportSize()?.width ?? 1366) <= 480) {
    await expect(page.locator('.inbox-layout')).toBeVisible();
    await expect(page.locator('.noctua-dock-workspace')).toHaveCount(0);
    await page.locator('button.chat-item:not(.chat-item-more)').first().click();
    await expect(page.locator('.chat-pane')).toBeVisible();
  } else {
    await expect(page.locator('.noctua-dock-workspace')).toBeVisible();
    for (const label of ['Conversas', 'Conversa', 'Biblioteca e fixados'])
      await expect(page.locator('.noctua-dock .dv-tab').filter({ hasText: new RegExp(`^${label}$`) }).first()).toBeVisible();
  }
  await openConversation(page);
  const tools = await ensureToolsOpen(page);
  await expect(tools).toBeVisible();
  state.notes = { listConversationAndToolsAccessible: true, responsiveFallback: (page.viewportSize()?.width ?? 1366) <= 480, dockTabs: await page.locator('.noctua-dock .dv-tab').allTextContents() };
  await capture(page, ['REQ-024'], info, state.notes);
});

test('REQ-027 exibe marcadores nativos no texto da conversa; REQ-028 mantém #nome para personalização no servidor', async ({ page }, info) => {
  const state = await installAuditFixture(page);
  const formatted = '*Negrito* _Itálico_ ~Riscado~ ```Código```';
  await page.route('**/api/attendance/sessions/*/conversations/*/messages*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const sample = { ...(body.items[0] ?? {}), id: 'audit-format-message', text: formatted, caption: null, direction: 'INBOUND', status: 'DELIVERED', type: 'conversation', sentAt: new Date().toISOString(), isInternalNote: false };
    return route.fulfill({ response, json: { ...body, items: [...body.items, sample], total: body.total + 1 } });
  });
  await openConversation(page);
  const bubble = page.locator('.message-text').filter({ hasText: 'Negrito' }).last();
  await expect(bubble.locator('strong')).toHaveText('Negrito');
  await expect(bubble.locator('em')).toHaveText('Itálico');
  await expect(bubble.locator('s')).toHaveText('Riscado');
  await expect(bubble.locator('code')).toHaveText('Código');
  await capture(page, ['REQ-027'], info, { formatted, renderedTags: ['strong', 'em', 's', 'code'] });
  state.notes = { formattingRendered: true, req028ServerProof: 'apps/server/test/attendance.test.ts testa a substituição pelo nome do contato com socket fictício; texto da interface mantém o marcador até a API local.' };
  await capture(page, ['REQ-028'], info, state.notes);
});

test('REQ-030/REQ-031/REQ-032/REQ-033/REQ-034 serializa áudio, imagem e vídeo com legenda e flags corretas', async ({ page }, info) => {
  const state = await installAuditFixture(page);
  await openConversation(page);
  const upload = page.locator('input[type="file"].sr-only');
  const sends: Row[] = [];
  await page.route('**/api/attendance/sessions/*/conversations/*/send', async (route) => {
    const body = route.request().postDataJSON() as Row;
    sends.push(body);
    state.requests.push({ method: 'POST', path: new URL(route.request().url()).pathname, body });
    return route.fulfill({ json: { id: `audit-send-${sends.length}`, status: 'SENT' } });
  });
  await upload.setInputFiles({ name: 'audio-ficticio.ogg', mimeType: 'audio/ogg', buffer: Buffer.from('OggS fixture') });
  const audioDialog = page.getByRole('dialog', { name: 'Revisar áudio' });
  await expect(audioDialog).toBeVisible();
  await expect(audioDialog.getByLabel('Visualização única')).toBeVisible();
  await audioDialog.getByLabel('Visualização única').check();
  await audioDialog.getByRole('button', { name: 'Enviar áudio' }).click();
  await expect(audioDialog).toHaveCount(0);
  expect(sends.at(-1)).toMatchObject({ kind: 'audio', isPtt: true, asViewOnce: true });

  await upload.setInputFiles({ name: 'imagem-ficticia.png', mimeType: 'image/png', buffer: png });
  const imageDialog = page.getByRole('dialog', { name: 'Enviar arquivo' });
  await imageDialog.getByLabel('Legenda').fill('Imagem de exemplo #nome');
  await imageDialog.getByLabel('Visualização única').check();
  await imageDialog.getByRole('button', { name: 'Enviar arquivo' }).click();
  await expect(imageDialog).toHaveCount(0);
  expect(sends.at(-1)).toMatchObject({ kind: 'image', caption: 'Imagem de exemplo #nome', asViewOnce: true });

  await upload.setInputFiles({ name: 'video-ficticio.mp4', mimeType: 'video/mp4', buffer: Buffer.from('MP4 fixture bytes') });
  const videoDialog = page.getByRole('dialog', { name: 'Enviar arquivo' });
  await videoDialog.getByLabel('Legenda').fill('Vídeo de exemplo #nome');
  await videoDialog.getByLabel('Enviar como recado circular (MP4)').check();
  await videoDialog.getByLabel('Visualização única').check();
  await videoDialog.getByRole('button', { name: 'Enviar arquivo' }).click();
  await expect(videoDialog).toHaveCount(0);
  expect(sends.at(-1)).toMatchObject({ kind: 'video', caption: 'Vídeo de exemplo #nome', isPtv: true, asViewOnce: true });
  state.notes = { sends, filesUploaded: state.files.size, connector: 'interceptado e fictício', noExternalSend: true };
  await capture(page, ['REQ-030', 'REQ-031', 'REQ-032', 'REQ-033', 'REQ-034'], info, state.notes);
});

test('REQ-035/REQ-036/REQ-037/REQ-038 cadastra chave aleatória fictícia e prepara PIX, comprovante e áudio sem envio externo', async ({ page }, info) => {
  const keyValue = '123e4567-e89b-12d3-a456-426614174000';
  const state = await installAuditFixture(page, {
    pinnedResourceIds: ['audit-pix-existing'],
    pinnedButtonSettings: { 'audit-pix-existing': { preview: 'always' } },
    showPinnedPreview: true,
  });
  const existingKey = { id: 'audit-pix-existing', name: 'Chave fictícia de teste', value: keyValue, type: 'RANDOM', merchantName: 'Recebedor teste', merchantCity: 'São Paulo' };
  state.library.pixKeys.push(existingKey);
  await openLibrary(page);
  await page.getByRole('button', { name: 'PIX', exact: true }).click();
  await page.getByRole('button', { name: 'Cadastrar chave', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Cadastrar chave PIX' });
  await expect(editor).toContainText('A chave aleatória também deve ter sido gerada pelo banco');
  await editor.getByLabel('Nome de identificação').fill('Chave aleatória de auditoria');
  await editor.getByLabel('Chave cadastrada no banco').fill('550e8400-e29b-41d4-a716-446655440000');
  await editor.getByLabel('Nome do recebedor').fill('Recebedor fixture');
  await editor.getByLabel('Cidade').fill('São Paulo');
  await editor.getByRole('button', { name: 'Salvar chave' }).click();
  const createdKey = state.library.pixKeys.find((item) => item.name === 'Chave aleatória de auditoria');
  expect(createdKey?.type).toBe('RANDOM');
  await page.reload();
  await page.locator('.navigation button[aria-label="Biblioteca"]').click();
  await page.getByRole('button', { name: 'PIX', exact: true }).click();
  await expect(page.locator('article.resource-card').filter({ hasText: 'Chave aleatória de auditoria' })).toContainText('Chave aleatória');

  await openConversation(page);
  const tools = await ensureToolsOpen(page);
  await tools.getByRole('button', { name: 'Fixados', exact: true }).click();
  const pinned = tools.locator('.pinned-message-card').filter({ hasText: existingKey.name });
  await expect(pinned).toBeVisible();
  await pinned.getByRole('button', { name: 'Enviar', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Enviar PIX' });
  await expect(modal.getByRole('img', { name: 'Prévia do QR Code PIX' })).toBeVisible();
  await expect(modal).toContainText('PIX pronto para copiar');
  const sends = () => state.requests.filter((item) => item.path.endsWith('/send'));
  await modal.getByLabel('Incluir pedido de comprovante').uncheck();
  await modal.getByRole('button', { name: 'Enviar só a chave' }).click();
  await expect(modal).toHaveCount(0);
  expect(sends().at(-1)?.body.text).toContain(keyValue);
  expect(sends().at(-1)?.body.text).not.toContain('comprovante');

  await pinned.getByRole('button', { name: 'Enviar', exact: true }).click();
  const secondModal = page.getByRole('dialog', { name: 'Enviar PIX' });
  await secondModal.getByLabel('Valor em reais (opcional)').fill('150,00');
  await expect(secondModal.getByRole('img', { name: 'Prévia do QR Code PIX' })).toBeVisible();
  const audio = state.library.assets.find((item) => item.kind === 'AUDIO');
  expect(audio).toBeTruthy();
  await chooseOption(page, secondModal.getByRole('combobox', { name: 'Áudio de solicitação (opcional)' }), audio.name);
  await expect(secondModal.getByLabel('Incluir pedido de comprovante')).toBeChecked();
  await secondModal.getByRole('button', { name: 'Enviar Copia e Cola' }).click();
  await expect(secondModal).toHaveCount(0);
  const copyPaste = sends().at(-1)?.body.text as string;
  expect(copyPaste).toContain('PIX Copia e Cola');
  expect(secondModal).toHaveCount(0);
  expect(state.requests.filter((item) => item.path.endsWith('/pix-preview')).at(-1)?.body).toMatchObject({ keyId: existingKey.id, amountInCents: 15000 });
  expect(copyPaste).toContain('comprovante');
  expect(state.requests.some((item) => item.path.endsWith('/send-asset') && item.body.assetId === audio.id)).toBeTruthy();
  state.notes = { randomKeyWasSuppliedAsFictitiousBankKey: true, previewGeneratedLocally: true, amountCents: 15000, keyOnlyCopyPasteAndReceiptAudioComposed: true, allSendRoutesIntercepted: true };
  await capture(page, ['REQ-035', 'REQ-036', 'REQ-037', 'REQ-038'], info, state.notes);
});

test('REQ-040/REQ-041/REQ-042 cria, lista, edita, recarrega e exclui áudio, mídia e documento na Biblioteca', async ({ page }, info) => {
  const state = await installAuditFixture(page);
  const resources = [
    { req: 'REQ-040', tab: 'Áudios', kind: 'AUDIO', name: 'Áudio criado pela auditoria', file: { name: 'audit.ogg', mimeType: 'audio/ogg', buffer: Buffer.from('OggS local fixture') } },
    { req: 'REQ-041', tab: 'Mídias', kind: 'MEDIA', name: 'Mídia criada pela auditoria', file: { name: 'audit.png', mimeType: 'image/png', buffer: png } },
    { req: 'REQ-042', tab: 'Documentos', kind: 'DOCUMENT', name: 'Documento criado pela auditoria', file: { name: 'audit.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 fixture') } },
  ];
  for (const resource of resources) {
    await openLibrary(page);
    await page.getByRole('button', { name: resource.tab, exact: true }).click();
    await page.getByRole('button', { name: 'Nova resposta', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Nova resposta rápida' });
    await editor.getByLabel('Nome', { exact: true }).fill(resource.name);
    await editor.locator('input[type="file"]').setInputFiles(resource.file);
    if (resource.kind !== 'AUDIO') await editor.getByLabel('Legenda').fill(`Legenda fictícia ${resource.req}`);
    await editor.getByRole('button', { name: 'Salvar resposta' }).click();
    const card = page.locator('article.resource-card').filter({ hasText: resource.name });
    await expect(card).toBeVisible();
    await page.reload();
    await page.locator('.navigation button[aria-label="Biblioteca"]').click();
    await page.getByRole('button', { name: resource.tab, exact: true }).click();
    const reloaded = page.locator('article.resource-card').filter({ hasText: resource.name });
    await expect(reloaded).toBeVisible();
    await reloaded.getByRole('button', { name: `Editar ${resource.name}`, exact: true }).click();
    const edit = page.getByRole('dialog', { name: 'Editar resposta' });
    const editedCaption = `Legenda editada ${resource.req}`;
    if (resource.kind !== 'AUDIO') await edit.getByLabel('Legenda').fill(editedCaption);
    await edit.getByRole('button', { name: 'Salvar resposta' }).click();
    await page.reload();
    await page.locator('.navigation button[aria-label="Biblioteca"]').click();
    await page.getByRole('button', { name: resource.tab, exact: true }).click();
    const afterEdit = page.locator('article.resource-card').filter({ hasText: resource.name });
    await expect(afterEdit).toBeVisible();
    if (resource.kind !== 'AUDIO') await expect(afterEdit).toContainText(editedCaption);
    await afterEdit.getByRole('button', { name: `Excluir ${resource.name}`, exact: true }).click();
    const confirm = page.getByRole('dialog', { name: 'Excluir recurso?' });
    await confirm.getByRole('button', { name: 'Confirmar exclusão' }).click();
    await expect(page.locator('article.resource-card').filter({ hasText: resource.name })).toHaveCount(0);
    await capture(page, [resource.req], info, { kind: resource.kind, createdEditedAndReloaded: true, deletedOnlyFixture: resource.name, writesIntercepted: true });
  }
  state.notes = { resourceTypes: resources.map(({ req, kind }) => ({ req, kind })), created: 3, edited: 3, deleted: 3, localApiMutationsIntercepted: true };
});

test('REQ-044/REQ-045/REQ-046/REQ-047/REQ-048/REQ-052 cria macro encadeada, configura espera, usa mídia e etiquetas e inicia pela Biblioteca', async ({ page }, info) => {
  const state = await installAuditFixture(page, { dockingEnabled: false });
  const macroName = `Macro auditada ${info.project.name}`;
  const audio = state.library.assets.find((item) => item.kind === 'AUDIO');
  expect(audio).toBeTruthy();
  await openConversation(page);
  const tools = await ensureToolsOpen(page);
  await tools.locator('.workbench-create summary').click();
  await tools.locator('.workbench-create').getByRole('button', { name: 'Macros', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Criar macro de atendimento' });
  await editor.getByLabel('Nome da macro').fill(macroName);
  await editor.locator('.macro-action').nth(0).getByLabel('Mensagem').fill('Olá, #nome! *Mensagem fictícia*.');
  await editor.getByRole('button', { name: 'Adicionar ação' }).click();
  const wait = editor.locator('.macro-action').nth(1);
  await wait.locator('details').filter({ hasText: 'Temporizadores' }).locator('summary').click();
  await wait.getByRole('button', { name: 'Esperar e mostrar presença', exact: true }).click();
  await wait.getByLabel('Esperar antes desta ação (s)').fill('2.5');
  await chooseOption(page, wait.getByRole('combobox', { name: 'Durante a espera' }), 'Mostrar gravando áudio');

  await editor.getByRole('button', { name: 'Adicionar ação' }).click();
  const addLabel = editor.locator('.macro-action').nth(2);
  await addLabel.locator('details').filter({ hasText: 'Etiquetas' }).locator('summary').click();
  await addLabel.getByRole('button', { name: 'Adicionar etiqueta', exact: true }).click();
  await chooseOption(page, addLabel.getByRole('combobox', { name: 'Etiqueta' }), 'Lead morno');

  await editor.getByRole('button', { name: 'Adicionar ação' }).click();
  const removeLabel = editor.locator('.macro-action').nth(3);
  await removeLabel.locator('details').filter({ hasText: 'Etiquetas' }).locator('summary').click();
  await removeLabel.getByRole('button', { name: 'Remover etiqueta', exact: true }).click();
  await chooseOption(page, removeLabel.getByRole('combobox', { name: 'Etiqueta' }), 'Cliente teste');

  await editor.getByRole('button', { name: 'Adicionar ação' }).click();
  const media = editor.locator('.macro-action').nth(4);
  await media.locator('details').filter({ hasText: 'Enviar mensagem' }).locator('summary').click();
  await media.getByRole('button', { name: 'Imagem, vídeo, áudio ou documento', exact: true }).click();
  await chooseOption(page, media.getByRole('combobox', { name: 'Categoria' }), 'Áudio');
  await chooseOption(page, media.getByRole('combobox', { name: 'Resposta' }), audio.name, false);
  await editor.getByRole('button', { name: 'Salvar macro' }).click();
  const saved = state.requests.find((request) => request.path === '/api/operations/macros');
  expect(saved).toBeTruthy();
  const actions = (saved!.body as Row).actions as Row[];
  expect(actions.map((action) => action.type)).toEqual(['TEXT', 'UTILITY', 'ADD_LABEL', 'REMOVE_LABEL', 'ASSET']);
  expect(actions[1]).toMatchObject({ command: 'WAIT', delayMs: 2500, presence: 'recording' });
  expect(actions[2].labelId).toBe('audit-label-warm');
  expect(actions[3].labelId).toBe('audit-label-customer');
  expect(actions[4].assetId).toBe(audio.id);
  await tools.getByRole('button', { name: 'Macros', exact: true }).click();
  await tools.getByRole('button', { name: macroName, exact: true }).click();
  await page.getByRole('dialog', { name: macroName }).getByRole('button', { name: 'Confirmar início da sequência' }).click();
  const launch = state.requests.find((request) => request.path.endsWith('/sequences') && request.method === 'POST');
  expect(launch?.body).toMatchObject({ kind: 'MACRO', sourceId: 'audit-ui-macro' });

  await page.reload();
  await page.locator('.navigation button[aria-label="Biblioteca"]').click();
  await page.getByRole('button', { name: 'Macros', exact: true }).click();
  await expect(page.locator('article.resource-card').filter({ hasText: macroName })).toBeVisible();
  state.notes = { macroName, actionTypes: actions.map((action) => action.type), waitMs: actions[1].delayMs, presence: actions[1].presence, audioAssetId: audio.id, persistedAfterReload: true, launchedByUserAction: true, launchIntercepted: true, serverProof: 'operations.test.ts e attendance.test.ts usam conector fictício e SQLite temporário para execução da sequência e presença.' };
  await capture(page, ['REQ-044', 'REQ-045', 'REQ-046', 'REQ-047', 'REQ-048', 'REQ-052'], info, state.notes);
});

test('REQ-049/REQ-050/REQ-051/REQ-052/REQ-053 cria funil multimídia ordenado com atrasos e inicia em um clique', async ({ page }, info) => {
  const state = await installAuditFixture(page, { dockingEnabled: false });
  const text = state.library.assets.find((item) => item.kind === 'MESSAGE')!;
  const audio = state.library.assets.find((item) => item.kind === 'AUDIO')!;
  const media = state.library.assets.find((item) => item.kind === 'MEDIA')!;
  const funnelName = `Funil auditado ${info.project.name}`;
  await openConversation(page);
  const tools = await ensureToolsOpen(page);
  await tools.locator('.workbench-create summary').click();
  await tools.locator('.workbench-create').getByRole('button', { name: 'Funis', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Criar funil de atendimento' });
  await editor.getByLabel('Nome do funil').fill(funnelName);
  const stepOne = editor.locator('.funnel-step').nth(0);
  await chooseOption(page, stepOne.getByRole('combobox', { name: 'Categoria' }), 'Texto');
  await chooseOption(page, stepOne.getByRole('combobox', { name: 'Resposta da etapa' }), text.name);
  await stepOne.getByLabel('Espera (s)').fill('0');
  await editor.getByRole('button', { name: 'Adicionar etapa' }).click();
  const stepTwo = editor.locator('.funnel-step').nth(1);
  await chooseOption(page, stepTwo.getByRole('combobox', { name: 'Categoria' }), 'Áudio');
  await chooseOption(page, stepTwo.getByRole('combobox', { name: 'Resposta da etapa' }), audio.name, false);
  await stepTwo.getByLabel('Espera (s)').fill('10');
  await editor.getByRole('button', { name: 'Adicionar etapa' }).click();
  const stepThree = editor.locator('.funnel-step').nth(2);
  await chooseOption(page, stepThree.getByRole('combobox', { name: 'Categoria' }), 'Imagem / vídeo');
  await chooseOption(page, stepThree.getByRole('combobox', { name: 'Resposta da etapa' }), media.name, false);
  await stepThree.getByLabel('Espera (s)').fill('3.5');
  await stepThree.getByRole('button', { name: 'Mover etapa para cima' }).click();
  await editor.getByRole('button', { name: 'Salvar funil' }).click();
  const saved = state.requests.find((request) => request.path === '/api/attendance/funnels');
  expect(saved).toBeTruthy();
  const sequence = (saved!.body as Row).itemsSequence as Row[];
  expect(sequence.map((step) => step.itemId)).toEqual([text.id, media.id, audio.id]);
  expect(sequence.map((step) => step.delayBeforeSend)).toEqual([0, 3500, 10000]);
  await tools.getByRole('button', { name: 'Funis', exact: true }).click();
  await tools.getByRole('button', { name: funnelName, exact: true }).click();
  await page.getByRole('dialog', { name: funnelName }).getByRole('button', { name: 'Confirmar início da sequência' }).click();
  const launch = state.requests.find((request) => request.path.endsWith('/sequences') && request.method === 'POST');
  expect(launch?.body).toMatchObject({ kind: 'FUNNEL', sourceId: 'audit-ui-funnel' });

  await page.reload();
  await page.locator('.navigation button[aria-label="Biblioteca"]').click();
  await page.getByRole('button', { name: 'Funis', exact: true }).click();
  await expect(page.locator('article.resource-card').filter({ hasText: funnelName })).toContainText('3 etapas');
  state.notes = { orderedAssetIds: sequence.map((step) => step.itemId), delaysMs: sequence.map((step) => step.delayBeforeSend), persistedAfterReload: true, launchedBySingleConfirmation: true, launchIntercepted: true, presenceDuringDelayServerProof: 'attendance.test.ts funil multimídia: conector fictício recebeu recording durante a espera da etapa de áudio.' };
  await capture(page, ['REQ-049', 'REQ-050', 'REQ-051', 'REQ-052', 'REQ-053'], info, state.notes);
});
