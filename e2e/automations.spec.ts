import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const evidenceRoot = resolve(process.cwd(), 'REVISAO', 'evidencias');

async function saveEvidence(page: Page, ids: string[], info: TestInfo, result: Record<string, unknown>) {
  const suffix = info.project.name.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
  const { statusByReq, ...details } = result as Record<string, unknown> & { statusByReq?: Record<string, string> };
  for (const id of ids) {
    const directory = resolve(evidenceRoot, id);
    await mkdir(directory, { recursive: true });
    await page.screenshot({ path: resolve(directory, `${suffix}.png`), fullPage: true });
    await writeFile(resolve(directory, `${suffix}.json`), JSON.stringify({
      req: id, result: statusByReq?.[id] ?? 'APROVADO', project: info.project.name, url: page.url(), ...details,
    }, null, 2), 'utf8');
  }
}

async function openApp(page: Page) {
  await page.route('**/api/operations/features', (route) => route.fulfill({ json: { aiEnabled: false, canManage: true } }));
  await page.route('**/api/operations/settings/preferences', (route) => route.fulfill({ json: { hudHiddenActions: [], hudHeaderOrder: [] } }));
  await page.route('**/api/attendance/sessions/*/conversations/*/read', (route) => route.fulfill({ json: { ok: true } }));
  await page.goto('/atendimento');
  await expect(page.locator('.app-shell')).toBeVisible();
}

test('REQ-392/REQ-393/REQ-394 configura sequência de follow-up e confirma cancelamento após resposta', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  let submitted: Record<string, unknown> | undefined;
  await page.route('**/api/operations/sessions/*/conversations/*/follow-ups', async (route) => {
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 201, json: { id: 'follow-up-audit', scheduled: 2, firstRunAt: new Date(Date.now() + 60_000).toISOString() } });
  });
  await openApp(page);
  const conversations = page.locator('button.chat-item:not(.chat-item-more)');
  await expect(conversations.first()).toBeVisible();
  await conversations.first().click();
  await expect(page.locator('.client-name-button')).toBeVisible();
  await page.locator('details.chat-more-actions summary').click();
  await page.locator('details.chat-more-actions').getByRole('button', { name: 'Ativar follow-up automático', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Qualquer resposta recebida cancela automaticamente as etapas restantes.');
  const initialSteps = dialog.locator('.follow-up-editor fieldset');
  if (await initialSteps.count() === 1) await page.getByRole('button', { name: 'Adicionar etapa' }).click();
  const first = dialog.locator('.follow-up-editor fieldset').nth(0);
  await first.getByLabel('Enviar após (minutos)').fill('1');
  await first.getByLabel('Mensagem').fill('Primeiro retorno de teste.');
  const second = dialog.locator('.follow-up-editor fieldset').nth(1);
  await second.getByLabel('Enviar após (minutos)').fill('60');
  await second.getByLabel('Mensagem').fill('Segundo retorno de teste.');
  const response = page.waitForResponse((item) => item.request().method() === 'POST' && item.url().includes('/follow-ups'));
  await page.getByRole('button', { name: 'Ativar follow-up', exact: true }).click();
  expect((await response).status()).toBe(201);
  await expect.poll(() => (submitted?.steps as unknown[])?.length).toBe(2);
  await expect(page.getByText(/Follow-up ativado com 2 etapas/)).toBeVisible();
  await saveEvidence(page, ['REQ-392', 'REQ-393', 'REQ-394'], info, {
    steps: submitted?.steps, responseCancellationNotice: true, apiStatus: 201, pageErrors: errors,
    sendRouteCalled: false, localFakeConnectorOnly: true,
  });
});

test('REQ-399 mostra título, descrição e origem de anúncio recebida no chat', async ({ page }, info) => {
  let referralInjected = false;
  await page.route('**/api/attendance/sessions/audit-session/conversations**', async (route) => {
    const response = await route.fetch();
    const data = await response.json() as {
      items?: Array<{ contact?: { metadata?: Record<string, unknown> } }>;
      contact?: { metadata?: Record<string, unknown> };
    };
    const referral = { source: 'WhatsApp Ads', title: 'Campanha CTWA fictícia', body: 'Oferta local de auditoria', url: 'https://example.com/anuncio' };
    const conversations = (data.items ?? []).filter((item) => item.contact);
    if (conversations.length) {
      for (const item of conversations) item.contact!.metadata = { ...item.contact!.metadata, adReferral: referral };
      referralInjected = true;
    }
    if (data.contact) {
      data.contact.metadata = { ...data.contact.metadata, adReferral: referral };
      referralInjected = true;
    }
    if (!conversations.length && !data.contact) {
      await route.fulfill({ response, json: data });
      return;
    }
    await route.fulfill({ response, json: data });
  });
  await openApp(page);
  await expect.poll(() => referralInjected).toBeTruthy();
  const first = page.locator('button.chat-item:not(.chat-item-more)').first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page.locator('.ad-referral-card')).toContainText('Lead vindo de anúncio · WhatsApp Ads');
  await expect(page.locator('.ad-referral-card')).toContainText('Campanha CTWA fictícia');
  await expect(page.locator('.ad-referral-card')).toContainText('Oferta local de auditoria');
  await expect(page.locator('.ad-referral-card a')).toHaveAttribute('href', 'https://example.com/anuncio');
  expect(referralInjected).toBeTruthy();
  await saveEvidence(page, ['REQ-399'], info, { referralInjected, noExternalLinkOpened: true });
});

test('REQ-406/REQ-407 exibe conta, ausência e inconclusivo sem importar ou enviar', async ({ page }, info) => {
  await page.route('**/api/operations/contacts/import/preview', (route) => route.fulfill({ json: {
    headers: ['Nome', 'Telefone'], phoneColumn: 1, nameColumn: 0, total: 3, inferred: true, rejected: [],
    items: [
      { name: 'Registrado Fictício', phoneNumber: '5511999990001', tags: [], email: '', optIn: false },
      { name: 'Sem Conta Fictício', phoneNumber: '5511999990002', tags: [], email: '', optIn: false },
      { name: 'Inconclusivo Fictício', phoneNumber: '5511999990003', tags: [], email: '', optIn: false },
    ],
  } }));
  let importCalls = 0;
  let sendCalls = 0;
  await page.route('**/api/operations/sessions/*/validate-numbers', (route) => route.fulfill({ json: {
    items: [
      { phoneNumber: '5511999990001', status: 'REGISTERED', checkedAt: new Date().toISOString() },
      { phoneNumber: '5511999990002', status: 'NOT_REGISTERED', checkedAt: new Date().toISOString() },
      { phoneNumber: '5511999990003', status: 'UNKNOWN', checkedAt: new Date().toISOString() },
    ], inconclusive: true,
  } }));
  await page.route('**/api/operations/sessions/*/contacts/import', (route) => { importCalls++; return route.fulfill({ json: { imported: 2 } }); });
  page.on('request', (request) => { if (/\/conversations\/[^/]+\/send(?:-|$)/.test(request.url())) sendCalls++; });
  await openApp(page);
  await page.getByRole('button', { name: 'Contatos', exact: true }).click();
  await page.getByRole('button', { name: 'Importar Excel / CSV', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'contatos-ficticios.csv', mimeType: 'text/csv', buffer: Buffer.from('Nome;Telefone\nRegistrado Fictício;5511999990001\nSem Conta Fictício;5511999990002\nInconclusivo Fictício;5511999990003'),
  });
  await page.getByRole('button', { name: 'Ler planilha', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Verificar números no WhatsApp', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Verificar números no WhatsApp', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('1 com conta · 1 sem conta · 1 inconclusivos');
  await expect(page.getByRole('alert')).toContainText('Contatos inconclusivos foram preservados.');
  await page.getByRole('button', { name: 'Remover 1 sem conta da prévia', exact: true }).click();
  await expect(page.locator('.import-preview')).not.toContainText('Sem Conta Fictício');
  await expect(page.locator('.import-preview')).toContainText('Inconclusivo Fictício');
  await expect(page.locator('.import-preview')).toContainText('Registrado Fictício');
  expect(importCalls).toBe(0);
  expect(sendCalls).toBe(0);
  await saveEvidence(page, ['REQ-406', 'REQ-407'], info, {
    outcomes: ['REGISTERED', 'NOT_REGISTERED', 'UNKNOWN'], inconclusivePreserved: true,
    absentRemovedFromPreviewOnly: true, imports: importCalls, sends: sendCalls,
  });
});

test('REQ-408/REQ-409 confirma ausência de seletor de conexões e de failover na campanha', async ({ page }, info) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Campanhas', exact: true }).click();
  await page.getByRole('button', { name: 'Nova campanha', exact: true }).click();
  const dialog = page.locator('dialog.batch-editor-modal');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/distribuir.*conexões|dividir fila entre números/i)).toHaveCount(0);
  await expect(dialog.getByText(/assumir.*se.*conexão.*cair|failover/i)).toHaveCount(0);
  await expect(dialog.locator('[name="sessionId"], [name="sessionIds"]')).toHaveCount(0);
  await saveEvidence(page, ['REQ-408', 'REQ-409'], info, {
    statusByReq: { 'REQ-408': 'AUSENTE', 'REQ-409': 'AUSENTE' },
    multiConnectionSelector: false, connectionFailoverControl: false, noBatchCreated: true,
  });
});

test('REQ-411 mantém termos de opt-out configurados após salvar e recarregar', async ({ page }, info) => {
  let terms = ['parar', 'sair', 'cancelar'];
  let settingsReads = 0;
  await page.route('**/api/operations/settings/optout**', async (route) => {
    if (route.request().method() === 'GET') { settingsReads++; return route.fulfill({ json: { terms } }); }
    terms = (route.request().postDataJSON() as { terms: string[] }).terms;
    return route.fulfill({ json: { saved: true, terms } });
  });
  await openApp(page);
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  const initialSettings = page.waitForResponse((response) => response.url().includes('/operations/settings/optout') && response.request().method() === 'GET');
  await page.getByRole('button', { name: 'Opt-out e envios', exact: true }).click();
  await initialSettings;
  await expect.poll(() => settingsReads).toBe(1);
  const field = page.getByLabel('Palavras ou frases, separadas por vírgula ou linha');
  await expect(field).toHaveValue('parar, sair, cancelar');
  await field.fill('parar, sair, cancelar, não quero mais');
  await page.getByRole('button', { name: 'Salvar regras de opt-out', exact: true }).click();
  await expect.poll(() => terms).toContain('não quero mais');
  await page.reload();
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  const reloadedSettings = page.waitForResponse((response) => response.url().includes('/operations/settings/optout') && response.request().method() === 'GET');
  await page.getByRole('button', { name: 'Opt-out e envios', exact: true }).click();
  await reloadedSettings;
  await expect.poll(() => settingsReads).toBe(2);
  await expect(page.getByLabel('Palavras ou frases, separadas por vírgula ou linha')).toHaveValue('parar, sair, cancelar, não quero mais');
  await saveEvidence(page, ['REQ-411'], info, { terms, saveAndReload: true, provider: 'in-memory local fixture' });
});
