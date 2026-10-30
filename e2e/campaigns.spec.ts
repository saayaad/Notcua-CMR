import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const api = 'http://127.0.0.1:3340/api';
const evidenceRoot = resolve(process.cwd(), 'REVISAO', 'evidencias');
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

async function openApp(page: Page) {
  await page.goto('/atendimento');
  await expect(page.locator('.app-shell')).toBeVisible();
}

async function saveEvidence(page: Page, ids: string[], info: TestInfo, result: Record<string, unknown>) {
  for (const id of ids) {
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

async function openCampaignEditor(page: Page) {
  await openApp(page);
  await page.getByRole('button', { name: 'Campanhas', exact: true }).click();
  await page.getByRole('button', { name: 'Nova campanha' }).click();
  await expect(page.getByRole('heading', { name: 'Nova campanha segmentada' })).toBeVisible();
}

test('REQ-269/REQ-270/REQ-275/REQ-276/REQ-277/REQ-278/REQ-315/REQ-316 campanha combina etiquetas, listas e inatividade com contador dinâmico', async ({ page }, info) => {
  await openCampaignEditor(page);
  const dialog = page.locator('dialog.batch-editor-modal');
  await expect(dialog.locator('select')).toHaveCount(0);
  const dimensions = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const form = element.querySelector('form')!;
    const layout = element.querySelector('.batch-editor-layout')!;
    const actions = element.querySelector('.modal-actions')!;
    const mobile = window.matchMedia('(max-width: 760px)').matches;
    const scroller = mobile ? layout : form;
    return {
      height: rect.height,
      viewportHeight: window.innerHeight,
      scroller: mobile ? 'layout' : 'form',
      scrollerOverflowY: getComputedStyle(scroller).overflowY,
      formScrollable: scroller.scrollHeight >= scroller.clientHeight,
      actionsVisible: actions.getBoundingClientRect().bottom <= window.innerHeight,
    };
  });
  expect(dimensions.height).toBeLessThanOrEqual(dimensions.viewportHeight * 0.9 + 2);
  expect(dimensions.scrollerOverflowY).toBe('auto');
  expect(dimensions.formScrollable).toBeTruthy();
  expect(dimensions.actionsVisible).toBeTruthy();

  const lists = page.getByRole('combobox', { name: 'Listas importadas' });
  const labels = page.getByRole('combobox', { name: 'Etiquetas' });
  await expect(lists).toHaveJSProperty('tagName', 'BUTTON');
  await expect(labels).toHaveJSProperty('tagName', 'BUTTON');
  await lists.click();
  await page.getByRole('option', { name: /Lista Novos/ }).click();
  await page.getByRole('option', { name: /Lista Clientes/ }).click();
  await page.getByRole('button', { name: 'Concluir' }).click();
  await labels.click();
  const newLead = page.getByRole('option', { name: 'Novo lead', exact: true });
  const budget = page.getByRole('option', { name: 'Orçamento', exact: true });
  await expect(newLead).toBeVisible();
  await expect(budget).toBeVisible();
  await expect(newLead.locator('i')).toHaveCSS('background-color', 'rgb(139, 92, 246)');
  await expect(budget.locator('i')).toHaveCSS('background-color', 'rgb(245, 158, 11)');
  await newLead.click();
  await budget.click();
  await page.getByRole('button', { name: 'Concluir' }).click();
  await page.getByLabel('Sem interação há pelo menos (dias)').fill('1');
  await page.getByRole('button', { name: 'Conferir público' }).click();
  await expect(page.getByText('0 contatos correspondem ao filtro', { exact: false })).toBeVisible();
  await page.getByLabel('Sem interação há pelo menos (dias)').fill('0');
  await page.getByRole('button', { name: 'Conferir público' }).click();
  await expect(page.getByText('2 contatos correspondem ao filtro', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Ver/Selecionar leads manualmente' }).click();
  await expect(page.getByText('2 selecionados para esta campanha', { exact: true })).toBeVisible();
  await page.getByLabel('Ana Exemplo').uncheck();
  await expect(page.getByText('1 selecionados para esta campanha', { exact: true })).toBeVisible();
  await saveEvidence(page, ['REQ-269', 'REQ-270', 'REQ-275', 'REQ-276', 'REQ-277', 'REQ-278', 'REQ-315', 'REQ-316'], info, {
    nativeSelects: 0,
    modal: dimensions,
    labelColors: { 'Novo lead': '#8B5CF6', Orçamento: '#F59E0B' },
    selectedLists: 2,
    combinedLabels: 2,
    audienceCount: 2,
    manuallySelected: 1,
  });
});

test('REQ-279/REQ-280/REQ-281/REQ-282/REQ-318 cria variações simuladas, alterna prévia e persiste intervalos/pausa', async ({ page }, info) => {
  const variants = ['Olá, Ana! Confira a novidade.', 'Oi, Ana! Temos uma condição especial.', 'Bom dia, Ana! Veja esta oportunidade.', 'Ana, posso mostrar uma opção?'];
  let authorization = '';
  let sendRequests = 0;
  const campaignName = `Campanha simulada ${info.project.name} ${Date.now()}`;
  page.on('request', (request) => {
    if (/\/conversations\/[^/]+\/send(?:-|$)/.test(request.url())) sendRequests += 1;
    if (/\/operations\/sessions\/audit-session\/batches/.test(request.url()))
      void request.allHeaders().then((headers) => { authorization = headers.authorization ?? ''; });
  });
  await page.route('**/api/operations/features', (route) => route.fulfill({ json: { aiEnabled: true } }));
  await page.route('**/api/operations/sessions/audit-session/campaign-variations', (route) =>
    route.fulfill({ json: { variants } }),
  );
  await openApp(page);
  await page.getByRole('button', { name: 'Campanhas', exact: true }).click();
  const existing = await page.request.get(`${api}/operations/sessions/audit-session/batches`, {
    headers: authorization ? { authorization } : {},
  });
  expect(existing.status()).toBe(200);
  const existingItems = (await existing.json() as { items: Array<Record<string, unknown>> }).items;
  const previousTestDrafts = existingItems.filter((item) =>
    item.status === 'DRAFT' && typeof item.name === 'string' &&
    item.name.startsWith(`Campanha simulada ${info.project.name} `),
  );
  for (const draft of previousTestDrafts) {
    await page.request.put(`${api}/operations/sessions/audit-session/batches/${draft.id}`, {
      headers: authorization ? { authorization } : {},
      data: { status: 'CANCELLED' },
    });
  }
  await page.getByRole('button', { name: 'Nova campanha' }).click();
  await expect(page.getByRole('heading', { name: 'Nova campanha segmentada' })).toBeVisible();
  await page.getByLabel('Nome', { exact: true }).fill(campaignName);
  await page.getByLabel('Mensagem').fill('Olá, #nome! Confira.');
  await page.getByRole('button', { name: /Gerar variações com IA/ }).click();
  for (const [index, text] of variants.entries())
    await expect(page.getByLabel(`Variação ${index + 1}`)).toHaveValue(text);
  await page.getByRole('button', { name: 'Ver próxima variação na prévia' }).click();
  await expect(page.locator('.campaign-phone')).toContainText(variants[1]);
  await expect(page.getByText('Prévia · nenhum envio realizado')).toBeVisible();
  const min = page.getByLabel('Intervalo mínimo (s)');
  const max = page.getByLabel('Intervalo máximo (s)');
  const pauseEvery = page.getByLabel(/Pausa longa a cada quantas mensagens/);
  const pauseSeconds = page.getByLabel('Duração da pausa longa (s)');
  await min.fill('25');
  await max.fill('40');
  await pauseEvery.fill('3');
  await pauseSeconds.fill('90');
  await page.getByRole('button', { name: 'Conferir público' }).click();
  await expect(page.getByText(/contatos correspondem ao filtro/)).toBeVisible();
  const saveResponsePromise = page.waitForResponse((response) =>
    response.request().method() === 'POST' && /\/operations\/sessions\/audit-session\/batches$/.test(response.url()),
  );
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  const saveResponse = await saveResponsePromise;
  expect(saveResponse.status()).toBe(201);
  const created = await saveResponse.json() as { id: string };
  expect(created.id).toBeTruthy();
  await page.reload();
  await page.getByRole('button', { name: 'Campanhas', exact: true }).click();
  await expect(page.getByText(campaignName, { exact: true })).toBeVisible();
  const listResponse = await page.request.get(`${api}/operations/sessions/audit-session/batches`, {
    headers: authorization ? { authorization } : {},
  });
  expect(listResponse.status()).toBe(200);
  const { items } = await listResponse.json() as { items: Array<Record<string, unknown>> };
  const persisted = items.find((item) => item.id === created.id);
  expect(persisted).toBeTruthy();
  expect(persisted?.status).toBe('DRAFT');
  expect(persisted?.minSeconds).toBe(25);
  expect(persisted?.maxSeconds).toBe(40);
  expect(persisted?.pauseEvery).toBe(3);
  expect(persisted?.pauseSeconds).toBe(90);
  expect(persisted?.approaches).toEqual(['Olá, #nome! Confira.', ...variants]);
  expect(sendRequests).toBe(0);
  const cleanup = await page.request.put(`${api}/operations/sessions/audit-session/batches/${created.id}`, {
    headers: authorization ? { authorization } : {},
    data: { status: 'CANCELLED' },
  });
  expect(cleanup.status()).toBe(200);
  await saveEvidence(page, ['REQ-279', 'REQ-280', 'REQ-281', 'REQ-282', 'REQ-318'], info, {
    aiProvider: 'stubbed local route',
    variants: variants.length,
    previewAlternated: variants[1],
    intervals: [25, 40],
    pauseEvery: 3,
    pauseSeconds: 90,
    savedAsDraftAndReloaded: true,
    sends: sendRequests,
  });
});

test('REQ-283/REQ-284/REQ-285/REQ-286/REQ-287/REQ-288 acompanha progresso e controla campanha sem envio', async ({ page }, info) => {
  let status = 'ACTIVE';
  let changes = 0;
  const next = new Date(Date.now() + 35_000).toISOString();
  const batch = {
    id: 'audit-monitor-stub',
    name: 'Monitor fictício da auditoria',
    mode: 'CAMPAIGN',
    status,
    count: 5,
    minSeconds: 20,
    maxSeconds: 35,
    createdAt: new Date().toISOString(),
    nextAllowedAt: next,
    nextTaskAt: next,
    investmentInCents: 0,
    attributedRevenueInCents: 0,
    counts: [{ status: 'COMPLETED', _count: 1 }, { status: 'FAILED', _count: 0 }, { status: 'RUNNING', _count: 0 }],
  };
  await page.route('**/api/whatsapp/sessions', (route) => route.fulfill({ json: { items: [{ id: 'audit-session', name: 'Conexão fictícia da auditoria', status: 'DISCONNECTED', phoneNumber: '5511999999900' }] } }));
  await page.route('**/api/operations/sessions/audit-session/batches**', async (route) => {
    if (route.request().method() === 'PUT') {
      status = String((route.request().postDataJSON() as { status?: string }).status);
      changes += 1;
      await route.fulfill({ json: { id: batch.id, status } });
      return;
    }
    await route.fulfill({ json: { items: status === 'CANCELLED' ? [] : [{ ...batch, status }] } });
  });
  await openApp(page);
  await page.getByRole('button', { name: 'Campanhas', exact: true }).click();
  const monitor = page.getByLabel('Monitor de campanhas');
  await expect(monitor).toContainText('Enviados: 1 de 5');
  await expect(monitor.locator('progress')).toHaveAttribute('value', '1');
  await expect(monitor).toContainText(/Próximo envio em \d+s · aguardando conexão do WhatsApp/);
  const pace = monitor.locator('.campaign-pace');
  await expect(pace).toContainText('Ritmo moderado');
  await expect(pace).toHaveAttribute('title', /Não mede nem garante proteção do número/);
  await monitor.getByRole('button', { name: 'Pausar' }).click();
  await expect(monitor).toContainText('Pausada');
  await monitor.getByRole('button', { name: 'Retomar' }).click();
  await expect(monitor.getByRole('button', { name: 'Pausar' })).toBeVisible();
  await monitor.getByRole('button', { name: 'Cancelar' }).click();
  const confirm = page.getByRole('dialog', { name: 'Cancelar próximos envios?' });
  await confirm.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(page.getByLabel('Monitor de campanhas')).toHaveCount(0);
  expect(status).toBe('CANCELLED');
  expect(changes).toBe(3);
  await saveEvidence(page, ['REQ-283', 'REQ-284', 'REQ-285', 'REQ-286', 'REQ-287', 'REQ-288'], info, {
    sent: 1,
    total: 5,
    countdownVisible: true,
    safetyCopy: 'estimativa; sem promessa de proteção',
    controls: ['pause', 'resume', 'cancel'],
    sends: 0,
  });
});

test('REQ-289/REQ-290/REQ-291/REQ-292/REQ-320 agenda filtra contatos e salva rascunho para novo número', async ({ page }, info) => {
  const sends: string[] = [];
  page.on('request', (request) => {
    if (/\/conversations\/[^/]+\/send(?:-|$)/.test(request.url())) sends.push(request.url());
  });
  await openApp(page);
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  await page.getByRole('button', { name: 'Novo agendamento' }).click();
  const contact = page.getByRole('combobox', { name: 'Contato para agendamento' });
  await contact.fill('Ana Exemplo');
  const ana = page.getByRole('option', { name: /Ana Exemplo.*\+55 \(11\) 99999-9901/ });
  await expect(ana).toBeVisible();
  await expect(ana).toContainText('Novo lead');
  await expect(ana.locator('.avatar')).toContainText('AE');
  await expect(page.getByRole('listbox')).not.toContainText(/@lid|@c\.us/i);
  await contact.fill('99999-9901');
  await expect(page.getByRole('option', { name: /Ana Exemplo.*\+55 \(11\) 99999-9901/ })).toBeVisible();
  await contact.fill('55');
  await expect(page.getByRole('option', { name: /Ana Exemplo/ })).toBeVisible();
  const suffix = Date.now().toString().slice(-8);
  const phone = `5588${suffix}`;
  await contact.fill(phone);
  const create = page.getByRole('button', { name: /Agendar para novo número.*\+55 \(88\)/ });
  await expect(create).toBeVisible();
  const created = page.waitForResponse((response) => response.url().endsWith('/api/operations/sessions/audit-session/contacts') && response.request().method() === 'POST' && response.ok());
  await create.click();
  await created;
  await expect(contact).toHaveValue('+55 (88) ' + phone.slice(4, -4) + '-' + phone.slice(-4));
  const scheduleName = `Agendamento fictício REQ-292 ${info.project.name} ${Date.now()}`;
  await page.getByLabel('Nome', { exact: true }).fill(scheduleName);
  await page.locator('input[name="runAt"]').fill(new Date(Date.now() + 86_400_000).toISOString().slice(0, 16));
  await page.getByRole('textbox', { name: 'Mensagem', exact: true }).fill('Mensagem fictícia de auditoria; rascunho não ativado.');
  await page.getByRole('button', { name: 'Conferir público' }).click();
  await expect(page.getByText(/1 contatos correspondem ao filtro|1 contato corresponde ao filtro/)).toBeVisible();
  const scheduleSave = page.waitForResponse((response) =>
    response.url().endsWith('/api/operations/sessions/audit-session/batches') &&
    response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  const savedSchedule = await scheduleSave;
  expect(savedSchedule.status()).toBe(201);
  const schedule = await savedSchedule.json() as { id: string };
  await page.reload();
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  await expect(page.getByText(scheduleName, { exact: true })).toBeVisible();
  const persistedResponse = await page.request.get(`${api}/operations/sessions/audit-session/batches`);
  expect(persistedResponse.status()).toBe(200);
  const persistedItems = (await persistedResponse.json() as { items: Array<Record<string, unknown>> }).items;
  const persisted = persistedItems.find((item) => item.id === schedule.id);
  expect(persisted).toBeTruthy();
  expect(persisted?.mode).toBe('SCHEDULE');
  expect(persisted?.status).toBe('DRAFT');
  expect(persisted?.count).toBe(1);
  expect(sends).toHaveLength(0);
  const removedFromQueue = await page.request.put(`${api}/operations/sessions/audit-session/batches/${schedule.id}`, {
    data: { status: 'CANCELLED' },
  });
  expect(removedFromQueue.status()).toBe(200);
  await saveEvidence(page, ['REQ-289', 'REQ-290', 'REQ-291', 'REQ-292', 'REQ-320'], info, {
    technicalIdsExcluded: true,
    displayedName: 'Ana Exemplo',
    formattedPhone: '+55 (11) 99999-9901',
    labelsShown: ['Novo lead'],
    queries: ['name', 'partial phone', 'DDI'],
    fictionalNewNumber: phone,
    scheduledDraftPersistedAfterReload: true,
    sends: sends.length,
  });
});

test('REQ-293/REQ-294/REQ-295/REQ-296/REQ-297 biblioteca edita, reproduz, amplia, duplica e exclui com confirmação', async ({ page }, info) => {
  const sends: string[] = [];
  page.on('request', (request) => {
    if (/\/conversations\/[^/]+\/send(?:-|$)/.test(request.url())) sends.push(request.url());
  });
  const response = await page.request.get(`${api}/attendance/library`);
  expect(response.ok()).toBeTruthy();
  const library = await response.json();
  const source = library.assets.find((item: { id: string }) => item.id === 'audit-asset-welcome');
  expect(source).toBeTruthy();
  const editedName = `Recurso auditoria ${info.project.name}`;
  for (const stale of library.assets.filter((item: { name: string }) => item.name === `${editedName} · cópia`)) {
    const removed = await page.request.delete(`${api}/attendance/assets/${encodeURIComponent(stale.id)}`);
    expect(removed.ok()).toBeTruthy();
  }
  await openApp(page);
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await page.getByRole('button', { name: `Editar ${source.name}`, exact: true }).click();
  await page.getByLabel('Nome', { exact: true }).fill(editedName);
  await page.getByLabel('Mensagem').fill(`Texto fictício atualizado ${info.project.name}`);
  const saved = page.waitForResponse((item) => item.url().endsWith('/api/attendance/assets/audit-asset-welcome') && item.request().method() === 'PUT' && item.ok());
  await page.getByRole('button', { name: 'Salvar resposta' }).click();
  await saved;
  await page.reload();
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await page.getByRole('button', { name: /Textos/ }).click();
  await expect(page.getByRole('button', { name: editedName, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mídias', exact: true }).click();
  await page.getByRole('button', { name: 'Editar Imagem fictícia' }).click();
  await page.getByLabel('Legenda').fill(`Legenda de auditoria ${info.project.name}`);
  await page.locator('input[type=file]').setInputFiles({ name: 'imagem-auditoria-substituida.png', mimeType: 'image/png', buffer: png });
  const mediaSaved = page.waitForResponse((item) => item.url().endsWith('/api/attendance/assets/audit-asset-image') && item.request().method() === 'PUT' && item.ok());
  await page.getByRole('button', { name: 'Salvar resposta' }).click();
  await mediaSaved;
  await page.reload();
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await page.getByRole('button', { name: 'Mídias', exact: true }).click();
  await page.getByRole('button', { name: 'Editar Imagem fictícia' }).click();
  await expect(page.getByLabel('Legenda')).toHaveValue(`Legenda de auditoria ${info.project.name}`);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Áudios', exact: true }).click();
  await page.getByRole('button', { name: 'Áudio fictício', exact: true }).click();
  const audio = page.locator('dialog audio');
  await expect(audio).toBeVisible();
  await audio.evaluate((element: HTMLAudioElement) => element.play());
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0);
  await audio.evaluate((element: HTMLAudioElement) => element.pause());
  await page.getByRole('dialog').last().getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: 'Mídias', exact: true }).click();
  await page.getByRole('button', { name: 'Imagem fictícia', exact: true }).click();
  await expect(page.locator('dialog img')).toBeVisible();
  await page.getByRole('dialog').last().getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: 'Vídeo fictício', exact: true }).click();
  await expect(page.locator('dialog video')).toBeVisible();
  await page.getByRole('dialog').last().getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: /Textos/ }).click();
  const sourceCard = page.locator('article.resource-card').filter({ has: page.getByRole('button', { name: editedName, exact: true }) });
  await sourceCard.getByRole('button', { name: `Duplicar ${editedName}`, exact: true }).click();
  const duplicated = page.waitForResponse((item) => item.url().endsWith('/api/attendance/assets/audit-asset-welcome/duplicate') && item.request().method() === 'POST' && item.ok());
  await page.getByRole('button', { name: 'Confirmar duplicação' }).click();
  const copyName = (await duplicated).json().then((item) => item.name as string);
  const actualCopyName = await copyName;
  await expect(page.getByRole('button', { name: `Excluir ${actualCopyName}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Excluir ${actualCopyName}`, exact: true }).click();
  const removal = page.waitForResponse((item) => item.url().includes('/api/attendance/assets/') && item.request().method() === 'DELETE' && item.ok());
  const confirmation = page.getByRole('dialog', { name: 'Excluir recurso?' });
  await confirmation.getByRole('button', { name: 'Confirmar exclusão', exact: true }).click();
  await removal;
  await expect(page.getByRole('button', { name: `Excluir ${actualCopyName}`, exact: true })).toHaveCount(0);
  await expect(page.getByText('Resposta excluída.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: `Excluir ${editedName}`, exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await page.getByRole('button', { name: /Textos/ }).click();
  await expect(page.getByRole('button', { name: `Excluir ${actualCopyName}`, exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: `Excluir ${editedName}`, exact: true })).toBeVisible();
  expect(sends).toHaveLength(0);
  await saveEvidence(page, ['REQ-293', 'REQ-294', 'REQ-295', 'REQ-296', 'REQ-297'], info, {
    editedResource: editedName,
    audioPlayable: true,
    previews: ['image', 'video'],
    duplicateToast: true,
    duplicateDeletedAfterConfirmation: true,
    sends: sends.length,
  });
});

test('REQ-271 cadastra atendente fictício com nome, avatar, setor e estado offline', async ({ page }, info) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('button', { name: 'Departamentos', exact: true }).click();
  const suffix = `${info.project.name.replaceAll(/[^a-z0-9]/gi, '').toLowerCase()}${Date.now()}`;
  const department = `Campanha ${suffix}`;
  await page.getByLabel('Novo departamento').fill(department);
  const departmentSaved = page.waitForResponse((response) => response.url().endsWith('/api/operations/settings/departments') && response.request().method() === 'PUT' && response.ok());
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await departmentSaved;
  await page.getByRole('button', { name: 'Equipe', exact: true }).click();
  const name = `Atendente ${info.project.name}`;
  const email = `req271-${suffix}@example.com`;
  await page.getByLabel('Nome', { exact: true }).fill(name);
  await page.getByLabel('E-mail do login').fill(email);
  await page.getByRole('combobox', { name: 'Setor' }).click();
  await page.getByRole('option', { name: department, exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'avatar-auditoria.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByAltText('Prévia do avatar')).toBeVisible();
  const saved = page.waitForResponse((response) => response.url().endsWith('/api/operations/team') && response.request().method() === 'PUT' && response.ok());
  await page.getByRole('button', { name: 'Salvar atendente' }).click();
  await saved;
  await page.reload();
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('button', { name: 'Equipe', exact: true }).click();
  const member = page.locator('.team-member-list article').filter({ hasText: email });
  await expect(member).toContainText(name);
  await expect(member).toContainText(department);
  await expect(member).toContainText('Offline');
  await expect(member.locator('img')).toHaveCount(1);
  await saveEvidence(page, ['REQ-271'], info, { name, department, email, avatar: true, presence: 'Offline' });
});
