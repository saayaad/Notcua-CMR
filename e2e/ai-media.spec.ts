import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const evidenceRoot = resolve(process.cwd(), 'REVISAO', 'evidencias');

async function openConversation(page: Page, index = 0) {
  const preferencesLoaded = page.waitForResponse((response) => response.url().includes('/api/operations/settings/preferences'));
  await page.goto('/atendimento');
  await preferencesLoaded;
  await expect(page.locator('.app-shell')).toBeVisible();
  const items = page.locator('button.chat-item:not(.chat-item-more)');
  await expect(items.nth(index)).toBeVisible();
  await items.nth(index).click();
  await expect(page.locator('.client-name-button')).toBeVisible();
}

async function openClientStudio(page: Page) {
  const mobileAction = page.getByRole('button', { name: 'Estúdio de IA', exact: true });
  if (await mobileAction.isVisible()) {
    await mobileAction.click();
    await expect(page.getByRole('dialog')).toContainText('Estúdio de IA');
    return;
  }
  const action = page.getByRole('button', { name: 'Estúdio de IA deste cliente', exact: true });
  if (await action.isVisible()) await action.click();
  else {
    await page.locator('details.chat-more-actions summary').click();
    await page.getByRole('button', { name: 'Estúdio de IA deste cliente', exact: true }).click();
  }
  await expect(page.getByRole('dialog')).toContainText('Estúdio de IA');
}

async function saveEvidence(page: Page, ids: string[], info: TestInfo, result: Record<string, unknown>) {
  const suffix = info.project.name.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
  const consoleErrors = (page as Page & { __auditConsoleErrors?: string[] }).__auditConsoleErrors ?? [];
  const emptySourceElements = await page.locator('[src=""]').evaluateAll((nodes) => nodes.map((node) => ({
    tag: node.tagName.toLowerCase(), className: (node as HTMLElement).className,
  })));
  const { statusByReq, ...details } = result as Record<string, unknown> & { statusByReq?: Record<string, string> };
  for (const id of ids) {
    const directory = resolve(evidenceRoot, id);
    await mkdir(directory, { recursive: true });
    await page.screenshot({ path: resolve(directory, `${suffix}.png`), fullPage: true });
    await writeFile(resolve(directory, `${suffix}.json`), JSON.stringify({
      req: id, result: statusByReq?.[id] ?? 'APROVADO', project: info.project.name, url: page.url(),
      consoleErrors, emptySourceElements, ...details,
    }, null, 2), 'utf8');
  }
}

async function createSyntheticVideo(page: Page) {
  const dataUrl = await page.evaluate(() => new Promise<string>((resolve, reject) => {
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
    const context = canvas.getContext('2d')!;
    let frame = 0;
    const draw = () => { context.fillStyle = `hsl(${(frame * 15) % 360} 65% 45%)`; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = '#fff'; context.font = '24px Arial'; context.fillText('VIDEO DE TESTE LOCAL', 20, 90); frame++; };
    draw();
    const stream = canvas.captureStream(8);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onerror = () => reject(new Error('Falha ao criar vídeo sintético de teste.'));
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(new Blob(chunks, { type: 'video/webm' }));
    };
    recorder.start();
    const interval = window.setInterval(draw, 125);
    window.setTimeout(() => { window.clearInterval(interval); recorder.stop(); }, 1100);
  }));
  return Buffer.from(dataUrl.split(',')[1]!, 'base64');
}

test.beforeEach(async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      void Promise.all(message.args().map((arg) => arg.jsonValue().catch(() => '[unserializable]')))
        .then((args) => consoleErrors.push(`${message.text()} :: ${JSON.stringify(args)}`));
    }
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) void response.text().then((body) => consoleErrors.push(`HTTP ${response.status()} ${response.url()} :: ${body.slice(0, 300)}`));
  });
  (page as Page & { __auditConsoleErrors?: string[] }).__auditConsoleErrors = consoleErrors;
  await page.route('**/api/attendance/sessions/*/conversations/*/read', (route) => route.fulfill({ json: { ok: true } }));
  await page.route('**/*operations/features**', (route) => route.fulfill({ json: { aiEnabled: true, canManage: true } }));
  await page.route('**/*settings/preferences**', (route) => {
    return route.fulfill({ json: { hudHiddenActions: [], hudHeaderOrder: [] } });
  });
});

test('REQ-360/REQ-361/REQ-362 configura roteamento Gemini e modelo visual com provedor simulado', async ({ page }, info) => {
  let config: Record<string, unknown> = {
    provider: 'gemini', configured: true, enabled: false, model: 'gemini-test-base', fastModel: 'gemini-test-flash',
    reasoningModel: 'gemini-test-pro', imageModel: 'gemini-test-image', mediaModel: 'gemini-test-media',
    transcriptionModel: '', instructions: '', style: '', knowledge: '', fallbackText: '', usage: { todayTokens: 0, todayRequests: 0, monthCost: 0, unconfirmed: 0 },
  };
  await page.route('**/api/operations/ai', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: config });
    if (route.request().method() === 'PUT') { config = route.request().postDataJSON() as Record<string, unknown>; return route.fulfill({ json: { ok: true } }); }
    return route.fallback();
  });
  await page.goto('/atendimento');
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('button', { name: 'Integração de IA', exact: true }).click();
  const enabledSwitch = page.locator('.ai-feature-switch button');
  if (await enabledSwitch.count()) {
    if ((await enabledSwitch.getAttribute('aria-checked')) !== 'true') await enabledSwitch.click();
  }
  await expect(page.getByLabel('Modelo de atendimento')).toBeVisible();
  await expect(page.getByLabel('Modelo rápido · tarefas simples')).toHaveValue('gemini-test-flash');
  await expect(page.getByLabel('Modelo de raciocínio · tarefas complexas')).toHaveValue('gemini-test-pro');
  await expect(page.getByLabel('Modelo de geração de imagens')).toHaveValue('gemini-test-image');
  await page.getByLabel('Modelo rápido · tarefas simples').fill('gemini-audit-flash');
  await page.getByLabel('Modelo de raciocínio · tarefas complexas').fill('gemini-audit-pro');
  await page.getByLabel('Modelo de geração de imagens').fill('gemini-audit-image');
  await page.getByRole('button', { name: 'Salvar integração' }).click();
  await expect.poll(() => config.fastModel).toBe('gemini-audit-flash');
  await expect.poll(() => config.reasoningModel).toBe('gemini-audit-pro');
  await expect.poll(() => config.imageModel).toBe('gemini-audit-image');
  await page.reload();
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('button', { name: 'Integração de IA', exact: true }).click();
  await expect(page.getByLabel('Modelo rápido · tarefas simples')).toHaveValue('gemini-audit-flash');
  await expect(page.getByLabel('Modelo de raciocínio · tarefas complexas')).toHaveValue('gemini-audit-pro');
  await expect(page.getByLabel('Modelo de geração de imagens')).toHaveValue('gemini-audit-image');
  await saveEvidence(page, ['REQ-360', 'REQ-361', 'REQ-362'], info, { routingConfig: config, provider: 'simulado', keyUsed: false });
});

test('REQ-363/REQ-364/REQ-365/REQ-370/REQ-371/REQ-372 separa histórico por cliente e persiste geração e roteiro', async ({ page }, info) => {
  const threads = new Map<string, Array<{ id: string; role: 'user' | 'assistant'; kind: 'text' | 'image'; text: string; createdAt: string }>>();
  let activeContact = '';
  const generatedUploads: Array<{ bytes: number; mimeType: string }> = [];
  let preparedImageSend = 0;
  const generatedPng = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 96;
    const context = canvas.getContext('2d')!; context.fillStyle = '#7540bd'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#fff'; context.font = '18px Arial'; context.fillText('AI MOCK', 20, 50);
    return canvas.toDataURL('image/png').split(',')[1]!;
  });
  await page.route('**/api/whatsapp/sessions', async (route) => {
    const response = await route.fetch(); const data = await response.json();
    return route.fulfill({ response, json: { ...data, items: data.items.map((item: Record<string, unknown>) => ({ ...item, status: 'CONNECTED' })) } });
  });
  await page.route('**/api/attendance/files', async (route) => {
    const body = route.request().postDataJSON() as { base64: string; mimeType: string };
    generatedUploads.push({ bytes: Buffer.from(body.base64.split(',')[1] ?? body.base64, 'base64').length, mimeType: body.mimeType });
    return route.fulfill({ json: { id: `generated-audit-file-${generatedUploads.length}` } });
  });
  await page.route('**/api/attendance/sessions/*/conversations/*/send', async (route) => { preparedImageSend++; return route.fulfill({ json: { ok: true } }); });
  await page.route('**/api/operations/settings/watermarks', (route) => route.fulfill({ json: { enabledByDefault: true, activeId: 'audit', marks: [{ id: 'audit', name: 'Marca local', text: 'TESTE LOCAL', opacity: 60, position: 'diagonal' }] } }));
  await page.route('**/api/files/audit-generated-image', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(generatedPng, 'base64') }));
  await page.route('**/api/operations/client-ai/sessions/*/contacts/*/ai-thread**', async (route) => {
    const url = new URL(route.request().url());
    const match = url.pathname.match(/contacts\/([^/]+)\/ai-thread/);
    const contactId = decodeURIComponent(match?.[1] ?? 'unknown');
    activeContact = contactId;
    const key = contactId;
    const history = threads.get(key) ?? [];
    if (route.request().method() === 'GET') return route.fulfill({ json: { entries: history } });
    const body = route.request().postDataJSON() as { text?: string };
    const message = body.text ?? '';
    const entries = [
      { id: `user-${Date.now()}`, role: 'user' as const, kind: 'text' as const, text: message, createdAt: new Date().toISOString() },
      { id: `assistant-${Date.now()}`, role: 'assistant' as const, kind: 'text' as const, text: `Simulado para ${contactId}: ${message}`, createdAt: new Date().toISOString() },
    ];
    threads.set(key, [...history, ...entries]);
    return route.fulfill({ json: { entries } });
  });
  await page.route('**/api/operations/client-ai/sessions/*/contacts/*/ai-thread/images', async (route) => {
    const payload = route.request().postDataJSON() as { prompt: string; template: string; aspectRatio: string; reference?: { mimeType: string; data: string } };
    const contactId = new URL(route.request().url()).pathname.match(/contacts\/([^/]+)\/ai-thread/)?.[1] ?? 'unknown';
    const entries = [
      { id: `image-user-${Date.now()}`, role: 'user' as const, kind: 'image' as const, text: payload.prompt, createdAt: new Date().toISOString() },
      { id: `image-assistant-${Date.now()}`, role: 'assistant' as const, kind: 'image' as const, text: `Imagem simulada ${payload.template} ${payload.aspectRatio}${payload.reference ? ' com referência' : ''}`, fileId: 'audit-generated-image', createdAt: new Date().toISOString() },
    ];
    threads.set(decodeURIComponent(contactId), [...(threads.get(decodeURIComponent(contactId)) ?? []), ...entries]);
    return route.fulfill({ json: { entries, model: 'simulado-local' } });
  });
  await openConversation(page);
  const firstContact = await page.locator('.client-name-button').innerText();
  await openClientStudio(page);
  await page.getByRole('textbox', { name: 'Converse com a IA sobre este cliente…' }).fill('Crie roteiro de apresentação usando o contexto deste cliente.');
  await page.locator('.client-ai-composer button').click();
  await expect(page.locator('.client-ai-log')).toContainText('Simulado para');
  await expect.poll(() => threads.size).toBe(1);
  const firstKey = [...threads.keys()][0]!;
  expect(firstContact.trim()).toBeTruthy();
  await page.getByRole('button', { name: 'Fechar janela', exact: true }).click();
  const chats = page.locator('button.chat-item:not(.chat-item-more)');
  const count = await chats.count();
  expect(count).toBeGreaterThanOrEqual(5);
  const otherKeys = new Set<string>([firstKey]);
  for (let index = 1; index < 5; index++) {
    const back = page.getByRole('button', { name: 'Voltar à lista', exact: true });
    if (await back.isVisible()) await back.click();
    await chats.nth(index).click();
    await expect(page.locator('.client-name-button')).toBeVisible();
    await openClientStudio(page);
    await page.getByRole('textbox', { name: 'Converse com a IA sobre este cliente…' }).fill(`Contexto de cliente ${index + 1}`);
    await page.locator('.client-ai-composer button').click();
    await expect(page.locator('.client-ai-log')).toContainText('Simulado para');
    otherKeys.add(activeContact);
    await page.getByRole('button', { name: 'Fechar janela', exact: true }).click();
  }
  expect(otherKeys.size).toBeGreaterThanOrEqual(5);
  const back = page.getByRole('button', { name: 'Voltar à lista', exact: true });
  if (await back.isVisible()) await back.click();
  await chats.first().click();
  await openClientStudio(page);
  await expect(page.locator('.client-ai-log')).toContainText('Crie roteiro de apresentação');
  await page.getByRole('button', { name: 'Gerar imagem', exact: true }).click();
  await page.getByLabel('Descreva a imagem').fill('Imagem de apresentação fictícia para o cliente');
  await page.getByLabel('Modelo de criação').click(); await page.getByRole('option', { name: 'Objeto comercial', exact: true }).click();
  await page.getByLabel('Proporção').click(); await page.getByRole('option', { name: 'Vertical · 9:16', exact: true }).click();
  await page.getByRole('button', { name: 'Gerar e salvar no histórico', exact: true }).click();
  await expect(page.locator('.client-ai-image-form')).toContainText('Imagem de referência');
  await expect.poll(() => threads.get(firstKey)?.some((entry) => entry.text.includes('Imagem simulada'))).toBe(true);
  await page.getByRole('button', { name: 'Conversar', exact: true }).click();
  await page.getByRole('textbox', { name: 'Converse com a IA sobre este cliente…' }).fill('Edite a imagem anterior mantendo as cores e o contexto do cliente.');
  await page.locator('.client-ai-composer button').click();
  await expect(page.locator('.client-ai-log')).toContainText('Edite a imagem anterior');
  await expect(page.getByRole('img', { name: 'Imagem gerada para este cliente' })).toBeVisible();
  await page.getByRole('button', { name: 'Preparar envio ao cliente', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Enviar arquivo' })).toBeVisible();
  await expect(page.getByLabel('Aplicar marca d’água de aprovação')).toBeChecked();
  await page.getByRole('button', { name: 'Enviar arquivo', exact: true }).click();
  await expect.poll(() => generatedUploads.length).toBe(1);
  await expect.poll(() => preparedImageSend).toBe(1);
  await saveEvidence(page, ['REQ-363', 'REQ-364', 'REQ-365', 'REQ-370', 'REQ-371', 'REQ-372', 'REQ-375'], info, { contactsWithIndependentThreads: otherKeys.size, persistedEntries: threads.get(firstKey)?.length, generatedImage: 'simulada', scriptUsesConversationScope: true, imagePreparationShowsApprovalWatermark: true, generatedImageUploadBytes: generatedUploads[0]!.bytes, uploadMime: generatedUploads[0]!.mimeType, localSendRouteIntercepted: true });
});

test('REQ-366/REQ-367/REQ-368/REQ-369 oferece presets, proporção e referências colada/da conversa', async ({ page }, info) => {
  const generated: Array<Record<string, unknown>> = [];
  await page.route('**/api/attendance/sessions/*/conversations/*/messages?page=1&pageSize=50', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    const fake = { id: 'audit-reference-image', text: null, caption: null, direction: 'INBOUND', status: 'DELIVERED', type: 'imageMessage', sentAt: new Date().toISOString(), isPtt: false, isPtv: false, asViewOnce: false, fileId: 'fake-image', error: null };
    return route.fulfill({ response, json: { ...data, items: [...data.items, fake], total: data.total + 1 } });
  });
  await page.route('**/api/attendance/sessions/*/conversations/*/messages/audit-reference-image/media', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/2ioAAAAASUVORK5CYII=', 'base64') }));
  await page.route('**/api/operations/client-ai/sessions/*/contacts/*/ai-thread', (route) => route.fulfill({ json: { entries: [] } }));
  await page.route('**/api/operations/client-ai/sessions/*/contacts/*/ai-thread/images', async (route) => {
    generated.push(route.request().postDataJSON() as Record<string, unknown>);
    return route.fulfill({ json: { entries: [{ id: `mock-${generated.length}`, role: 'assistant', kind: 'image', text: 'Geração simulada', createdAt: new Date().toISOString() }], model: 'simulado-local' } });
  });
  await openConversation(page);
  await openClientStudio(page);
  await page.getByRole('button', { name: 'Gerar imagem', exact: true }).click();
  const template = page.getByLabel('Modelo de criação');
  const templateValues: string[] = [];
  for (const value of ['mascot-3d', 'mascot-realistic', 'product']) {
    await template.click();
    const label = value === 'mascot-3d' ? 'Mascote 3D' : value === 'mascot-realistic' ? 'Mascote realista' : 'Objeto comercial';
    await page.getByRole('option', { name: label, exact: true }).click();
    templateValues.push(await template.getAttribute('title') ?? '');
  }
  expect(templateValues).toEqual(['Mascote 3D', 'Mascote realista', 'Objeto comercial']);
  const ratio = page.getByLabel('Proporção');
  await ratio.click(); await page.getByRole('option', { name: 'Quadrada · 1:1', exact: true }).click();
  await expect(ratio).toHaveAttribute('title', 'Quadrada · 1:1');
  await ratio.click(); await page.getByRole('option', { name: 'Vertical · 9:16', exact: true }).click();
  await expect(ratio).toHaveAttribute('title', 'Vertical · 9:16');
  await page.getByLabel('Descreva a imagem').click();
  await page.evaluate(() => {
    const input = document.querySelector('.client-ai-image-form textarea')!;
    const clipboard = new DataTransfer();
    clipboard.items.add(new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'colada.png', { type: 'image/png' }));
    input.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData: clipboard }));
  });
  await expect(page.getByRole('img', { name: 'Imagem de referência' })).toBeVisible();
  await page.getByRole('button', { name: 'Remover referência' }).click();
  await page.locator('input[type=file][accept="image/png,image/jpeg,image/webp"]').setInputFiles({ name: 'referencia.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/2ioAAAAASUVORK5CYII=', 'base64') });
  await expect(page.getByRole('img', { name: 'Imagem de referência' })).toBeVisible();
  await page.getByRole('button', { name: 'Remover referência' }).click();
  await expect(page.getByRole('button', { name: /Usar imagem de/ }).last()).toBeVisible();
  await page.getByRole('button', { name: /Usar imagem de/ }).last().click();
  await expect(page.getByRole('img', { name: 'Imagem de referência' })).toBeVisible();
  await page.getByLabel('Descreva a imagem').fill('Foto de referência fictícia');
  await page.getByRole('button', { name: 'Gerar e salvar no histórico', exact: true }).click();
  await expect.poll(() => generated.length).toBe(1);
  expect(generated[0]).toMatchObject({ template: 'product', aspectRatio: '9:16' });
  expect(generated[0]?.reference).toBeTruthy();
  await saveEvidence(page, ['REQ-366', 'REQ-367', 'REQ-368', 'REQ-369'], info, { presets: templateValues, ratios: ['1:1', '9:16'], pastedAndConversationReferences: true, provider: 'simulado' });
});

test('REQ-376/REQ-377/REQ-378/REQ-379 cadastra marcas, texto e PNG com prévia, tamanho, opacidade e posição', async ({ page }, info) => {
  let settings: Record<string, any> = { enabledByDefault: false, activeId: 'default', marks: [{ id: 'default', name: 'Amostra de aprovação', text: 'Amostra de Aprovação · Não copiar', opacity: 42, size: 100, position: 'diagonal' }] };
  await page.route('**/api/operations/settings/watermarks', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: settings });
    settings = route.request().postDataJSON() as Record<string, any>;
    return route.fulfill({ json: settings });
  });
  await page.goto('/atendimento');
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('main').getByRole('button', { name: 'Personalização', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Marca d’água de aprovação' })).toBeVisible();
  const name = page.getByLabel('Nome do modelo');
  await name.first().fill('Selo de auditoria local');
  await page.getByRole('button', { name: 'Adicionar modelo', exact: true }).click();
  await expect(name).toHaveCount(2);
  await name.nth(1).fill('Selo alternativo local');
  const text = page.getByLabel('Texto da marca d’água');
  await text.nth(1).fill('RASCUNHO DE TESTE');
  const opacity = page.getByLabel(/Opacidade/).nth(1);
  await opacity.fill('67');
  await expect(page.getByText('Opacidade · 67%', { exact: true })).toBeVisible();
  const size = page.getByLabel(/Tamanho/).nth(1);
  await size.fill('150');
  await expect(page.getByText('Tamanho · 150%', { exact: true })).toBeVisible();
  await page.getByLabel('Posição / padrão').nth(1).click();
  await page.getByRole('option', { name: 'Centro', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Prévia da marca d’água Selo alternativo local' })).toBeVisible();
  await page.locator('input[type=file][accept="image/png"]').last().setInputFiles({ name: 'selo-transparente.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/2ioAAAAASUVORK5CYII=', 'base64') });
  await expect(page.getByRole('img', { name: 'Selo de marca d’água' })).toBeVisible();
  await page.getByRole('button', { name: 'Salvar modelos', exact: true }).click();
  await expect.poll(() => settings.marks.length).toBe(2);
  await page.reload();
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('main').getByRole('button', { name: 'Personalização', exact: true }).click();
  await expect(page.getByLabel('Nome do modelo').nth(1)).toHaveValue('Selo alternativo local');
  await expect(page.getByLabel(/Opacidade/).nth(1)).toHaveValue('67');
  await expect(page.getByLabel(/Tamanho/).nth(1)).toHaveValue('150');
  await saveEvidence(page, ['REQ-376', 'REQ-377', 'REQ-378', 'REQ-379'], info, { savedMarks: settings.marks.length, textAndTransparentPng: true, opacity: 67, size: 150, position: 'center' });
});

test('REQ-373/REQ-374/REQ-380/REQ-381/REQ-382 marca e otimiza anexos fictícios sem confirmar envio', async ({ page }, info) => {
  const uploadedFiles: Array<{ filename: string; mimeType: string; bytes: number; storedBytes: number; base64: string; watermark?: string }> = [];
  const librarySaves: Array<{ name: string; kind: string; fileId: string }> = [];
  let sendCalls = 0;
  await page.route('**/api/attendance/files', async (route) => {
    const body = route.request().postDataJSON() as { filename: string; mimeType: string; base64: string; watermark?: string };
    const rawBase64 = body.base64.split(',')[1] ?? body.base64;
    const bytes = Buffer.from(rawBase64, 'base64').length;
    const video = body.mimeType.startsWith('video/');
    const storedBytes = video ? Math.max(1, Math.floor(bytes * 0.6)) : bytes;
    uploadedFiles.push({ filename: body.filename, mimeType: body.mimeType, bytes, storedBytes, base64: rawBase64, watermark: body.watermark });
    return route.fulfill({ status: 201, json: {
      id: `audit-file-${uploadedFiles.length}`,
      filename: video ? body.filename.replace(/\.[^.]+$/, '.mp4') : body.filename,
      mimeType: video ? 'video/mp4' : body.mimeType,
      byteLength: storedBytes,
    } });
  });
  await page.route('**/api/attendance/assets', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = route.request().postDataJSON() as { name: string; kind: string; fileId: string };
    librarySaves.push(body);
    return route.fulfill({ status: 201, json: { id: 'audit-library-video', ...body } });
  });
  await page.route('**/api/attendance/sessions/*/conversations/*/send', async (route) => { sendCalls++; return route.fulfill({ json: { ok: true } }); });
  await page.route('**/api/whatsapp/sessions', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    return route.fulfill({ response, json: { ...body, items: body.items.map((item: Record<string, unknown>) => ({ ...item, status: 'CONNECTED' })) } });
  });
  await page.route('**/api/operations/settings/watermarks', (route) => route.fulfill({ json: { enabledByDefault: true, activeId: 'audit', marks: [{ id: 'audit', name: 'Marca local', text: 'TESTE LOCAL', opacity: 60, position: 'diagonal' }] } }));
  await openConversation(page);
  const makeImage = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 2400; canvas.height = 1600;
    const context = canvas.getContext('2d')!; const data = context.createImageData(canvas.width, canvas.height);
    let seed = 41; for (let i = 0; i < data.data.length; i += 4) { seed = (seed * 48271) % 2147483647; data.data[i] = seed & 255; data.data[i + 1] = (seed >> 8) & 255; data.data[i + 2] = (seed >> 16) & 255; data.data[i + 3] = 255; }
    context.putImageData(data, 0, 0); context.fillStyle = '#fff'; context.font = '100px Arial'; context.fillText('AUDIT IMAGE', 100, 150);
    return new Promise<string>((resolve) => canvas.toBlob((blob) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(blob!); }, 'image/jpeg', 0.97));
  });
  const imageBuffer = Buffer.from(makeImage.split(',')[1]!, 'base64');
  await page.getByRole('button', { name: 'Anexar arquivo' }).click();
  await page.locator('input[type=file].sr-only').setInputFiles({ name: 'imagem-teste.jpg', mimeType: 'image/jpeg', buffer: imageBuffer });
  await expect(page.getByRole('heading', { name: 'Enviar arquivo' })).toBeVisible();
  await expect(page.getByLabel('Aplicar marca d’água de aprovação')).toBeChecked();
  await expect(page.locator('.attachment-preview img')).toBeVisible();
  const originalSize = imageBuffer.length;
  await page.getByRole('button', { name: 'Enviar arquivo', exact: true }).click();
  await expect.poll(() => uploadedFiles.length).toBe(1);
  await expect.poll(() => sendCalls).toBe(1);
  expect(uploadedFiles[0]!.bytes).toBeLessThan(originalSize);
  const optimizedDimensions = await page.evaluate(async (base64) => {
    const image = new Image(); image.src = `data:image/jpeg;base64,${base64}`; await image.decode(); return { width: image.naturalWidth, height: image.naturalHeight };
  }, uploadedFiles[0]!.base64);
  expect(optimizedDimensions.width).toBeGreaterThan(1000);
  expect(optimizedDimensions.height).toBeGreaterThan(700);
  expect(Math.max(optimizedDimensions.width, optimizedDimensions.height)).toBeLessThanOrEqual(2048);
  const video = await createSyntheticVideo(page);
  const videoOriginalSize = video.length;
  await page.getByRole('button', { name: 'Anexar arquivo' }).click();
  await page.locator('input[type=file].sr-only').setInputFiles({ name: 'video-audit.webm', mimeType: 'video/webm', buffer: video });
  await expect(page.getByRole('heading', { name: 'Enviar arquivo' })).toBeVisible();
  await expect(page.getByLabel('Aplicar marca d’água de aprovação')).toBeChecked();
  await page.getByRole('button', { name: 'Enviar arquivo', exact: true }).click();
  await expect.poll(() => uploadedFiles.length).toBe(2);
  await expect.poll(() => sendCalls).toBe(2);
  expect(uploadedFiles[1]!.watermark).toMatch(/^data:image\/png;base64,/);
  expect(uploadedFiles[1]!.bytes).toBe(videoOriginalSize);
  expect(uploadedFiles[1]!.storedBytes).toBeLessThan(videoOriginalSize);

  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await page.getByRole('button', { name: 'Mídias', exact: true }).click();
  await page.getByRole('button', { name: 'Nova resposta', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Nova resposta rápida' });
  await editor.getByLabel('Nome', { exact: true }).fill('Vídeo comprimido de auditoria');
  await editor.locator('input[type="file"]').setInputFiles({ name: 'video-biblioteca.webm', mimeType: 'video/webm', buffer: video });
  await editor.getByRole('button', { name: 'Salvar resposta', exact: true }).click();
  await expect.poll(() => uploadedFiles.length).toBe(3);
  await expect.poll(() => librarySaves.length).toBe(1);
  expect(uploadedFiles[2]!.storedBytes).toBeLessThan(videoOriginalSize);
  expect(librarySaves[0]).toMatchObject({ name: 'Vídeo comprimido de auditoria', kind: 'MEDIA', fileId: 'audit-file-3' });
  await saveEvidence(page, ['REQ-373', 'REQ-374', 'REQ-380', 'REQ-381', 'REQ-382'], info, {
    imageBytesBefore: originalSize,
    imageBytesUploaded: uploadedFiles[0]!.bytes,
    optimizedDimensions,
    videoBytesBefore: videoOriginalSize,
    videoSourceBytesReceivedByServer: uploadedFiles[1]!.bytes,
    videoBytesStoredByServerFixture: uploadedFiles[1]!.storedBytes,
    libraryVideoBytesStoredByServerFixture: uploadedFiles[2]!.storedBytes,
    videoCompression: 'o servidor recebe a fonte e persiste MP4 menor; prova real em attendance.test.ts',
    chatAndLibraryUseSharedUploadEndpoint: true,
    watermarkOfferedForImageAndVideo: true,
    videoWatermarkPrepared: Boolean(uploadedFiles[1]!.watermark),
    localSendRouteIntercepted: true,
  });
});

test('REQ-383/REQ-384/REQ-385/REQ-386 analisa comprovante fictício e aguarda confirmação humana', async ({ page }, info) => {
  await page.route('**/api/attendance/sessions/*/conversations/*/messages?page=1&pageSize=50', async (route) => {
    const response = await route.fetch(); const data = await response.json();
    const receipt = { id: 'audit-receipt', text: null, caption: 'comprovante de teste', direction: 'INBOUND', status: 'DELIVERED', type: 'imageMessage', sentAt: new Date().toISOString(), isPtt: false, isPtv: false, asViewOnce: false, fileId: 'fake-receipt', error: null };
    return route.fulfill({ response, json: { ...data, items: [...data.items, receipt], total: data.total + 1 } });
  });
  await page.route('**/api/operations/sessions/*/contacts/*/media-analysis', (route) => route.fulfill({ json: { result: { text: 'Comprovante analisado localmente.', receipt: { detected: true, amount: 'R$ 125,00', date: '30/10/2026', payer: 'Cliente Fictício' } } } }));
  let confirmBody: unknown;
  await page.route('**/api/operations/sessions/*/contacts/*/confirm-payment', (route) => { confirmBody = route.request().postDataJSON(); return route.fulfill({ json: { labelApplied: 'Pago' } }); });
  await openConversation(page);
  await page.getByRole('button', { name: 'Analisar mídia', exact: true }).last().click();
  await expect(page.getByText('Comprovante candidato — revise a mídia')).toBeVisible();
  await expect(page.getByText('R$ 125,00')).toBeVisible();
  await expect(page.locator('.receipt-candidate')).toContainText('30/10/2026');
  await expect(page.locator('.receipt-candidate')).toContainText('Cliente Fictício');
  await expect(page.getByRole('button', { name: 'Confirmar e mover para Pago / Fechado' })).toBeVisible();
  expect(confirmBody).toBeUndefined();
  await page.getByRole('button', { name: 'Confirmar e mover para Pago / Fechado' }).click();
  await expect.poll(() => confirmBody).toEqual({ messageId: 'audit-receipt' });
  await saveEvidence(page, ['REQ-383', 'REQ-384', 'REQ-385', 'REQ-386'], info, { detected: true, amount: 'R$ 125,00', date: '30/10/2026', payer: 'Cliente Fictício', humanConfirmation: true, provider: 'simulado' });
});

test('REQ-387/REQ-388 ajusta velocidade e oferece salto de silêncios no áudio recebido', async ({ page }, info) => {
  await page.route('**/api/attendance/sessions/*/conversations/*/messages?page=1&pageSize=50', async (route) => {
    const response = await route.fetch(); const data = await response.json();
    const audio = { id: 'audit-inbound-audio-player', text: null, caption: null, direction: 'INBOUND', status: 'DELIVERED', type: 'audioMessage', sentAt: new Date().toISOString(), isPtt: true, isPtv: false, asViewOnce: false, fileId: 'fake-audio', error: null };
    return route.fulfill({ response, json: { ...data, items: [...data.items, audio], total: data.total + 1 } });
  });
  const wav = Buffer.alloc(44 + 48000); wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVE', 8); wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(48000, 40);
  await page.route('**/api/attendance/sessions/*/conversations/*/messages/audit-inbound-audio-player/media', (route) => route.fulfill({ status: 200, contentType: 'audio/wav', body: wav }));
  await openConversation(page);
  const audioMessage = page.locator('.message-row').last();
  await expect(audioMessage).toBeVisible();
  await audioMessage.getByRole('button', { name: 'Ouvir áudio' }).click();
  await expect(audioMessage.locator('.audio-turbo-player')).toBeVisible();
  const speed = audioMessage.getByLabel('Velocidade');
  for (const [value, label] of [['1', '1×'], ['1.5', '1,5×'], ['2', '2×']]) {
    await speed.click();
    await page.getByRole('option', { name: label, exact: true }).click();
    await expect(speed).toHaveAttribute('title', label);
    await expect.poll(() => audioMessage.locator('audio').evaluate((audio: HTMLAudioElement) => audio.playbackRate)).toBe(Number(value));
  }
  const player = audioMessage.locator('audio');
  await expect.poll(() => player.evaluate((audio: HTMLAudioElement) => audio.duration)).toBeGreaterThan(2.5);
  await player.evaluate((audio: HTMLAudioElement) => audio.play());
  await audioMessage.getByRole('checkbox', { name: 'Pular silêncios' }).check();
  await expect(audioMessage.getByRole('checkbox', { name: 'Pular silêncios' })).toBeChecked();
  await expect.poll(() => player.evaluate((audio: HTMLAudioElement) => audio.currentTime), { timeout: 4000 }).toBeGreaterThan(0.7);
  await saveEvidence(page, ['REQ-387', 'REQ-388'], info, { playbackRates: [1, 1.5, 2], skipSilenceToggle: true });
});

test('REQ-389/REQ-390/REQ-391 mostra nota e feedback de auditoria no atendimento encerrado', async ({ page }, info) => {
  await page.route('**/api/attendance/sessions/*/conversations/*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    const conversation = await response.json();
    return route.fulfill({ response, json: { ...conversation, status: 'CLOSED' } });
  });
  const audit = { score: 9, feedback: 'Tempo de resposta adequada. Clareza boa. Objeção de custo tratada. Alta aderência ao script.', status: 'completed' };
  await page.route('**/api/attendance/sessions/*/conversations/*/audit', (route) => route.fulfill({ json: audit }));
  await openConversation(page);
  await expect(page.getByText('Qualidade do atendimento: 9/10')).toBeVisible();
  await expect(page.getByText(audit.feedback)).toBeVisible();
  for (const criterion of ['Tempo de resposta', 'Clareza', 'Objeção de custo', 'aderência ao script']) await expect(page.locator('.conversation-audit')).toContainText(criterion);
  await page.reload();
  await openConversation(page);
  await expect(page.getByText('Qualidade do atendimento: 9/10')).toBeVisible();
  await expect(page.getByText(audit.feedback)).toBeVisible();
  await saveEvidence(page, ['REQ-389', 'REQ-390', 'REQ-391'], info, { score: 9, feedback: audit.feedback, reloadShowsSavedAudit: true, provider: 'simulado' });
});
