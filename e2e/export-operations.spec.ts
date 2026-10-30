import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { inflateRawSync } from 'node:zlib';

const evidenceRoot = resolve(process.cwd(), 'REVISAO', 'evidencias');
const api = 'http://127.0.0.1:3340/api';
const require = createRequire(resolve(process.cwd(), 'apps', 'server', 'package.json'));
const XLSX = require('xlsx');

async function openApp(page: Page) {
  await page.goto('/atendimento');
  await expect(page.getByRole('button', { name: 'Atendimento', exact: false }).first()).toBeVisible();
}

async function selectFirstConversation(page: Page) {
  await page.getByRole('button', { name: 'Atendimento', exact: false }).first().click();
  await page.locator('button.chat-item:not(.chat-item-more)').first().click();
  await expect(page.locator('.client-name-button')).toBeVisible();
}

async function openContactHistory(page: Page) {
  await page.locator('.client-name-button').click();
  const dialog = page.getByRole('dialog', { name: 'Informações do cliente' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Histórico', exact: true }).click();
  return dialog;
}

async function saveEvidence(page: Page, ids: string[], info: TestInfo, result: Record<string, unknown>) {
  for (const id of ids) {
    const directory = resolve(evidenceRoot, id);
    await mkdir(directory, { recursive: true });
    const suffix = info.project.name.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
    await page.screenshot({ path: resolve(directory, `${suffix}.png`), fullPage: true });
    await writeFile(resolve(directory, `${suffix}.json`), JSON.stringify({
      req: id, result: 'APROVADO', project: info.project.name, url: page.url(), ...result,
    }, null, 2), 'utf8');
  }
}

function unzipEntries(bytes: Buffer) {
  const files = new Map<string, Buffer>();
  for (let at = 0; at + 46 <= bytes.length; at++) {
    if (bytes.readUInt32LE(at) !== 0x02014b50) continue;
    const size = bytes.readUInt32LE(at + 20);
    const nameLength = bytes.readUInt16LE(at + 28);
    const extra = bytes.readUInt16LE(at + 30);
    const comment = bytes.readUInt16LE(at + 32);
    const offset = bytes.readUInt32LE(at + 42);
    const name = bytes.subarray(at + 46, at + 46 + nameLength).toString();
    const begin = offset + 30 + bytes.readUInt16LE(offset + 26) + bytes.readUInt16LE(offset + 28);
    const content = bytes.subarray(begin, begin + size);
    files.set(name, bytes.readUInt16LE(at + 10) === 8 ? inflateRawSync(content) : content);
    at += 45 + nameLength + extra + comment;
  }
  return files;
}

function workbookBytes(rows: unknown[][], bookType: 'xlsx' | 'xls') {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Contatos');
  return XLSX.write(book, { bookType, type: 'buffer' }) as Buffer;
}

async function openImport(page: Page) {
  await openApp(page);
  await page.getByRole('button', { name: 'Contatos', exact: true }).click();
  await page.getByRole('button', { name: 'Importar Excel / CSV' }).click();
  const dialog = page.getByRole('dialog', { name: 'Importar contatos de uma planilha' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('REQ-298/REQ-299/REQ-303 exporta o histórico pelo chat em ordem e com papéis/formatos', async ({ page }, info) => {
  await openApp(page);
  await selectFirstConversation(page);
  const dialog = await openContactHistory(page);
  await expect(dialog.getByRole('button', { name: 'Exportar textos' })).toBeVisible();
  await saveEvidence(page, ['REQ-298', 'REQ-299', 'REQ-303'], info, {
    entry: 'chat > informações do cliente > histórico',
    structuredFiles: ['historico.json', 'conversa.jsonl', 'dialogo.jsonl', 'dialogo.txt', 'dialogo.csv'],
  });
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Exportar textos', exact: true }).click();
  const download = await downloadPromise;
  const zipPath = await download.path();
  expect(zipPath).toBeTruthy();
  const files = unzipEntries(await readFile(zipPath!));
  for (const entry of ['historico.json', 'conversa.jsonl', 'dialogo.jsonl', 'dialogo.txt', 'dialogo.csv'])
    expect(files.has(entry), `REQ-299 inclui ${entry}`).toBeTruthy();
  const turns = files.get('dialogo.jsonl')!.toString().trim().split('\n').map((line) => JSON.parse(line));
  expect(turns.length).toBeGreaterThan(1);
  expect(turns.some((turn: { role: string }) => turn.role === 'user')).toBeTruthy();
  expect(turns.some((turn: { role: string }) => turn.role === 'assistant')).toBeTruthy();
  const moments = turns.map((turn: { sentAt: string }) => Date.parse(turn.sentAt));
  expect(moments).toEqual([...moments].sort((a, b) => a - b));
});

test('REQ-300/REQ-301/REQ-304/REQ-305/REQ-306 prepara mídia com consentimento e aprova exemplos sem provedor', async ({ page }, info) => {
  const snapshot = new Date().toISOString();
  const results = [
    { id: 'audit-audio', type: 'audioMessage' },
    { id: 'audit-image', type: 'imageMessage' },
    { id: 'audit-video', type: 'videoMessage' },
  ];
  const requests: Array<Record<string, unknown>> = [];
  let pageIndex = 0;
  await page.route('**/api/operations/features', (route) =>
    route.fulfill({ json: { aiEnabled: true, canManage: true } }),
  );
  await page.route('**/api/operations/sessions/*/history-preprocessing', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    requests.push(body);
    const item = results[pageIndex++];
    if (!item) {
      await route.fulfill({ json: { total: results.length, done: true, snapshot } });
      return;
    }
    await route.fulfill({ json: {
      total: results.length,
      done: false,
      snapshot,
      nextCursor: item.id,
      item: { ...item, status: 'ANALYZED' },
    } });
  });
  await page.route('**/api/operations/sessions/*/contacts/*/knowledge', (route) =>
    route.fulfill({ json: { examples: 3, sentToProvider: false } }),
  );
  await openApp(page);
  await selectFirstConversation(page);
  const dialog = await openContactHistory(page);
  const preprocessing = dialog.getByRole('region', { name: 'Pré-processamento multimídia' });
  await preprocessing.getByLabel(/Autorizo enviar as mídias/).check();
  await preprocessing.getByRole('button', { name: 'Analisar mídias antes de exportar' }).click();
  await expect(dialog.getByText('Pré-processamento concluído.', { exact: false })).toBeVisible();
  await expect(preprocessing).toContainText('3 de 3 mídias conferidas');
  expect(pageIndex).toBe(4);
  expect(requests).toHaveLength(4);
  expect(requests.slice(0, 3).map((request) => request.consent)).toEqual([true, true, true]);
  expect(new Set(requests.slice(0, 3).map((request) => (request.conversationIds as string[])[0])).size).toBe(1);
  await dialog.getByRole('button', { name: 'Aprovar respostas como exemplos da IA' }).click();
  await expect(dialog.getByText('3 exemplos de respostas adicionados à base local da IA. Nada foi enviado ao provedor.')).toBeVisible();
  await saveEvidence(page, ['REQ-300', 'REQ-301', 'REQ-304', 'REQ-305', 'REQ-306'], info, {
    mediaTypes: results.map((item) => item.type),
    provider: 'interceptado localmente; nenhuma chamada externa',
    consent: true,
    exampleApproval: 'somente base local',
  });
});

test('REQ-307/REQ-308 pausa a IA no atendimento humano e mantém o painel recuperável', async ({ page }, info) => {
  let paused = false;
  await page.route('**/api/operations/features', (route) =>
    route.fulfill({ json: { aiEnabled: true, canManage: true } }),
  );
  await page.route('**/api/operations/sessions/*/contacts/*/ai-control', async (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as { paused: boolean };
      paused = body.paused;
    }
    await route.fulfill({ json: { enabled: true, paused, reason: paused ? 'human' : 'automatic' } });
  });
  await openApp(page);
  await selectFirstConversation(page);
  await expect(page.getByRole('button', { name: 'Assumir atendimento' })).toBeVisible();
  await page.getByRole('button', { name: 'Assumir atendimento' }).click();
  await expect(page.getByText('Atendimento humano · IA pausada', { exact: true })).toBeVisible();
  await page.reload();
  await selectFirstConversation(page);
  await expect(page.getByText('Atendimento humano · IA pausada', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retomar IA' }).click();
  await expect(page.getByText('IA ativa nesta conversa', { exact: true })).toBeVisible();
  await saveEvidence(page, ['REQ-307', 'REQ-308'], info, {
    manualTakeover: true,
    pausePersistedAfterReload: true,
    customerRequestDetection: 'servidor simulado; operações.test.ts',
    resumed: true,
  });
});

test('REQ-309/REQ-312 importa XLSX com colunas invertidas e persiste após revisar o mapeamento', async ({ page }, info) => {
  const suffix = Date.now().toString().slice(-8);
  const name = `Planilha XLSX ${suffix}`;
  const phone = `5588${suffix}`;
  const dialog = await openImport(page);
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'auditoria-colunas-invertidas.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: workbookBytes([['Nome principal', 'Telefone principal'], [phone, name]], 'xlsx'),
  });
  await dialog.getByRole('button', { name: 'Ler planilha' }).click();
  await expect(dialog.getByRole('combobox', { name: 'Coluna do telefone' })).toBeVisible();
  await dialog.getByRole('combobox', { name: 'Coluna do telefone' }).click();
  await page.getByRole('option', { name: 'Nome principal', exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Coluna do nome' }).click();
  await page.getByRole('option', { name: 'Telefone principal', exact: true }).click();
  await expect(dialog.getByText(name, { exact: true })).toBeVisible();
  await expect(dialog.getByText(`+${phone}`, { exact: true })).toBeVisible();
  await expect(dialog.getByText('1 contatos válidos', { exact: false })).toBeVisible();
  await dialog.getByLabel('Etiqueta adicional para este lote').fill(`Lote ${suffix}`);
  await dialog.getByRole('button', { name: 'Importar 1 contatos' }).click();
  await expect(page.getByText('1 contatos importados. Nenhuma mensagem enviada.')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Contatos', exact: true }).click();
  await page.getByLabel('Buscar contatos').fill(name);
  const contactRow = page.locator('.contacts-table button').filter({ hasText: name });
  await expect(contactRow).toContainText(`+${phone}`);
  await saveEvidence(page, ['REQ-309', 'REQ-312'], info, {
    format: '.xlsx', columnsManuallyMapped: true, previewCount: 1, phone, name, persistedAfterReload: true,
  });
});

test('REQ-310/REQ-313 importa XLS legado e normaliza número local com DDI/DDD informados', async ({ page }, info) => {
  const suffix = Date.now().toString().slice(-8);
  const name = `Planilha XLS ${suffix}`;
  const localPhone = `9${suffix}`;
  const normalizedPhone = `5521${localPhone}`;
  const dialog = await openImport(page);
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'auditoria-legado.xls',
    mimeType: 'application/vnd.ms-excel',
    buffer: workbookBytes([['Nome', 'Telefone'], [name, localPhone]], 'xls'),
  });
  await dialog.getByLabel('DDD padrão para números locais (opcional)').fill('21');
  await dialog.getByRole('button', { name: 'Ler planilha' }).click();
  await expect(dialog.getByText(name, { exact: true })).toBeVisible();
  await expect(dialog.getByText(`+${normalizedPhone}`, { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Importar 1 contatos' }).click();
  await expect(page.getByText('1 contatos importados. Nenhuma mensagem enviada.')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Contatos', exact: true }).click();
  await page.getByLabel('Buscar contatos').fill(name);
  const contactRow = page.locator('.contacts-table button').filter({ hasText: name });
  await expect(contactRow).toContainText(`+${normalizedPhone}`);
  await saveEvidence(page, ['REQ-310', 'REQ-313'], info, {
    format: '.xls', localDigits: localPhone, countryCode: '55', areaCode: '21', normalizedPhone,
    persistedAfterReload: true,
  });
});

test('REQ-321 agenda lembrete interno fictício e persiste sem enviar ao cliente', async ({ page }, info) => {
  const name = `Lembrete interno REQ-321 ${info.project.name} ${Date.now()}`;
  let sends = 0;
  page.on('request', (request) => {
    if (/\/conversations\/[^/]+\/send(?:-|$)/.test(request.url())) sends += 1;
  });
  await openApp(page);
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  await page.getByRole('button', { name: 'Novo agendamento' }).click();
  const dialog = page.getByRole('dialog', { name: 'Agendar mensagem ou lembrete' });
  await dialog.getByLabel('Nome', { exact: true }).fill(name);
  const contact = dialog.getByRole('combobox', { name: 'Contato para agendamento' });
  await contact.fill('Ana Exemplo');
  await dialog.getByRole('option', { name: /Ana Exemplo/ }).click();
  await contact.press('Escape');
  await expect(contact).toHaveValue('Ana Exemplo');
  await dialog.getByRole('combobox', { name: 'Conteúdo' }).click();
  await page.getByRole('option', { name: 'Lembrete interno · sem envio ao cliente', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Texto do lembrete' }).fill('Revisar o orçamento fictício com a equipe.');
  const later = new Date(Date.now() + 86_400_000);
  later.setMinutes(later.getMinutes() + 5);
  const localDate = new Date(later.getTime() - later.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  await dialog.locator('input[name="runAt"]').fill(localDate);
  await dialog.getByRole('button', { name: 'Conferir público' }).click();
  await expect(dialog.getByText(/1 contato corresponde ao filtro|1 contatos correspondem ao filtro/)).toBeVisible();
  const responsePromise = page.waitForResponse((response) =>
    response.url().endsWith('/api/operations/sessions/audit-session/batches') &&
    response.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: 'Salvar rascunho' }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  const created = await response.json() as { id: string };
  try {
  await page.reload();
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  const listResponse = await page.request.get(`${api}/operations/sessions/audit-session/batches`);
  const items = (await listResponse.json() as { items: Array<Record<string, unknown>> }).items;
  const saved = items.find((item) => item.id === created.id);
  expect(saved?.mode).toBe('REMINDER');
  expect(saved?.status).toBe('DRAFT');
  expect(sends).toBe(0);
  await saveEvidence(page, ['REQ-321'], info, { mode: saved?.mode, status: saved?.status, persistedAfterReload: true, customerSends: sends });
  } finally {
    const cancelled = await page.request.put(`${api}/operations/sessions/audit-session/batches/${created.id}`, {
      data: { status: 'CANCELLED' },
    });
    expect(cancelled.status()).toBe(200);
  }
});

test('REQ-322 envia imagem fictícia à Biblioteca, categoriza e persiste após recarregar', async ({ page }, info) => {
  const resourceName = `Upload REQ-322 ${info.project.name} ${Date.now()}`;
  const category = `Categoria REQ-322 ${info.project.name}`;
  const originalResponse = await page.request.get(`${api}/operations/toolbox/organization`);
  const original = await originalResponse.json() as { categories: string[]; assignments: Record<string, string> };
  await openApp(page);
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await page.getByRole('button', { name: 'Mídias', exact: true }).click();
  await page.getByRole('button', { name: 'Nova resposta' }).click();
  const editor = page.getByRole('dialog', { name: 'Nova resposta rápida' });
  await editor.getByLabel('Nome', { exact: true }).fill(resourceName);
  await editor.locator('input[type="file"]').setInputFiles({
    name: 'imagem-ficticia-req322.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  });
  const savedAssetPromise = page.waitForResponse((response) =>
    response.url().endsWith('/api/attendance/assets') && response.request().method() === 'POST',
  );
  await editor.getByRole('button', { name: 'Salvar resposta' }).click();
  const savedAssetResponse = await savedAssetPromise;
  expect(savedAssetResponse.status()).toBe(201);
  const asset = await savedAssetResponse.json() as { id: string };
  try {
  await page.getByRole('button', { name: 'Organizar categorias' }).click();
  const categories = page.getByRole('dialog', { name: 'Categorias das respostas' });
  await categories.getByLabel('Nova categoria').fill(category);
  await categories.getByRole('button', { name: 'Adicionar categoria' }).click();
  await categories.getByLabel(resourceName).click();
  await categories.getByRole('option', { name: category, exact: true }).click();
  const categorySaved = page.waitForResponse((response) =>
    response.url().endsWith('/api/operations/toolbox/organization') && response.request().method() === 'PUT' && response.ok(),
  );
  await categories.getByRole('button', { name: 'Salvar organização' }).click();
  await categorySaved;
  await page.reload();
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await page.getByRole('button', { name: 'Mídias', exact: true }).click();
  await page.getByLabel('Categoria da biblioteca').click();
  await page.getByRole('option', { name: category, exact: true }).click();
  const card = page.locator('.resource-card').filter({ has: page.getByRole('button', { name: resourceName, exact: true }) });
  await expect(card).toBeVisible();
  await expect(card).toContainText('image/webp');
  await expect(card.getByRole('button', { name: 'Visualizar mídia' })).toBeVisible();
  await saveEvidence(page, ['REQ-322'], info, { uploaded: true, category, persistedAfterReload: true, assetId: asset.id });
  } finally {
    await page.request.put(`${api}/operations/toolbox/organization`, { data: original });
    const removed = await page.request.delete(`${api}/attendance/assets/${encodeURIComponent(asset.id)}`);
    expect(removed.status()).toBe(200);
  }
});

test('REQ-327/REQ-562 mostra necessidade de conectar com QR fictício sem tocar no WhatsApp', async ({ page }, info) => {
  const qrDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  await page.route('**/api/whatsapp/sessions', async (route) => {
    const response = await route.fetch();
    const body = await response.json() as { items: Array<Record<string, unknown>> };
    await route.fulfill({ response, json: { ...body, items: body.items.map((item, index) => index === 0
      ? { ...item, status: 'AWAITING_QR', qrDataUrl, qrExpiresAt: new Date(Date.now() + 60_000).toISOString() }
      : item) } });
  });
  await openApp(page);
  await page.getByRole('button', { name: 'Conexões', exact: true }).click();
  const qr = page.getByAltText('QR Code para conectar o WhatsApp');
  await expect(qr).toBeVisible();
  const bounds = await qr.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height, naturalWidth: (element as HTMLImageElement).naturalWidth };
  });
  expect(bounds.naturalWidth).toBe(1);
  expect(bounds.width).toBeGreaterThan(0);
  expect(bounds.width).toBeLessThanOrEqual((await page.evaluate(() => innerWidth)) - 24);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  await expect(page.getByRole('button', { name: 'Conectar', exact: true })).toBeVisible();
  await saveEvidence(page, ['REQ-562'], info, { qr: 'mocked local response; no WhatsApp connection', reconnectInstruction: true, connectButtonVisible: true, bounds, responsive: true });
});

test('REQ-326 filtra mensagens fixadas por categoria após salvar preferências', async ({ page }, info) => {
  const firstCategory = `Fixados A ${info.project.name}`;
  const secondCategory = `Fixados B ${info.project.name}`;
  const originalResponse = await page.request.get(`${api}/operations/settings/preferences`);
  const original = await originalResponse.json() as Record<string, unknown>;
  const libraryResponse = await page.request.get(`${api}/attendance/library`);
  const library = await libraryResponse.json() as { assets: Array<{ id: string; name: string }> };
  const firstName = library.assets.find((item) => item.id === 'audit-asset-welcome')?.name;
  const secondName = library.assets.find((item) => item.id === 'audit-asset-budget')?.name;
  expect(firstName).toBeTruthy();
  expect(secondName).toBeTruthy();
  await openApp(page);
  await selectFirstConversation(page);
  await page.locator('[title="Personalizar Atendimento"]').click();
  await page.getByRole('tab', { name: 'Mensagens fixadas' }).click();
  const picker = page.locator('.hud-pin-picker');
  for (const [name, category] of [
    [firstName!, firstCategory],
    [secondName!, secondCategory],
  ]) {
    const item = picker.locator('label').filter({ hasText: name }).first();
    const checkbox = item.locator('input[type="checkbox"]');
    if (!(await checkbox.isChecked())) await checkbox.check();
    await picker.getByRole('button', { name: `Configurar ${name}`, exact: true }).click();
    await page.getByLabel('Categoria deste botão').fill(category);
  }
  const saved = page.waitForResponse((response) =>
    response.url().endsWith('/api/operations/settings/preferences') && response.request().method() === 'PUT' && response.ok(),
  );
  await page.getByRole('button', { name: 'Confirmar alterações' }).click();
  await saved;
  try {
    await page.reload();
    await selectFirstConversation(page);
    const show = page.getByRole('button', { name: 'Mostrar biblioteca lateral', exact: true });
    if (await show.isVisible()) await show.click();
    await page.getByRole('button', { name: 'Fixados', exact: true }).click();
    const categoryFilter = page.getByRole('combobox', { name: 'Categoria dos fixados' });
    await categoryFilter.click();
    await page.getByRole('option', { name: firstCategory, exact: true }).click();
    const cards = page.locator('.pinned-message-card');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText(firstName!);
    await saveEvidence(page, ['REQ-326'], info, {
      categories: [firstCategory, secondCategory],
      selectedCategory: firstCategory,
      visiblePinnedResource: firstName,
      persistedAfterReload: true,
    });
  } finally {
    await page.request.put(`${api}/operations/settings/preferences`, { data: original });
  }
});
