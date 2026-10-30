import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const api = 'http://127.0.0.1:3340/api';
const evidenceRoot = resolve(process.cwd(), 'REVISAO', 'evidencias');

test.describe.configure({ mode: 'serial' });

async function openApp(page: Page) {
  await page.goto('/atendimento');
  await expect(page.getByRole('button', { name: 'Atendimento', exact: false }).first()).toBeVisible();
}

async function openSettings(page: Page, tab: string) {
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();
  await page.getByRole('button', { name: tab, exact: true }).click();
}

async function waitPreference(page: Page, action: () => Promise<void>) {
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/operations/settings/preferences') &&
      response.request().method() === 'PUT' &&
      response.ok(),
  );
  await action();
  await saved;
}

async function saveEvidence(page: Page, id: string, info: TestInfo, result: Record<string, unknown> = {}) {
  const directory = resolve(evidenceRoot, id);
  await mkdir(directory, { recursive: true });
  const suffix = info.project.name.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
  await page.screenshot({ path: resolve(directory, `${suffix}.png`), fullPage: true });
  await writeFile(
    resolve(directory, `${suffix}.json`),
    JSON.stringify(
      {
        req: id,
        result: 'APROVADO',
        project: info.project.name,
        viewport: info.project.use.viewport,
        url: page.url(),
        ...result,
      },
      null,
      2,
    ),
    'utf8',
  );
}

async function selectFirstConversation(page: Page) {
  await page.locator('button.chat-item:not(.chat-item-more)').first().click();
  await expect(page.locator('.client-name-button')).toBeVisible();
}

async function chooseOption(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

async function openContactInfo(page: Page) {
  await page.locator('.client-name-button').click();
  await expect(page.getByText('Informações do cliente', { exact: true })).toBeVisible();
}

test('REQ-103 menu lateral reordenado persiste após recarregar', async ({ page }, info) => {
  await openApp(page);
  await openSettings(page, 'Menu e atalhos');
  const list = page.getByRole('list', { name: 'Ordem dos grupos' });
  const before = await list.locator('li').allTextContents();
  const index = before.findIndex((value) => value.includes('Mensageria'));
  const action = index === 0 ? 'Descer Mensageria' : 'Subir Mensageria';
  await waitPreference(page, async () => page.getByRole('button', { name: action }).click());
  const expected = await list.locator('li').allTextContents();
  expect(expected).not.toEqual(before);
  await page.reload();
  await openSettings(page, 'Menu e atalhos');
  await expect(page.getByRole('list', { name: 'Ordem dos grupos' }).locator('li')).toHaveText(expected);
  await saveEvidence(page, 'REQ-103', info, { before, after: expected });
});

test('REQ-104 perfil do operador salva e permanece após recarregar', async ({ page }, info) => {
  await openApp(page);
  await openSettings(page, 'Meu perfil');
  const name = `Operador ${info.project.name}`;
  const company = `Empresa ${info.project.name}`;
  await page.getByLabel('Nome', { exact: true }).fill(name);
  await page.getByLabel('Empresa', { exact: true }).fill(company);
  const saved = page.waitForResponse(
    (response) => response.url().endsWith('/api/operations/me') && response.request().method() === 'PUT' && response.ok(),
  );
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  await saved;
  await page.reload();
  await openSettings(page, 'Meu perfil');
  await expect(page.getByLabel('Nome', { exact: true })).toHaveValue(name);
  await expect(page.getByLabel('Empresa', { exact: true })).toHaveValue(company);
  await saveEvidence(page, 'REQ-104', info, { name, company });
});

test('REQ-105 privacidade visual aplica classe e persiste após recarregar', async ({ page }, info) => {
  await openApp(page);
  await openSettings(page, 'Privacidade');
  const control = page.getByLabel('Ocultar nomes dos contatos');
  if (await control.isChecked())
    await waitPreference(page, async () => control.uncheck());
  await waitPreference(page, async () => control.check());
  await expect(page.locator('html')).toHaveClass(/private-names/);
  await page.reload();
  await openSettings(page, 'Privacidade');
  await expect(page.getByLabel('Ocultar nomes dos contatos')).toBeChecked();
  await expect(page.locator('html')).toHaveClass(/private-names/);
  await saveEvidence(page, 'REQ-105', info, { class: 'private-names' });
});

test('REQ-106 notificações podem ser autorizadas e a preferência persiste', async ({ page, context }, info) => {
  await context.grantPermissions(['notifications'], { origin: 'http://127.0.0.1:5180' });
  await openApp(page);
  await openSettings(page, 'Notificações');
  const control = page.getByLabel('Notificar novas mensagens neste navegador');
  if (await control.isChecked())
    await waitPreference(page, async () => control.uncheck());
  await waitPreference(page, async () => control.check());
  await page.getByRole('button', { name: 'Autorizar notificações do navegador' }).click();
  await expect(page.getByText('Notificações autorizadas.', { exact: true })).toBeVisible();
  await page.reload();
  await openSettings(page, 'Notificações');
  await expect(page.getByLabel('Notificar novas mensagens neste navegador')).toBeChecked();
  await saveEvidence(page, 'REQ-106', info, { permission: 'granted' });
});

test('REQ-107 ferramenta oculta deixa o menu e continua oculta após recarregar', async ({ page }, info) => {
  await openApp(page);
  await openSettings(page, 'Menu e atalhos');
  const control = page.getByLabel('Mostrar Campanhas');
  if (!(await control.isChecked()))
    await waitPreference(page, async () => control.check());
  await waitPreference(page, async () => control.uncheck());
  await page.reload();
  await expect(page.getByRole('button', { name: 'Campanhas', exact: true })).toHaveCount(0);
  await openSettings(page, 'Menu e atalhos');
  await expect(page.getByLabel('Mostrar Campanhas')).not.toBeChecked();
  await saveEvidence(page, 'REQ-107', info, { hidden: 'campaigns' });
});

test('REQ-108 assinatura configurada compõe o texto final enviado pela interface', async ({ page }, info) => {
  await page.route('**/api/whatsapp/sessions', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: { ...body, items: body.items.map((item: Record<string, unknown>) => ({ ...item, status: 'CONNECTED' })) } });
  });
  let payload: { text?: string } = {};
  await page.route('**/api/attendance/sessions/*/conversations/*/send', async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await openApp(page);
  await openSettings(page, 'Conversas');
  const enabled = page.getByLabel('Adicionar assinatura aos textos digitados');
  if (await enabled.isChecked())
    await waitPreference(page, async () => enabled.uncheck());
  const signature = `Equipe ${info.project.name}`;
  await waitPreference(page, async () => {
    await page.getByLabel('Assinatura', { exact: true }).fill(signature);
    await enabled.check();
  });
  await page.getByRole('button', { name: 'Atendimento', exact: false }).first().click();
  await selectFirstConversation(page);
  await page.getByRole('textbox', { name: 'Mensagem', exact: true }).fill('Texto fictício');
  await page.getByRole('button', { name: 'Enviar mensagem' }).click();
  await expect.poll(() => payload.text).toBe(`Texto fictício\n\n${signature}`);
  await saveEvidence(page, 'REQ-108', info, { text: payload.text });
});

test('REQ-109 negócio e horário salvam e permanecem após recarregar', async ({ page }, info) => {
  await openApp(page);
  await openSettings(page, 'Negócio');
  const company = `Negócio ${info.project.name}`;
  await page.getByLabel('Empresa', { exact: true }).fill(company);
  const schedule = page.getByLabel('Definir horário de atendimento de segunda a sexta');
  if (!(await schedule.isChecked())) await schedule.check();
  await page.getByLabel('Abertura').fill('09:15');
  await page.getByLabel('Fechamento').fill('17:45');
  const afterHours = page.getByLabel('Responder automaticamente ao lead fora do horário');
  if (!(await afterHours.isChecked())) await afterHours.check();
  await page.getByLabel('Mensagem fora do horário').fill('Retorno fictício no próximo horário.');
  await page.getByLabel('Encerrar conversas sem retorno do cliente após (minutos)').fill('45');
  const saved = page.waitForResponse(
    (response) => response.url().endsWith('/api/operations/settings/business') && response.request().method() === 'PUT' && response.ok(),
  );
  await page.getByRole('button', { name: 'Salvar negócio' }).click();
  await saved;
  await page.reload();
  await openSettings(page, 'Negócio');
  await expect(page.getByLabel('Empresa', { exact: true })).toHaveValue(company);
  await expect(page.getByLabel('Abertura')).toHaveValue('09:15');
  await expect(page.getByLabel('Fechamento')).toHaveValue('17:45');
  await expect(page.getByLabel('Mensagem fora do horário')).toHaveValue('Retorno fictício no próximo horário.');
  await saveEvidence(page, 'REQ-109', info, { company, schedule: '09:15-17:45' });
});

test('REQ-110 departamento criado permanece após recarregar', async ({ page }, info) => {
  await openApp(page);
  await openSettings(page, 'Departamentos');
  const name = `Auditoria ${info.project.name}`;
  await page.getByLabel('Novo departamento').fill(name);
  const saved = page.waitForResponse(
    (response) => response.url().endsWith('/api/operations/settings/departments') && response.request().method() === 'PUT' && response.ok(),
  );
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await saved;
  await page.reload();
  await openSettings(page, 'Departamentos');
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await saveEvidence(page, 'REQ-110', info, { department: name });
});

test('REQ-111 equipe privada salva o e-mail autorizado e persiste localmente', async ({ page }, info) => {
  await openApp(page);
  await openSettings(page, 'Equipe');
  const suffix = info.project.name.replaceAll(/[^a-z0-9]/gi, '').toLowerCase();
  const email = `convite-${suffix}@example.com`;
  const name = `Convidado ${info.project.name}`;
  await page.getByLabel('Nome', { exact: true }).fill(name);
  await page.getByLabel('E-mail do login').fill(email);
  await expect(page.getByRole('combobox', { name: 'Função', exact: true })).toHaveText('Atendente');
  await chooseOption(page, 'Setor', 'Suporte');
  const saved = page.waitForResponse(
    (response) => response.url().endsWith('/api/operations/team') && response.request().method() === 'PUT' && response.ok(),
  );
  await page.getByRole('button', { name: 'Salvar atendente' }).click();
  await saved;
  await page.reload();
  await openSettings(page, 'Equipe');
  await expect(page.getByText(email, { exact: false })).toBeVisible();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await saveEvidence(page, 'REQ-111', info, { email, role: 'MEMBER', department: 'Suporte' });
});

test('REQ-112 recuperação solicita o e-mail sem expor existência da conta', async ({ page }, info) => {
  const requests: Record<string, unknown>[] = [];
  await page.route('**/api/public/runtime', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authMode: 'firebase' }) });
  });
  await page.route('https://identitytoolkit.googleapis.com/**', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ email: 'recuperacao@example.com' }) });
  });
  await page.goto('/atendimento');
  await expect(page.getByRole('button', { name: 'Continuar com o Google' })).toBeVisible();
  await page.getByPlaceholder('seu@email.com').fill('recuperacao@example.com');
  await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Se este e-mail estiver cadastrado, você receberá as instruções de recuperação.',
  );
  expect(requests).toContainEqual(expect.objectContaining({ requestType: 'PASSWORD_RESET', email: 'recuperacao@example.com' }));
  await saveEvidence(page, 'REQ-112', info, { requestType: 'PASSWORD_RESET', email: 'recuperacao@example.com' });
});

test('REQ-114 perfil e negócio do contato permanecem após recarregar', async ({ page }, info) => {
  await openApp(page);
  await selectFirstConversation(page);
  await openContactInfo(page);
  const name = `Contato ${info.project.name}`;
  const email = `contato-${info.project.name.replaceAll(/[^a-z0-9]/gi, '').toLowerCase()}@example.com`;
  await page.getByLabel('Nome', { exact: true }).fill(name);
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  const saved = page.waitForResponse(
    (response) => response.url().includes('/api/operations/sessions/') && response.request().method() === 'PUT' && response.ok(),
  );
  await page.getByRole('button', { name: 'Salvar dados' }).click();
  await saved;
  await page.reload();
  await selectFirstConversation(page);
  await openContactInfo(page);
  await expect(page.getByLabel('Nome', { exact: true })).toHaveValue(name);
  await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue(email);
  await saveEvidence(page, 'REQ-114', info, { name, email });
});

test('REQ-115 anotação datada do contato permanece após recarregar', async ({ page }, info) => {
  await openApp(page);
  await selectFirstConversation(page);
  await openContactInfo(page);
  await page.getByRole('button', { name: 'Anotações', exact: true }).click();
  const note = `Anotação fictícia ${info.project.name}`;
  await page.getByLabel('Nova anotação').fill(note);
  const saved = page.waitForResponse(
    (response) => response.url().endsWith('/notes') && response.request().method() === 'POST' && response.ok(),
  );
  await page.getByRole('button', { name: 'Adicionar anotação' }).click();
  await saved;
  await page.reload();
  await selectFirstConversation(page);
  await openContactInfo(page);
  await page.getByRole('button', { name: 'Anotações', exact: true }).click();
  await expect(page.getByText(note, { exact: true })).toBeVisible();
  const noteRow = page.getByText(note, { exact: true }).locator('..');
  await expect(noteRow.locator('small')).toContainText(/\d{2}\/\d{2}\/\d{4}/);
  await saveEvidence(page, 'REQ-115', info, { note });
});

test('REQ-118 link do Google Agenda contém nome e descrição codificados', async ({ page }, info) => {
  await openApp(page);
  await selectFirstConversation(page);
  await openContactInfo(page);
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  const link = page.getByRole('link', { name: 'Preparar evento no Google Agenda' });
  const href = await link.getAttribute('href');
  expect(href).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE');
  expect(href).toContain('text=Atendimento%3A');
  expect(href).toContain('details=Retorno%20de%20atendimento%20Noctua');
  await saveEvidence(page, 'REQ-118', info, { href });
});

test('REQ-127 filtro por tipo e categoria salva o recurso escolhido no fluxo', async ({ page }, info) => {
  const organization = await page.request.put(`${api}/operations/toolbox/organization`, {
    data: {
      categories: ['Auditoria', 'Outra'],
      assignments: {
        'audit-asset-welcome': 'Auditoria',
        'audit-asset-budget': 'Outra',
        'audit-asset-document': 'Auditoria',
      },
    },
  });
  expect(organization.ok()).toBeTruthy();
  await openApp(page);
  await page.getByRole('button', { name: 'Autoatendimento', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Fluxos de conversa' })).toBeVisible();
  await page.getByRole('button', { name: 'Novo fluxo' }).click();
  const flowName = `Filtro ${info.project.name}`;
  await page.getByLabel('Nome do fluxo').fill(flowName);
  const createdResponse = page.waitForResponse(
    (response) => response.url().endsWith('/api/automation/sessions/audit-session/flows') && response.request().method() === 'POST' && response.ok(),
  );
  await page.getByRole('button', { name: 'Criar fluxo' }).click();
  const created = await (await createdResponse).json();
  await page.getByRole('button', { name: 'Mensagem', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mensagem', exact: true })).toBeVisible();
  await chooseOption(page, 'Categoria da biblioteca', 'Auditoria');
  const resources = page.getByRole('combobox', { name: 'Recurso da biblioteca', exact: true });
  await resources.click();
  await expect(page.getByRole('option')).toHaveText(['Selecione um recurso', 'Boas-vindas da auditoria']);
  await page.getByRole('option', { name: 'Boas-vindas da auditoria', exact: true }).click();
  await saveEvidence(page, 'REQ-127', info, { category: 'Auditoria', resource: 'audit-asset-welcome' });
  const saved = page.waitForResponse(
    (response) => response.url().endsWith(`/api/automation/sessions/audit-session/flows/${created.id}/draft`) && response.request().method() === 'PUT' && response.ok(),
  );
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await saved;
  await page.reload();
  const persisted = await page.request.get(`${api}/automation/sessions/audit-session/flows/${created.id}`);
  expect(persisted.ok()).toBeTruthy();
  const detail = await persisted.json();
  expect(detail.graph.nodes.some((node: { data?: { itemId?: string } }) => node.data?.itemId === 'audit-asset-welcome')).toBeTruthy();
});
