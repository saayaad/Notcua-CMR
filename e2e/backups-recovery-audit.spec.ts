import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const evidenceRoot = resolve(process.cwd(), 'REVISAO', 'evidencias');
const apiHost = '127.0.0.1:3340';
const qr = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const conversationFixture = {
  id: 'audit-req096-conversation', sessionId: 'audit-req094-connection', contactId: 'audit-req096-contact',
  status: 'OPEN', unreadCount: 0, lastMessageAt: '2026-10-31T11:00:00.000Z', assignedTo: null,
  contact: { id: 'audit-req096-contact', name: 'Contato Fictício', phoneNumber: '5511999000096', profilePicture: null, isGroup: false, metadata: {}, labels: [] },
  messages: [{ text: 'Mensagem de teste sem envio.', caption: null, type: 'TEXT', direction: 'INBOUND', status: 'READ' }],
};

type BackupReport = {
  duplicate: boolean;
  format: string;
  counts: { assets: number; files: number; labels: number; contacts: number; macros: number; funnels: number; flows: number };
  warnings: string[];
};
type AuditState = {
  writes: { method: string; path: string; body: string }[];
  forbiddenWrites: string[];
  blockedExternal: string[];
  consoleErrors: string[];
  pageErrors: string[];
  metrics: Record<string, unknown>;
  uploadName: string;
  uploadSize: number;
  uploadText: string;
  uploadObject: Record<string, unknown> | null;
  report: BackupReport | null;
  backupSettings: { automatic: boolean; time: string };
  systemBackups: { id: string; filename: string; createdAt: string }[];
  connectionStatus: string;
};
const states = new WeakMap<Page, AuditState>();

function stateOf(page: Page) { return states.get(page)!; }

function arraySize(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return Object.keys(value).length;
  return 0;
}

function buildReport(payload: Record<string, unknown>): BackupReport {
  const wrapper = payload.ZV_backup && typeof payload.ZV_backup === 'object'
    ? payload.ZV_backup as Record<string, unknown>
    : payload;
  const macroOnly = Object.keys(wrapper).every((key) => ['respostasRapidasAcao', 'format', 'version'].includes(key));
  const sutofly = 'agendamentosNaoDisparados' in wrapper || 'respostasRapidas' in wrapper || 'fluxo' in wrapper;
  const objects = wrapper.objectsList;
  return {
    duplicate: false,
    format: sutofly ? 'Sutofly' : macroOnly ? 'respostasRapidasAcao' : 'ZV_backup',
    counts: {
      assets: ['messages', 'audios', 'medias', 'docs'].reduce((sum, key) => sum + arraySize(wrapper[key]), 0),
      files: arraySize(objects),
      labels: arraySize(wrapper.labels),
      contacts: arraySize(wrapper.contacts),
      macros: arraySize(wrapper.respostasRapidasAcao),
      funnels: arraySize(wrapper.funnels),
      flows: arraySize(wrapper.flows),
    },
    warnings: [],
  };
}

async function installIsolation(page: Page) {
  const state: AuditState = {
    writes: [], forbiddenWrites: [], blockedExternal: [], consoleErrors: [], pageErrors: [], metrics: {},
    uploadName: '', uploadSize: 0, uploadText: '', uploadObject: null, report: null,
    backupSettings: { automatic: false, time: '03:00' },
    systemBackups: [{ id: 'audit-zip', filename: 'backup-ficticio-audit', createdAt: '2026-10-31T12:00:00.000Z' }],
    connectionStatus: 'DISCONNECTED',
  };
  states.set(page, state);
  page.on('console', (message) => {
    if (message.type() === 'error') state.consoleErrors.push(`${message.text()} @ ${message.location().url}`);
  });
  page.on('pageerror', (error) => state.pageErrors.push(error.message));
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const local = ['127.0.0.1', 'localhost'].includes(url.hostname);
    if (!local) {
      state.blockedExternal.push(url.origin);
      return route.abort('blockedbyclient');
    }
    if (url.host !== apiHost || !url.pathname.startsWith('/api/')) return route.fallback();
    const method = request.method();
    const path = url.pathname;

    if (method === 'OPTIONS') return route.fallback();
    if (method === 'GET' && path === '/api/operations/system-backups')
      return route.fulfill({ json: { items: state.systemBackups, ...state.backupSettings } });
    if (method === 'GET' && path.startsWith('/api/operations/system-backups/') && path.endsWith('/download'))
      return route.fulfill({ status: 200, contentType: 'application/zip', body: Buffer.from('PK\x03\x04audit-fixture') });
    if (method === 'GET' && path === '/api/backups/imports')
      return route.fulfill({ json: { items: [] } });
    if (method === 'GET' && path === '/api/backups/export')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ format: 'ZV_backup', version: 1, messages: [{ id: 'audit-export', text: 'Conteúdo fictício' }], objectsList: [] }),
      });
    if (method === 'GET' && path.startsWith('/api/backups/jobs/')) {
      if (!state.report) return route.fulfill({ status: 404, json: { error: { message: 'Job de fixture não encontrado.' } } });
      return route.fulfill({ json: { status: 'COMPLETED', phase: 'Importação concluída', report: state.report } });
    }
    if (method === 'GET' && path === '/api/whatsapp/sessions') {
      const session = {
        id: 'audit-req094-connection', name: 'Conexão fictícia de auditoria', phoneNumber: null,
        status: state.connectionStatus, qrDataUrl: state.connectionStatus === 'AWAITING_QR' ? qr : null,
        qrExpiresAt: state.connectionStatus === 'AWAITING_QR' ? '2099-01-01T00:00:00.000Z' : null,
        error: null, createdAt: '2026-10-31T12:00:00.000Z',
      };
      return route.fulfill({ json: { items: [session] } });
    }
    if (method === 'GET' && path.endsWith('/api/attendance/library'))
      return route.fulfill({ json: { assets: [], funnels: [], macros: [], pixKeys: [] } });
    if (method === 'GET' && path === '/api/attendance/sessions/audit-req094-connection/conversations')
      return route.fulfill({ json: { items: [conversationFixture], total: 1, page: 1, pageSize: 50 } });
    if (method === 'GET' && path === '/api/attendance/sessions/audit-req094-connection/conversations/audit-req096-conversation')
      return route.fulfill({ json: conversationFixture });
    if (method === 'GET' && path === '/api/attendance/sessions/audit-req094-connection/conversations/audit-req096-conversation/messages')
      return route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 50 } });
    if (method === 'GET' && path === '/api/operations/sessions/audit-req094-connection/batches')
      return route.fulfill({ json: { items: [] } });
    if (method === 'GET' && path === '/api/automation/sessions/audit-req094-connection/flows')
      return route.fulfill({ json: { items: [] } });
    if (method === 'GET' && path === '/api/operations/sessions/audit-req094-connection/contacts/audit-req096-conversation/next-action')
      return route.fulfill({ json: null });
    if (method === 'GET' && path === '/api/attendance/sessions/audit-req094-connection/conversations/audit-req096-conversation/sequences')
      return route.fulfill({ json: { items: [] } });
    if (method === 'GET' && path === '/api/automation/sessions/audit-req094-connection/runs')
      return route.fulfill({ json: { items: [] } });
    if (method === 'GET' && /\/api\/whatsapp\/sessions\/audit-req094-connection\/(settings|labels)$/.test(path))
      return route.fulfill({ json: path.endsWith('/labels') ? { items: [] } : { autoLabelFirstMessage: false, firstMessageLabelId: null } });

    if (method === 'POST' && path === '/api/backups/upload') {
      const headers = request.headers();
      state.uploadName = decodeURIComponent(headers['x-backup-name'] ?? 'fixture.json');
      const buffer = request.postDataBuffer() ?? Buffer.alloc(0);
      state.uploadSize = buffer.byteLength;
      state.uploadText = buffer.byteLength <= 4 * 1024 * 1024 ? buffer.toString('utf8') : '';
      state.uploadObject = null;
      if (state.uploadText) {
        try { state.uploadObject = JSON.parse(state.uploadText) as Record<string, unknown>; } catch { /* large upload boundary case */ }
      }
      state.report = state.uploadObject ? buildReport(state.uploadObject) : {
        duplicate: false, format: 'ZV_backup', counts: { assets: 1, files: 1, labels: 0, contacts: 0, macros: 0, funnels: 0, flows: 0 }, warnings: [],
      };
      state.writes.push({ method, path, body: `filename=${state.uploadName}; bytes=${buffer.byteLength}` });
      return route.fulfill({ status: 202, json: { id: 'audit-backup-job' } });
    }
    if (method === 'POST' && path === '/api/operations/system-backups') {
      state.writes.push({ method, path, body: '{}' });
      const backup = { id: 'audit-zip-created', filename: 'backup-integral-ficticio', createdAt: '2026-10-31T12:01:00.000Z' };
      state.systemBackups = [backup, ...state.systemBackups];
      return route.fulfill({ status: 201, json: backup });
    }
    if (method === 'PUT' && path === '/api/operations/system-backups/settings') {
      const body = request.postDataJSON() as { automatic: boolean; time: string };
      state.writes.push({ method, path, body: JSON.stringify(body) });
      state.backupSettings = { automatic: Boolean(body.automatic), time: body.time };
      return route.fulfill({ status: 200, json: { ok: true } });
    }
    if (method === 'POST' && path === '/api/whatsapp/sessions/audit-req094-connection/connect') {
      state.writes.push({ method, path, body: '{}' });
      state.connectionStatus = 'AWAITING_QR';
      return route.fulfill({ status: 200, json: { id: 'audit-req094-connection', status: 'AWAITING_QR', qrDataUrl: qr } });
    }
    if (method === 'POST' && path === '/api/operations/directory/presence') {
      state.writes.push({ method, path, body: request.postData() ?? '' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    }
    if (method !== 'GET') {
      state.forbiddenWrites.push(`${method} ${path}`);
      state.writes.push({ method, path, body: request.postData() ?? '' });
      return route.fulfill({ status: 501, contentType: 'application/json', body: '{"error":{"message":"Mutação bloqueada pelo isolamento de auditoria."}}' });
    }
    return route.fallback();
  });
}

async function openApp(page: Page) {
  await page.goto('/atendimento', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 });
}

async function openBackupSettings(page: Page) {
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Backups e acesso', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Importar backup' })).toBeVisible();
}

async function saveEvidence(page: Page, id: string, info: TestInfo, extra: Record<string, unknown> = {}) {
  const directory = resolve(evidenceRoot, id);
  await mkdir(directory, { recursive: true });
  const suffix = info.project.name.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
  const state = stateOf(page);
  const screenshotError = await page.screenshot({ path: resolve(directory, `${suffix}.png`), fullPage: true, animations: 'disabled' })
    .then(() => '')
    .catch((error) => String(error));
  await writeFile(resolve(directory, `${suffix}.json`), JSON.stringify({
    req: id, result: info.status === 'passed' ? 'APROVADO' : info.status.toUpperCase(), project: info.project.name,
    viewport: page.viewportSize(), url: page.isClosed() ? '' : page.url(), writes: state.writes,
    forbiddenWrites: state.forbiddenWrites, blockedExternal: [...new Set(state.blockedExternal)],
    consoleErrors: state.consoleErrors, pageErrors: state.pageErrors, metrics: state.metrics, screenshotError,
    failures: info.errors.map((e) => e.message), ...extra,
  }, null, 2), 'utf8');
}

function expectIsolated(page: Page, allowOfflineErrors = false) {
  const state = stateOf(page);
  expect(state.forbiddenWrites).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  const unexpectedConsoleErrors = state.consoleErrors.filter((message) =>
    !message.includes('ERR_BLOCKED_BY_CLIENT') && !(allowOfflineErrors && message.includes('ERR_INTERNET_DISCONNECTED')),
  );
  expect(unexpectedConsoleErrors).toEqual([]);
}

test.beforeEach(async ({ page }) => installIsolation(page));
test.afterEach(async ({ page }, info) => {
  if (info.status !== 'skipped' && !page.isClosed() && page.url() !== 'about:blank') await saveEvidence(page, info.title.match(/REQ-\d+/)?.[0] ?? 'REQ-076', info);
});

const importScenarios: { id: string; file: string; data: Record<string, unknown>; key: string }[] = [
  { id: 'REQ-076', file: 'mensagens.json', key: 'messages', data: { format: 'ZV_backup', messages: [{ id: 'audit-msg-076', name: 'Mensagem fictícia', text: 'Olá de teste.' }] } },
  { id: 'REQ-077', file: 'audios.json', key: 'audios', data: { format: 'ZV_backup', audios: [{ id: 'audit-audio-077', name: 'Áudio fictício', base64: 'data:audio/ogg;base64,QQ==' }] } },
  { id: 'REQ-078', file: 'medias.json', key: 'medias', data: { format: 'ZV_backup', medias: [{ id: 'audit-media-078', name: 'Imagem fictícia', base64: 'data:image/png;base64,iVBORw0KGgo=' }] } },
  { id: 'REQ-079', file: 'documentos.json', key: 'docs', data: { format: 'ZV_backup', docs: [{ id: 'audit-doc-079', name: 'PDF fictício', base64: 'data:application/pdf;base64,JVBERi0xLjQ=' }] } },
  { id: 'REQ-080', file: 'funis.json', key: 'funnels', data: { format: 'ZV_backup', messages: [{ id: 'audit-funnel-msg-080', text: 'Olá' }], funnels: [{ id: 'audit-funnel-080', name: 'Funil fictício', itemsSequence: [{ itemId: 'audit-funnel-msg-080', type: 'message', delayBeforeSend: 0 }] }] } },
  { id: 'REQ-081', file: 'fluxos.json', key: 'flows', data: { format: 'ZV_backup', messages: [{ id: 'audit-flow-msg-081', text: 'Olá' }], flows: [{ id: 'audit-flow-081', name: 'Fluxo fictício', enabled: false, draft: { nodes: [{ id: 'inicio', type: 'start', position: { x: 0, y: 0 }, data: { nextNodeIds: ['texto'] } }, { id: 'texto', type: 'text', position: { x: 100, y: 0 }, data: { itemId: 'audit-flow-msg-081', nextNodeIds: [] } }], edges: [{ source: 'inicio', target: 'texto' }] } }] } },
  { id: 'REQ-082', file: 'etiquetas.json', key: 'labels', data: { format: 'ZV_backup', labels: [{ id: 'audit-label-082', name: 'Etiqueta fictícia', color: '#3366aa', phoneNumbers: ['5511999000082'] }] } },
  { id: 'REQ-083', file: 'objectsList.json', key: 'objectsList', data: { format: 'ZV_backup', objectsList: [{ id: 'audit-object-083', filename: 'texto.txt', mimeType: 'text/plain', base64: 'SGVsbG8gZmljdGljaW8=' }] } },
  { id: 'REQ-084', file: 'macros.json', key: 'respostasRapidasAcao', data: { respostasRapidasAcao: [{ id: 'audit-macro-084', name: 'Macro fictícia', acao: [{ type: 'txt', text: 'Olá!' }] }] } },
];

for (const scenario of importScenarios) {
  test(`${scenario.id}: importa ${scenario.key} pela interface e exibe relatório`, async ({ page }) => {
    await openApp(page);
    await openBackupSettings(page);
    const file = Buffer.from(JSON.stringify(scenario.data));
    const responsePromise = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith('/api/backups/upload') && response.request().method() === 'POST');
    await page.locator('input[type="file"][accept*="json"]').setInputFiles({ name: scenario.file, mimeType: 'application/json', buffer: file });
    const response = await responsePromise;
    expect(response.status()).toBe(202);
    await expect(page.getByRole('heading', { name: /Importação concluída ·/ })).toBeVisible({ timeout: 10_000 });
    const state = stateOf(page);
    expect(state.uploadObject?.[scenario.key]).toBeTruthy();
    expect(state.uploadSize).toBe(file.byteLength);
    const reportField: Record<string, keyof BackupReport['counts']> = {
      messages: 'assets', audios: 'assets', medias: 'assets', docs: 'assets',
      funnels: 'funnels', flows: 'flows', labels: 'labels', objectsList: 'files', respostasRapidasAcao: 'macros',
    };
    expect(state.report?.counts[reportField[scenario.key]]).toBeGreaterThan(0);
    expectIsolated(page);
  });
}

test('REQ-085: exporta JSON compatível e cria/baixa backup integral fictício', async ({ page }) => {
  await openApp(page);
  await openBackupSettings(page);
  const jsonDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar JSON', exact: true }).click();
  const exported = await jsonDownload;
  expect(exported.suggestedFilename()).toMatch(/^noctua-biblioteca-\d{4}-\d{2}-\d{2}\.json$/);
  const exportDir = resolve(evidenceRoot, 'REQ-085');
  await mkdir(exportDir, { recursive: true });
  const suffix = 'export-' + test.info().project.name;
  const exportPath = resolve(exportDir, `${suffix}.json`);
  await exported.saveAs(exportPath);
  const payload = JSON.parse(await readFile(exportPath, 'utf8')) as { format: string; messages: unknown[] };
  expect(payload.format).toBe('ZV_backup');
  expect(payload.messages).toHaveLength(1);

  await page.getByRole('button', { name: 'Criar cópia agora', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Baixar ZIP', exact: true })).toHaveCount(2);
  const zipDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar ZIP', exact: true }).first().click();
  const zip = await zipDownload;
  expect(zip.suggestedFilename()).toContain('backup-integral-ficticio');
  expect(stateOf(page).writes.filter((item) => item.path === '/api/operations/system-backups')).toHaveLength(1);
  expectIsolated(page);
});

test('REQ-086: seleciona arquivo acima de 40 MiB e a interface envia o backup', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1366', 'Caso de limite executado uma vez para reduzir memória do Chromium.');
  test.setTimeout(120_000);
  await openApp(page);
  await openBackupSettings(page);
  const largeFile = Buffer.alloc(40 * 1024 * 1024 + 1, 65);
  const upload = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith('/api/backups/upload') && response.request().method() === 'POST');
  await page.locator('input[type="file"][accept*="json"]').setInputFiles({ name: 'backup-acima-de-40-MiB.json', mimeType: 'application/json', buffer: largeFile });
  const response = await upload;
  expect(response.status()).toBe(202);
  expect(stateOf(page).uploadSize).toBe(40 * 1024 * 1024 + 1);
  await expect(page.getByRole('heading', { name: 'Importação concluída · ZV_backup' })).toBeVisible({ timeout: 15_000 });
  expectIsolated(page);
});

test('REQ-087: reconhece Sutofly sem solicitar senha', async ({ page }) => {
  await openApp(page);
  await openBackupSettings(page);
  const data = JSON.parse(await readFile(resolve(process.cwd(), 'examples', 'Sutofly_backup_ficticio.json'), 'utf8')) as Record<string, unknown>;
  await page.locator('input[type="file"][accept*="json"]').setInputFiles({ name: 'Sutofly-ficticio.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await expect(page.getByRole('heading', { name: 'Importação concluída · Sutofly' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByLabel(/senha/i)).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expectIsolated(page);
});

test('REQ-088: reconhece ZV_backup sem solicitar senha', async ({ page }) => {
  await openApp(page);
  await openBackupSettings(page);
  const data = JSON.parse(await readFile(resolve(process.cwd(), 'examples', 'ZV_backup.json'), 'utf8')) as Record<string, unknown>;
  await page.locator('input[type="file"][accept*="json"]').setInputFiles({ name: 'ZV_backup-ficticio.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await expect(page.getByRole('heading', { name: 'Importação concluída · ZV_backup' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByLabel(/senha/i)).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expectIsolated(page);
});

test('REQ-094: mostra QR fictício válido após solicitar conexão e preserva o estado coerente', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Conexões', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Conexões' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Conectar', exact: true })).toBeEnabled();
  const connecting = page.waitForResponse((response) => response.url().endsWith('/api/whatsapp/sessions/audit-req094-connection/connect'));
  await page.getByRole('button', { name: 'Conectar', exact: true }).click();
  expect((await connecting).status()).toBe(200);
  await expect(page.getByRole('img', { name: 'QR Code para conectar o WhatsApp' })).toBeVisible();
  await expect(page.getByText('Aguardando leitura', { exact: true })).toBeVisible();
  const image = await page.getByRole('img', { name: 'QR Code para conectar o WhatsApp' }).getAttribute('src');
  expect(image).toBe(qr);
  expect(stateOf(page).writes.filter((item) => item.path.endsWith('/connect'))).toHaveLength(1);
  expectIsolated(page);
});

test('REQ-095: interface indica queda e reconexão automática do servidor local', async ({ page, context }, info) => {
  test.setTimeout(45_000);
  await openApp(page);
  const status = page.locator('.topbar .connection-status');
  await expect.poll(() => status.textContent()).not.toContain('Servidor desconectado');
  const writeCount = stateOf(page).writes.length;
  await context.setOffline(true);
  await expect(status).toContainText('Servidor desconectado', { timeout: 15_000 });
  await context.setOffline(false);
  await expect.poll(() => status.textContent(), { timeout: 20_000 }).not.toContain('Servidor desconectado');
  const messageWrites = stateOf(page).writes.filter((item) => item.path.includes('/messages') || item.path.includes('/send'));
  expect(messageWrites).toEqual([]);
  expect(stateOf(page).writes.length).toBeGreaterThanOrEqual(writeCount);
  expectIsolated(page, true);
});

test('REQ-096: modal de informações do cliente abre centralizado na viewport', async ({ page }) => {
  await openApp(page);
  const firstConversation = page.locator('button.chat-item:not(.chat-item-more)').first();
  await expect(firstConversation).toBeVisible({ timeout: 15_000 });
  await firstConversation.click();
  await expect(page.locator('.client-name-button')).toBeVisible({ timeout: 15_000 });
  await page.locator('.client-name-button').click();
  const dialog = page.getByRole('dialog', { name: 'Informações do cliente' });
  await expect(dialog).toBeVisible();
  const centerY = () => dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return Math.abs(rect.y + rect.height / 2 - innerHeight / 2);
  });
  const centerX = () => dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return Math.abs(rect.x + rect.width / 2 - innerWidth / 2);
  });
  await expect.poll(centerY, { intervals: [20, 40, 80, 120], timeout: 2_000 }).toBeLessThanOrEqual(1);
  await expect.poll(centerX, { intervals: [20, 40, 80, 120], timeout: 2_000 }).toBeLessThanOrEqual(1);
  const position = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, vw: innerWidth, vh: innerHeight };
  });
  stateOf(page).metrics.modal = position;
  // Wait for the 180 ms entrance animation above, then require pixel-centered final bounds.
  expect(Math.abs(position.x + position.width / 2 - position.vw / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(position.y + position.height / 2 - position.vh / 2)).toBeLessThanOrEqual(1);
  expect(position.x).toBeGreaterThanOrEqual(0);
  expect(position.y).toBeGreaterThanOrEqual(0);
  expect(position.x + position.width).toBeLessThanOrEqual(position.vw + 1);
  expect(position.y + position.height).toBeLessThanOrEqual(position.vh + 1);
  expectIsolated(page);
});

test('REQ-097: primeira tela do atendimento mantém colunas visíveis sem sobreposição ou corte horizontal', async ({ page }) => {
  await openApp(page);
  const ready = () => page.evaluate(() => {
    const find = (selector: string, root: Document | ShadowRoot = document): Element | null => {
      const direct = root.querySelector(selector);
      if (direct) return direct;
      for (const element of Array.from(root.querySelectorAll('*'))) {
        if (element.shadowRoot) {
          const nested = find(selector, element.shadowRoot);
          if (nested) return nested;
        }
      }
      return null;
    };
    return Boolean(find('.conversation-column'));
  });
  await expect.poll(ready, { timeout: 20_000 }).toBe(true);
  const geometry = await page.evaluate(() => {
    const find = (selector: string, root: Document | ShadowRoot = document): Element | null => {
      const direct = root.querySelector(selector);
      if (direct) return direct;
      for (const element of Array.from(root.querySelectorAll('*'))) {
        if (element.shadowRoot) {
          const nested = find(selector, element.shadowRoot);
          if (nested) return nested;
        }
      }
      return null;
    };
    const rect = (element: Element | null) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height,
        visible: style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0,
      };
    };
    const layout = find('.inbox-layout') ?? find('.noctua-dock-workspace');
    return {
      vw: innerWidth, vh: innerHeight, scrollWidth: document.documentElement.scrollWidth,
      docked: Boolean(find('.noctua-dock-workspace')), layout: rect(layout),
      list: rect(find('.conversation-column')), chat: rect(find('.chat-pane')),
      tools: rect(find('.tools-panel:not([hidden])')),
    };
  });
  stateOf(page).metrics.layout = geometry;
  expect(geometry.layout?.width).toBeGreaterThan(0);
  expect(geometry.list?.visible).toBe(true);
  expect(geometry.list?.width).toBeGreaterThan(0);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.vw + 1);
  expect(geometry.list!.x).toBeGreaterThanOrEqual(geometry.layout!.x - 1);
  expect(geometry.list!.right).toBeLessThanOrEqual(geometry.layout!.right + 1);
  if (geometry.vw > 760) {
    expect(geometry.chat?.visible).toBe(true);
    expect(geometry.chat?.width).toBeGreaterThan(0);
    expect(geometry.chat!.width).toBeGreaterThan(geometry.vw * 0.25);
    expect(geometry.chat!.x).toBeGreaterThanOrEqual(geometry.layout!.x - 1);
    expect(geometry.chat!.right).toBeLessThanOrEqual(geometry.layout!.right + 1);
    expect(geometry.list!.right <= geometry.chat!.x + 2 || geometry.chat!.right <= geometry.list!.x + 2).toBeTruthy();
  } else {
    expect(geometry.list!.width).toBeGreaterThan(geometry.vw * 0.8);
    expect(geometry.chat?.visible).toBe(false);
  }
  if (geometry.tools?.visible) {
    expect(geometry.tools.x).toBeGreaterThanOrEqual(geometry.layout!.x - 1);
    expect(geometry.tools.right).toBeLessThanOrEqual(geometry.layout!.right + 1);
  }
  expectIsolated(page);
});
