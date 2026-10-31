import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const evidenceRoot = resolve(process.cwd(), 'REVISAO', 'evidencias');

type IsolationLog = {
  blockedExternal: string[];
  blockedWrites: string[];
  consoleErrors: string[];
  pageErrors: string[];
};

async function isolateNetwork(page: Page): Promise<IsolationLog> {
  const log: IsolationLog = { blockedExternal: [], blockedWrites: [], consoleErrors: [], pageErrors: [] };
  page.on('console', message => {
    if (message.type() === 'error') log.consoleErrors.push(message.text());
  });
  page.on('pageerror', error => log.pageErrors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
      log.blockedExternal.push(url.origin);
      await route.abort();
      return;
    }
    const method = request.method().toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && (url.port === '3340' || url.pathname.startsWith('/api/'))) {
      log.blockedWrites.push(method + ' ' + url.pathname);
      const origin = request.headers().origin || url.origin;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' },
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    await route.continue();
  });
  return log;
}

async function openSandbox(page: Page) {
  await page.goto('/atendimento');
  await expect(page.locator('.app-shell')).toBeVisible();
  await page.getByRole('button', { name: 'Espaço de Teste', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Espaço de Teste' })).toBeVisible();
}

async function loadExamples(page: Page) {
  await page.getByRole('button', { name: 'Carregar dados de exemplo', exact: true }).first().click();
  await expect(page.locator('.sandbox-contacts button')).toHaveCount(6);
}

async function selectFirstContact(page: Page) {
  await page.locator('.sandbox-contacts button').first().click();
  await expect(page.getByRole('log', { name: 'Conversa fictícia' })).toBeVisible();
}

async function saveEvidence(page: Page, id: string, info: TestInfo, log: IsolationLog, result: Record<string, unknown>) {
  const directory = resolve(evidenceRoot, id);
  await mkdir(directory, { recursive: true });
  const suffix = info.project.name.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
  await page.screenshot({ path: resolve(directory, 'sandbox-' + suffix + '.png'), fullPage: true });
  await writeFile(resolve(directory, 'sandbox-' + suffix + '.json'), JSON.stringify({
    req: id,
    result: 'APROVADO',
    project: info.project.name,
    url: page.url(),
    databaseWrites: 0,
    blockedExternal: [...new Set(log.blockedExternal)],
    blockedApiWrites: log.blockedWrites,
    consoleErrors: log.consoleErrors,
    pageErrors: log.pageErrors,
    ...result,
  }, null, 2), 'utf8');
}

test('REQ-337 Espaço de Teste está disponível no menu', async ({ page }, info) => {
  const log = await isolateNetwork(page);
  await openSandbox(page);
  await expect(page.getByRole('button', { name: 'Carregar dados de exemplo', exact: true }).first()).toBeVisible();
  await saveEvidence(page, 'REQ-337', info, log, { menu: 'Espaço de Teste', opened: true });
});

test('REQ-338 Espaço de Teste funciona sem QR Code ou número real', async ({ page }, info) => {
  const log = await isolateNetwork(page);
  await openSandbox(page);
  const heading = page.locator('.sandbox-page .page-heading');
  await expect(heading).toContainText('sem QR Code');
  await expect(heading).toContainText('nenhuma mensagem real');
  await expect(heading).toContainText('dados salvos só neste navegador');
  await saveEvidence(page, 'REQ-338', info, log, { qrRequired: false, realNumberRequired: false, realMessageSent: false });
});

test('REQ-339 atendimento fictício dispara respostas do fluxo local', async ({ page }, info) => {
  const log = await isolateNetwork(page);
  await openSandbox(page);
  await loadExamples(page);
  await selectFirstContact(page);
  await page.clock.install();
  const sender = page.getByRole('combobox', { name: 'Enviar no teste como' });
  await sender.click();
  await page.getByRole('option', { name: 'Cliente fictício (testar gatilho)' }).click();
  await page.getByLabel('Mensagem no espaço de teste').fill('oi');
  await page.getByRole('button', { name: 'Enviar no teste' }).click();
  await page.clock.runFor(3200);
  const conversation = page.getByRole('log', { name: 'Conversa fictícia' });
  await expect(conversation).toContainText('Olá! Sou o assistente virtual de teste.');
  await expect(conversation).toContainText('Você quer falar sobre prazo ou orçamento?');
  await saveEvidence(page, 'REQ-339', info, log, { mode: 'Cliente fictício', localFlowReplies: 2, realMessageSent: false });
});

test('REQ-343 carrega seis clientes fictícios com mensagens de texto', async ({ page }, info) => {
  const log = await isolateNetwork(page);
  await openSandbox(page);
  await loadExamples(page);
  await selectFirstContact(page);
  await expect(page.locator('.sandbox-contacts button')).toHaveCount(6);
  await expect(page.locator('.sandbox-contacts')).toContainText('Marina Costa');
  await expect(page.getByRole('log', { name: 'Conversa fictícia' })).toContainText('Olá! Gostaria de saber o prazo e os valores do projeto.');
  await saveEvidence(page, 'REQ-343', info, log, { fictitiousContacts: 6, sampleTextVisible: true });
});

test('REQ-345 carrega foto e vídeo locais de exemplo', async ({ page }, info) => {
  const log = await isolateNetwork(page);
  await openSandbox(page);
  await loadExamples(page);
  await page.getByLabel('Seções do espaço de teste').getByRole('button', { name: 'Biblioteca e atalhos', exact: true }).click();
  const photo = page.locator('.sandbox-library article').filter({ has: page.getByRole('heading', { name: 'Prévia de projeto' }) });
  const image = photo.locator('img');
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const videoArticle = page.locator('.sandbox-library article').filter({ has: page.getByRole('heading', { name: 'Vídeo de demonstração' }) });
  const video = videoArticle.locator('video');
  await expect(video).toBeVisible();
  const mediaDiagnostics = await video.evaluate(element => ({
    src: element.currentSrc,
    readyState: element.readyState,
    errorCode: element.error?.code ?? 0,
    canPlayWebm: element.canPlayType('video/webm; codecs="vp8"'),
  }));
  await expect(video).toHaveAttribute('src', '/sandbox-media/video.webm');
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).readyState)).toBeGreaterThan(0);
  await video.scrollIntoViewIfNeeded();
  await saveEvidence(page, 'REQ-345', info, log, { imageLoaded: true, videoReadyState: await video.evaluate(element => (element as HTMLVideoElement).readyState), mediaDiagnostics });
});

test('REQ-346 carrega nota interna e conteúdo apagado fictícios', async ({ page }, info) => {
  const log = await isolateNetwork(page);
  await openSandbox(page);
  await loadExamples(page);
  await selectFirstContact(page);
  const conversation = page.getByRole('log', { name: 'Conversa fictícia' });
  await expect(conversation).toContainText('Nota interna · Modo Sussurro');
  await expect(conversation).toContainText('Só a equipe vê esta anotação.');
  await expect(conversation).toContainText('Mensagem apagada · exemplo preservado');
  await expect(conversation).toContainText('Pode enviar o orçamento?');
  await saveEvidence(page, 'REQ-346', info, log, { internalNoteVisible: true, recoveredMessageLabeledAsExample: true });
});

test('REQ-351 carrega fluxo ativo e respostas fictícias', async ({ page }, info) => {
  const log = await isolateNetwork(page);
  await openSandbox(page);
  await loadExamples(page);
  await page.getByLabel('Seções do espaço de teste').getByRole('button', { name: 'Autoatendimento', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Fluxo virtual de exemplo' })).toBeVisible();
  await expect(page.locator('.sandbox-page input[name="enabled"]')).toBeChecked();
  await expect(page.locator('.sandbox-page input[name="keyword"]')).toHaveValue('oi');
  await expect(page.locator('.sandbox-page textarea[name="answers"]')).toHaveValue('Olá! Sou o assistente virtual de teste.\nVocê quer falar sobre prazo ou orçamento?');
  await saveEvidence(page, 'REQ-351', info, log, { flowEnabled: true, trigger: 'oi', answerCount: 2 });
});

test('REQ-352 limpeza remove apenas dados fictícios e preserva outras chaves', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem('noctua:protected-real-data-audit', 'preservar'));
  const log = await isolateNetwork(page);
  await openSandbox(page);
  await loadExamples(page);
  const sandboxKey = await page.evaluate(() => Object.keys(localStorage).find(key => key.startsWith('noctua:sandbox:v1:')) || '');
  expect(sandboxKey).not.toBe('');
  await page.getByRole('button', { name: 'Limpar dados de exemplo', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Limpar apenas o Espaço de Teste?' })).toBeVisible();
  await expect(dialog).toContainText('Os dados reais do sistema permanecem preservados.');
  const directory = resolve(evidenceRoot, 'REQ-352');
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: resolve(directory, 'confirmacao-' + info.project.name + '.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Comece com um cenário de exemplo' })).toBeVisible();
  await expect.poll(() => page.evaluate(key => {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value).contacts.length : -1;
  }, sandboxKey)).toBe(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('noctua:protected-real-data-audit'))).toBe('preservar');
  await saveEvidence(page, 'REQ-352', info, log, { sandboxDataAfterClear: 0, unrelatedDataPreserved: true });
});
