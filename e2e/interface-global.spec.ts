import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const api = 'http://127.0.0.1:3340/api';
const evidenceRoot = resolve(process.cwd(), 'REVISAO', 'evidencias');
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

test.describe.configure({ mode: 'serial' });

async function openApp(page: Page) {
  await page.goto('/atendimento');
  await expect(page.locator('.app-shell')).toBeVisible();
}

async function openSettings(page: Page, tab: string) {
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: tab, exact: true }).click();
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

async function mergePreferences(page: Page, patch: Record<string, unknown>) {
  const current = await page.request.get(`${api}/operations/settings/preferences`);
  expect(current.ok()).toBeTruthy();
  const saved = await page.request.put(`${api}/operations/settings/preferences`, {
    data: { ...(await current.json()), ...patch },
  });
  expect(saved.ok()).toBeTruthy();
}

async function saveEvidence(page: Page, ids: string | string[], info: TestInfo, result: Record<string, unknown> = {}) {
  for (const id of Array.isArray(ids) ? ids : [ids]) {
    const directory = resolve(evidenceRoot, id);
    await mkdir(directory, { recursive: true });
    const suffix = info.project.name.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
    await page.screenshot({ path: resolve(directory, `${suffix}.png`), fullPage: true });
    await writeFile(
      resolve(directory, `${suffix}.json`),
      JSON.stringify({ req: id, result: 'APROVADO', project: info.project.name, url: page.url(), ...result }, null, 2),
      'utf8',
    );
  }
}

async function selectFirstConversation(page: Page) {
  await page.goto('/atendimento');
  await page.locator('button.chat-item:not(.chat-item-more)').first().click();
  await expect(page.locator('.client-name-button')).toBeVisible();
}

async function closeModal(page: Page) {
  await page.locator('dialog').last().getByRole('button', { name: /Fechar|Cancelar/ }).first().click();
}

test('REQ-159/REQ-161 renomeia menus e pastas e persiste logotipo após recarregar', async ({ page }, info) => {
  await openApp(page);
  await openSettings(page, 'Personalização');
  const menuName = `Atender ${info.project.name}`;
  const folderName = `Textos ${info.project.name}`;
  await waitPreference(page, () => page.getByLabel('Menu · Atendimento').fill(menuName));
  await waitPreference(page, () => page.getByLabel('Pasta · Textos').fill(folderName));
  const removeLogo = page.getByRole('button', { name: 'Remover logotipo', exact: true });
  if (await removeLogo.isVisible()) await waitPreference(page, () => removeLogo.click());
  await waitPreference(page, () =>
    page.getByLabel('Logotipo').setInputFiles({ name: 'logo-auditoria.png', mimeType: 'image/png', buffer: png }),
  );
  await page.reload();
  await expect(page.getByRole('button', { name: menuName, exact: true })).toBeVisible();
  await expect(page.locator('img.branding-mark').first()).toHaveAttribute('src', /^data:image\/(?:png|webp);base64,/);
  await openSettings(page, 'Personalização');
  await expect(page.getByLabel('Menu · Atendimento')).toHaveValue(menuName);
  await expect(page.getByLabel('Pasta · Textos')).toHaveValue(folderName);
  await saveEvidence(page, ['REQ-159', 'REQ-161'], info, { menuName, folderName, logo: 'data:image/png' });
});

test('REQ-164 preferências da conta aparecem em outro contexto local', async ({ page, browser }, info) => {
  await openApp(page);
  await openSettings(page, 'Personalização');
  const menuName = `Conversas ${info.project.name}`;
  await waitPreference(page, () => page.getByLabel('Menu · Atendimento').fill(menuName));
  const secondContext = await browser.newContext({ viewport: info.project.use.viewport });
  const second = await secondContext.newPage();
  await second.goto('http://127.0.0.1:5180/atendimento');
  await expect(second.getByRole('button', { name: menuName, exact: true })).toBeVisible();
  await saveEvidence(second, 'REQ-164', info, { synchronizedPreference: menuName, contexts: 2 });
  await secondContext.close();
});

test('REQ-165/REQ-166 tamanho, visibilidade e reabertura de painéis persistem', async ({ page }, info) => {
  await openApp(page);
  await page.getByText('Personalizar', { exact: true }).click();
  await page.getByRole('button', { name: 'HUD, atalhos, botões e aparência' }).click();
  const width = page.getByLabel(/Largura da lista/);
  await width.fill('18.5');
  const fixed = page.getByLabel('Mostrar mensagens fixadas');
  if (await fixed.isChecked()) await fixed.uncheck();
  const saved = page.waitForResponse(
    (response) => response.url().endsWith('/api/operations/settings/preferences') && response.request().method() === 'PUT' && response.ok(),
  );
  await page.getByRole('button', { name: 'Confirmar alterações' }).click();
  await saved;
  await page.reload();
  await page.getByText('Personalizar', { exact: true }).click();
  await page.getByRole('button', { name: 'HUD, atalhos, botões e aparência' }).click();
  await expect(page.getByLabel(/Largura da lista/)).toHaveValue('18.5');
  await expect(page.getByLabel('Mostrar mensagens fixadas')).not.toBeChecked();
  await closeModal(page);
  const tools = page.getByRole('button', { name: /Mostrar biblioteca lateral|Ocultar biblioteca lateral/ });
  if ((await tools.getAttribute('aria-label')) === 'Ocultar biblioteca lateral') await tools.click();
  await expect(tools).toHaveAttribute('aria-label', 'Mostrar biblioteca lateral');
  await tools.click();
  await expect(page.getByLabel('Ferramentas de atendimento')).toBeVisible();
  await saveEvidence(page, ['REQ-165', 'REQ-166'], info, { listWidth: 18.5, hiddenAndReopened: 'tools' });
});

test('REQ-167 filtra, arquiva e reabre uma conversa pela interface', async ({ page }, info) => {
  await openApp(page);
  await selectFirstConversation(page);
  await page.locator('.chat-more-actions summary').click();
  const archived = page.waitForResponse(
    (response) => response.url().includes('/api/attendance/sessions/audit-session/conversations/') && response.request().method() === 'PUT' && response.ok(),
  );
  await page.locator('.chat-action-menu').getByRole('button', { name: 'Arquivar conversa', exact: true }).click();
  await archived;
  const back = page.getByRole('button', { name: 'Voltar à lista' });
  if (await back.isVisible()) await back.click();
  await page.getByRole('button', { name: 'Arquivadas', exact: true }).click();
  const archivedAna = page.locator('.chat-item').filter({ hasText: 'Ana Exemplo' });
  await expect(archivedAna).toBeVisible();
  await archivedAna.click();
  await page.locator('.chat-more-actions summary').click();
  const reopened = page.waitForResponse(
    (response) => response.url().includes('/api/attendance/sessions/audit-session/conversations/') && response.request().method() === 'PUT' && response.ok(),
  );
  await page.locator('.chat-action-menu').getByRole('button', { name: 'Reabrir conversa', exact: true }).click();
  await reopened;
  await saveEvidence(page, 'REQ-167', info, { filters: ['Arquivadas'], archivedAndReopened: 'Ana Exemplo' });
});

test('REQ-168/REQ-169 cadastra setor e atendente e pesquisa transferência com foto, setor e presença', async ({ page }, info) => {
  await openApp(page);
  await openSettings(page, 'Departamentos');
  const suffix = info.project.name.replaceAll(/[^a-z0-9]/gi, '').toLowerCase();
  const department = `Interface ${suffix}`;
  await page.getByLabel('Novo departamento').fill(department);
  const departmentSaved = page.waitForResponse((response) => response.url().endsWith('/api/operations/settings/departments') && response.request().method() === 'PUT' && response.ok());
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await departmentSaved;
  await page.getByRole('button', { name: 'Equipe', exact: true }).click();
  const member = `interface-${suffix}@example.com`;
  await page.getByLabel('Nome', { exact: true }).fill(`Interface ${info.project.name}`);
  await page.getByLabel('E-mail do login').fill(member);
  await page.getByRole('combobox', { name: 'Setor' }).click();
  await page.getByRole('option', { name: department, exact: true }).click();
  const teamSaved = page.waitForResponse((response) => response.url().endsWith('/api/operations/team') && response.request().method() === 'PUT' && response.ok());
  await page.getByRole('button', { name: 'Salvar atendente' }).click();
  await teamSaved;
  await mergePreferences(page, { hudHiddenTools: [] });
  await page.reload();
  await selectFirstConversation(page);
  await page.getByRole('button', { name: 'Caixa', exact: true }).click();
  await page.getByRole('button', { name: 'Transferir conversa atual' }).click();
  const selector = page.getByRole('combobox', { name: 'Escolha um atendente' });
  await selector.click();
  await page.getByLabel('Pesquisar opções').fill('Administrador');
  const option = page.getByRole('option', { name: /Administrador Exemplo.*Comercial.*Offline/ });
  await expect(option).toBeVisible();
  await expect(option.locator('img')).toHaveCount(1);
  await saveEvidence(page, ['REQ-168', 'REQ-169'], info, { department, member, searchableMember: 'Administrador Exemplo', presence: 'Offline', avatar: true });
});

test('REQ-171/REQ-172/REQ-173/REQ-174/REQ-175 campanha usa seletores customizados, múltiplos filtros e seleção manual', async ({ page }, info) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Campanhas', exact: true }).click();
  await page.getByRole('button', { name: 'Nova campanha' }).click();
  const lists = page.getByRole('combobox', { name: 'Listas importadas' });
  const labels = page.getByRole('combobox', { name: 'Etiquetas' });
  await expect(lists).toHaveJSProperty('tagName', 'BUTTON');
  await expect(labels).toHaveJSProperty('tagName', 'BUTTON');
  await lists.click();
  await page.getByRole('option', { name: /Lista Novos/ }).click();
  await page.getByRole('option', { name: /Lista Clientes/ }).click();
  await page.getByRole('button', { name: 'Concluir' }).click();
  await labels.click();
  await page.getByRole('option', { name: 'Novo lead', exact: true }).click();
  await page.getByRole('option', { name: 'Orçamento', exact: true }).click();
  await page.getByRole('button', { name: 'Concluir' }).click();
  await page.getByRole('button', { name: 'Conferir público' }).click();
  await expect(page.getByText('2 contatos correspondem ao filtro', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Ver/Selecionar leads manualmente' }).click();
  await expect(page.getByText('2 selecionados para esta campanha', { exact: true })).toBeVisible();
  await page.getByLabel('Ana Exemplo').uncheck();
  await expect(page.getByText('1 selecionados para esta campanha', { exact: true })).toBeVisible();
  await saveEvidence(page, ['REQ-171', 'REQ-172', 'REQ-173', 'REQ-174', 'REQ-175'], info, { customSelects: true, lists: 2, labels: 2, audience: 2, selected: 1 });
});

test('REQ-176/REQ-177/REQ-178/REQ-179 agenda limpa identificadores, formata/busca telefone e cria número novo', async ({ page }, info) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  await page.getByRole('button', { name: 'Novo agendamento' }).click();
  const contact = page.getByRole('combobox', { name: 'Contato para agendamento' });
  await contact.fill('99999-9901');
  const ana = page.getByRole('option', { name: /Ana Exemplo.*\+55 \(11\) 99999-9901/ });
  await expect(ana).toBeVisible();
  await expect(page.getByRole('listbox')).not.toContainText(/@lid|@c\.us/i);
  const last = info.project.name.includes('1366') ? '1' : info.project.name.includes('1920') ? '2' : '3';
  await contact.fill(`(62) 99876-543${last}`);
  const create = page.getByRole('button', { name: /Agendar para novo número.*\+55 \(62\) 99876-543/ });
  await expect(create).toBeVisible();
  const created = page.waitForResponse((response) => response.url().endsWith('/api/operations/sessions/audit-session/contacts') && response.request().method() === 'POST' && response.ok());
  await create.click();
  await created;
  await expect(contact).toHaveValue(/\+55 \(62\) 99876-543/);
  await saveEvidence(page, ['REQ-176', 'REQ-177', 'REQ-178', 'REQ-179'], info, { technicalIdsHidden: true, formatted: '+55 (11) 99999-9901', partialSearch: '99999-9901', createdPhone: `556299876543${last}` });
});

test('REQ-180/REQ-181/REQ-182 edita arquivo e legenda, reproduz mídia e duplica recurso', async ({ page }, info) => {
  await openApp(page);
  const libraryResponse = await page.request.get(`${api}/attendance/library`);
  const library = await libraryResponse.json();
  const welcome = library.assets.find((item: { id: string }) => item.id === 'audit-asset-welcome');
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await page.getByRole('button', { name: `Editar ${welcome.name}`, exact: true }).click();
  const name = `Resposta editada ${info.project.name}`;
  await page.getByLabel('Nome', { exact: true }).fill(name);
  await page.getByLabel('Mensagem').fill(`Texto editado ${info.project.name}`);
  const textSaved = page.waitForResponse((response) => response.url().endsWith('/api/attendance/assets/audit-asset-welcome') && response.request().method() === 'PUT' && response.ok());
  await page.getByRole('button', { name: 'Salvar resposta' }).click();
  await textSaved;
  await page.getByRole('button', { name: 'Mídias', exact: true }).click();
  await page.getByRole('button', { name: 'Editar Imagem fictícia' }).click();
  await page.getByLabel('Legenda').fill(`Legenda substituída ${info.project.name}`);
  await page.locator('input[type=file]').setInputFiles({ name: 'imagem-substituida.png', mimeType: 'image/png', buffer: png });
  const mediaSaved = page.waitForResponse((response) => response.url().endsWith('/api/attendance/assets/audit-asset-image') && response.request().method() === 'PUT' && response.ok());
  await page.getByRole('button', { name: 'Salvar resposta' }).click();
  await mediaSaved;
  await page.getByRole('button', { name: 'Áudios', exact: true }).click();
  await page.getByRole('button', { name: 'Áudio fictício', exact: true }).click();
  await expect(page.locator('dialog audio')).toBeVisible();
  await closeModal(page);
  await page.getByRole('button', { name: 'Mídias', exact: true }).click();
  await page.getByRole('button', { name: 'Vídeo fictício', exact: true }).click();
  await expect(page.locator('dialog video')).toBeVisible();
  await closeModal(page);
  await page.getByRole('button', { name: /Textos/ }).click();
  await page.getByRole('button', { name: `Duplicar ${name}` }).click();
  const duplicated = page.waitForResponse((response) => response.url().endsWith('/api/attendance/assets/audit-asset-welcome/duplicate') && response.request().method() === 'POST' && response.ok());
  await page.getByRole('button', { name: 'Confirmar duplicação' }).click();
  await duplicated;
  await expect(page.getByText('Resposta duplicada.', { exact: true })).toBeVisible();
  await saveEvidence(page, ['REQ-180', 'REQ-181', 'REQ-182'], info, { editedText: true, replacedFile: true, previewed: ['audio', 'video'], duplicated: name });
});

test('REQ-184/REQ-185 simula fluxo e IA e reinicia o histórico sem enviar WhatsApp', async ({ page }, info) => {
  let realSends = 0;
  page.on('request', (request) => { if (/\/conversations\/[^/]+\/send(?:-|$)/.test(request.url())) realSends++; });
  await page.route('**/api/operations/simulator/reply', async (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Resposta simulada da IA.', contextSources: ['Regra fictícia'] }) }),
  );
  await mergePreferences(page, {});
  const feature = await page.request.put(`${api}/operations/features`, { data: { aiEnabled: true } });
  expect(feature.ok()).toBeTruthy();
  const integration = await page.request.put(`${api}/operations/ai`, { data: { apiKey: 'fake-interface-key', provider: 'openai', model: 'modelo-simulado', instructions: '', knowledge: '', style: '', enabled: false } });
  expect(integration.ok()).toBeTruthy();
  await openApp(page);
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('button', { name: 'Integração de IA', exact: true }).click();
  await page.getByRole('button', { name: /Testar \/ Simular atendimento/ }).click();
  await expect(page.getByText('Contato fictício · sem envio ao WhatsApp')).toBeVisible();
  await page.getByLabel('Mensagem do cliente fictício').fill('Pergunta fictícia');
  await page.getByRole('button', { name: 'Enviar teste' }).click();
  await expect(page.getByText('Resposta simulada da IA.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Limpar / Reiniciar teste' }).click();
  await expect(page.getByText('Envie uma mensagem como cliente para começar.')).toBeVisible();
  await closeModal(page);
  await page.getByRole('button', { name: 'Autoatendimento', exact: true }).click();
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  await expect(page.getByText('Contato fictício · sem envio ao WhatsApp')).toBeVisible();
  await page.getByLabel('Mensagem do cliente fictício').fill('oi');
  await page.getByRole('button', { name: 'Enviar teste' }).click();
  await page.getByRole('button', { name: 'Limpar / Reiniciar teste' }).click();
  expect(realSends).toBe(0);
  await saveEvidence(page, ['REQ-184', 'REQ-185'], info, { simulated: ['ai', 'flow'], whatsappSends: realSends, reset: true });
});

test('REQ-187 carrega exemplos com conversa multimídia, etiquetas, agenda e fluxo', async ({ page }, info) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Espaço de Teste', exact: true }).click();
  await page.getByRole('button', { name: 'Carregar dados de exemplo', exact: true }).first().click();
  const sections = page.getByLabel('Seções do espaço de teste');
  await expect(page.locator('.sandbox-contacts button')).toHaveCount(6);
  await sections.getByRole('button', { name: 'Biblioteca e atalhos' }).click();
  await expect(page.locator('.sandbox-library audio')).toBeVisible();
  await expect(page.locator('.sandbox-library video')).toBeVisible();
  await sections.getByRole('button', { name: 'Kanban e vendas' }).click();
  await expect(page.locator('.sandbox-kanban section')).toHaveCount(3);
  await sections.getByRole('button', { name: 'Agenda', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Agenda fictícia' })).toBeVisible();
  await sections.getByRole('button', { name: 'Autoatendimento', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Fluxo virtual de exemplo' })).toBeVisible();
  await sections.getByRole('button', { name: 'Equipe e transferências' }).click();
  await expect(page.getByText(/Online|Offline/).first()).toBeVisible();
  await saveEvidence(page, 'REQ-187', info, { contacts: 6, media: ['audio', 'video'], labels: 3, agenda: true, flow: true, team: true });
});

test('REQ-188/REQ-189/REQ-190/REQ-191 ajuda organiza quatro tutoriais ilustrados', async ({ page }, info) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Ajuda e configurações', exact: true }).click();
  const titles = [/1\. Conexões/, /2\. Autoatendimento/, /3\. Campanhas, remarketing e Excel/, /4\. Atendimento, equipe e atalhos/];
  for (const title of titles) {
    const card = page.locator('.help-guide').filter({ has: page.getByRole('heading', { name: title }) });
    await expect(card).toBeVisible();
    await expect(card.locator('header svg')).toHaveCount(1);
    await expect(card.locator('ol li')).not.toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Abrir seção' })).toBeVisible();
  }
  await saveEvidence(page, ['REQ-188', 'REQ-189', 'REQ-190', 'REQ-191'], info, { guides: 4, illustrated: true, actionable: true });
});

test('REQ-198 adapta navegação, lista, conversa e ferramentas para a largura disponível', async ({ page }, info) => {
  await openApp(page);
  const viewport = page.viewportSize()!;
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  if (viewport.width <= 480) {
    await page.getByRole('button', { name: 'Recolher ou expandir menu principal' }).click();
    await expect(page.getByRole('button', { name: 'Recolher menu principal' })).toBeVisible();
    await page.getByRole('button', { name: 'Recolher menu principal' }).click();
    await selectFirstConversation(page);
    await expect(page.getByRole('button', { name: 'Voltar à lista' })).toBeVisible();
    const toolsToggle = page.getByRole('button', { name: /Mostrar biblioteca lateral|Ocultar biblioteca lateral/ });
    if ((await toolsToggle.getAttribute('aria-label')) === 'Ocultar biblioteca lateral') await toolsToggle.click();
    const tools = page.getByRole('button', { name: 'Mostrar biblioteca lateral' });
    await tools.click();
    await expect(page.getByRole('button', { name: 'Fechar ferramentas' })).toBeVisible();
    await page.getByRole('button', { name: 'Fechar ferramentas' }).click();
  } else {
    await expect(page.getByLabel('Lista de conversas')).toBeVisible();
    await expect(page.locator('.chat-pane')).toBeVisible();
  }
  await saveEvidence(page, 'REQ-198', info, { viewport, horizontalOverflow: overflow, navigation: viewport.width <= 480 ? 'drawer' : 'expanded', tools: viewport.width <= 480 ? 'drawer' : 'panel' });
});
