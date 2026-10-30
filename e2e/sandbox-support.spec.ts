import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const evidenceRoot = resolve(process.cwd(), 'REVISAO', 'evidencias');

test.describe.configure({ mode: 'serial' });

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
    await writeFile(resolve(directory, `${suffix}.json`), JSON.stringify({
      req: id,
      result: 'APROVADO',
      project: info.project.name,
      url: page.url(),
      ...result,
    }, null, 2), 'utf8');
  }
}

test('REQ-328/329/330/331/332/333/334/335/336 simulador de fluxo e IA usa apenas dados fictícios', async ({ page }, info) => {
  let realSends = 0;
  let calibration: Record<string, unknown> | undefined;
  page.on('request', request => {
    if (/\/api\/conversations\/[^/]+\/send(?:-|$)/.test(request.url())) realSends++;
  });
  await page.route('**/api/operations/features', route => route.fulfill({ json: { aiEnabled: true, canManage: true } }));
  await page.route('**/api/operations/ai', route => route.fulfill({ json: { provider: 'openai', model: 'modelo-simulado', enabled: false, apiKey: '' } }));
  await page.route('**/api/operations/simulator/reply', async route => {
    await new Promise(resolveRequest => setTimeout(resolveRequest, 450));
    await route.fulfill({ json: { text: 'Resposta fictícia: entendo sua objeção e posso explicar as opções.', contextSources: ['Regra local: esclarecer sem pressionar.', 'Memória local: prazo de dois dias.'] } });
  });
  await page.route('**/api/operations/simulator/calibrations', async route => {
    calibration = route.request().postDataJSON();
    await route.fulfill({ json: { saved: true } });
  });
  await page.route('**/api/operations/simulator/transcribe', route => route.fulfill({ json: { text: 'Transcrição fictícia: preciso confirmar o prazo.' } }));
  await openApp(page);

  await page.getByRole('button', { name: 'Autoatendimento', exact: true }).click();
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Contato fictício · sem envio ao WhatsApp')).toBeVisible();
  await dialog.getByLabel('Modo de teste').click();
  await page.getByRole('option', { name: 'IA configurada · usa tokens do provedor' }).click();
  const response = page.waitForResponse(r => r.url().endsWith('/api/operations/simulator/reply') && r.ok());
  await dialog.getByLabel('Mensagem do cliente fictício').fill('Tenho uma objeção sobre o prazo e quero cancelar.');
  await dialog.getByRole('button', { name: 'Enviar teste' }).click();
  await expect(dialog.getByRole('status')).toHaveText('A escrever…');
  await response;
  await expect(dialog.getByText('Resposta fictícia: entendo sua objeção e posso explicar as opções.')).toBeVisible();
  await dialog.getByText('Contexto enviado à IA').click();
  await expect(dialog.getByText('Regra local: esclarecer sem pressionar.')).toBeVisible();
  await expect(dialog.getByText('Memória local: prazo de dois dias.')).toBeVisible();

  const audio = await readFile(resolve(process.cwd(), 'apps', 'web', 'public', 'sandbox-media', 'audio.wav'));
  await dialog.locator('input[type="file"][accept="audio/*"]').setInputFiles({ name: 'audio-ficticio.wav', mimeType: 'audio/wav', buffer: audio });
  await expect(dialog.locator('.test-audio-preview audio')).toBeVisible();
  await dialog.getByRole('button', { name: 'Transcrever com IA' }).click();
  await expect(dialog.getByLabel('Mensagem do cliente fictício')).toHaveValue('Transcrição fictícia: preciso confirmar o prazo.');
  await dialog.getByRole('button', { name: 'Enviar teste' }).click();
  await expect(dialog.getByText('Resposta fictícia: entendo sua objeção e posso explicar as opções.').last()).toBeVisible();

  await dialog.getByRole('button', { name: 'Corrigir resposta' }).click();
  await dialog.getByLabel('Resposta que você aprova').fill('Resposta corrigida com tom claro e acolhedor.');
  await dialog.getByRole('button', { name: 'Salvar exemplo aprovado' }).click();
  await expect(dialog.getByText('Correção salva como exemplo aprovado para orientar respostas futuras.')).toBeVisible();
  expect(calibration).toMatchObject({ correctedReply: 'Resposta corrigida com tom claro e acolhedor.' });

  await dialog.getByRole('button', { name: 'Limpar / Reiniciar teste' }).click();
  await expect(dialog.getByText('Envie uma mensagem como cliente para começar.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Fechar janela' }).click();
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('button', { name: 'Integração de IA', exact: true }).click();
  await page.getByRole('button', { name: /Testar \/ Simular atendimento/ }).click();
  await expect(page.getByRole('dialog').getByText('Contato fictício · sem envio ao WhatsApp')).toBeVisible();
  expect(realSends).toBe(0);
  await saveEvidence(page, ['REQ-328', 'REQ-329', 'REQ-330', 'REQ-331', 'REQ-332', 'REQ-333', 'REQ-334', 'REQ-335', 'REQ-336'], info, {
    aiProvider: 'interceptado localmente',
    audio: 'arquivo local; transcrição mockada; sem chamada externa',
    calibration: 'interceptada sem gravar dados reais',
    whatsappSends: realSends,
  });
});

test('REQ-340/341/342/344/347/348/349/350 Sandbox edita amostras e mantém ações locais', async ({ page }, info) => {
  let realSends = 0;
  page.on('request', request => {
    if (/\/api\/conversations\/[^/]+\/send(?:-|$)/.test(request.url())) realSends++;
  });
  await openApp(page);
  await page.getByRole('button', { name: 'Espaço de Teste', exact: true }).click();
  await page.getByRole('button', { name: 'Carregar dados de exemplo', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Espaço de Teste' })).toBeVisible();

  const sections = page.getByLabel('Seções do espaço de teste');
  await sections.getByRole('button', { name: 'Campanhas', exact: true }).click();
  const category = page.getByLabel('Etiqueta', { exact: true });
  await category.click();
  await page.getByRole('option', { name: 'RM1', exact: true }).click();
  await expect(page.getByText(/clientes fictícios correspondem ao filtro/)).toBeVisible();
  await page.getByRole('button', { name: 'Selecionar todos os correspondentes' }).click();
  await page.getByRole('button', { name: 'Criar rascunho' }).click();
  const campaignDialog = page.getByRole('dialog');
  await campaignDialog.getByLabel('Nome', { exact: true }).fill('Auditoria campanha local');
  await campaignDialog.getByLabel('Intervalo mínimo (s)').fill('30');
  await campaignDialog.getByLabel('Intervalo máximo (s)').fill('30');
  await campaignDialog.getByRole('button', { name: 'Confirmar no teste' }).click();
  const batch = page.locator('article.surface').filter({ has: page.getByRole('heading', { name: 'Auditoria campanha local' }) });
  await expect(batch).toContainText('DRAFT');
  await batch.getByRole('button', { name: 'Iniciar / Retomar' }).click();
  await expect(batch).toContainText('ACTIVE');
  await batch.getByRole('button', { name: 'Pausar' }).click();
  await expect(batch).toContainText('PAUSED · Enviados no teste: 0');

  await sections.getByRole('button', { name: 'Kanban e vendas', exact: true }).click();
  await expect(page.locator('.sandbox-kanban section')).toHaveCount(3);
  const lead = page.locator('.sandbox-kanban article').first();
  await lead.getByRole('button', { name: /Editar/ }).click();
  const leadDialog = page.getByRole('dialog');
  await leadDialog.getByLabel('Valor da venda (R$)').fill('777');
  await leadDialog.getByLabel('Dias sem interação').fill('12');
  await leadDialog.getByRole('button', { name: 'Confirmar no teste' }).click();
  await expect(lead).toContainText('12 dias sem interação');
  await expect(lead).toContainText('R$ 777.00');

  await sections.getByRole('button', { name: 'Equipe e transferências', exact: true }).click();
  await page.getByRole('button', { name: 'Solicitar transferência' }).click();
  const transferDialog = page.getByRole('dialog');
  await transferDialog.getByRole('combobox', { name: 'Atendente ou fila de setor' }).click();
  await page.getByRole('option', { name: 'Ana Souza · Comercial · Online' }).click();
  await transferDialog.getByLabel('Observações').fill('Transferência fictícia para validar o fluxo.');
  await transferDialog.getByRole('button', { name: 'Confirmar no teste' }).click();
  const transfer = page.locator('.sandbox-row').filter({ hasText: 'Transferência fictícia para validar o fluxo.' });
  await expect(transfer).toContainText('Pendente');
  await transfer.getByRole('button', { name: 'Aceitar no teste' }).click();
  await expect(transfer).toContainText('Aceita');

  await sections.getByRole('button', { name: 'Agenda', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Agenda fictícia' })).toBeVisible();
  await expect(page.getByText('Retornar sobre o orçamento')).toBeVisible();
  await sections.getByRole('button', { name: 'Biblioteca e atalhos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Biblioteca do teste' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Áudio de demonstração' })).toBeVisible();
  await expect(page.getByText('Transcrição fictícia: “Olá! Este é um áudio de demonstração. O prazo estimado é de dois dias úteis.”')).toBeVisible();
  await sections.getByRole('button', { name: 'Atendimento', exact: true }).click();
  if ((page.viewportSize()?.width ?? 1366) <= 480) await page.locator('.sandbox-contacts button').first().click();
  await page.getByRole('combobox', { name: 'Enviar no teste como' }).click();
  await page.getByRole('option', { name: 'Cliente fictício (testar gatilho)' }).click();
  if ((page.viewportSize()?.width ?? 1366) <= 480) {
    await page.getByRole('button', { name: 'Mensagens e recursos' }).click();
    await page.getByRole('button', { name: 'Mostrar recursos' }).click();
  }
  const welcome = page.locator('.sandbox-resources article').filter({ has: page.getByRole('button', { name: 'Boas-vindas' }) });
  await welcome.getByRole('button', { name: 'Fixar', exact: true }).click();
  await welcome.getByRole('button', { name: 'Enviar', exact: true }).click();
  if ((page.viewportSize()?.width ?? 1366) <= 480) await page.getByRole('button', { name: 'Voltar à conversa' }).click();
  await expect(page.getByRole('log', { name: 'Conversa fictícia' })).toContainText('Olá, Marina! Como podemos ajudar no seu projeto?');

  await sections.getByRole('button', { name: 'Autoatendimento', exact: true }).click();
  await page.getByRole('button', { name: 'Testar no atendimento virtual' }).click();
  await page.clock.install();
  const testComposer = page.getByLabel('Mensagem no espaço de teste');
  await testComposer.fill('oi');
  await page.getByRole('button', { name: 'Enviar no teste' }).click();
  const presence = page.locator('.sandbox-chat small[role="status"]');
  await page.clock.runFor(20);
  await expect(presence).toHaveText('A escrever…');
  await page.clock.runFor(1200);
  await expect(presence).toHaveText('A gravar áudio…');
  expect(realSends).toBe(0);
  await saveEvidence(page, ['REQ-333', 'REQ-340', 'REQ-341', 'REQ-342', 'REQ-344', 'REQ-347', 'REQ-348', 'REQ-349', 'REQ-350'], info, {
    campaignStatus: 'paused before first local tick',
    transfer: 'fictitious and accepted in sandbox',
    resource: 'pinned and sent only to sandbox conversation',
    whatsappSends: realSends,
  });
});

test('REQ-353/354/355/356 guias da central cobrem conexões, IA, campanhas, equipe e atalhos', async ({ page }, info) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Ajuda e configurações', exact: true }).click();
  const guides = page.locator('.help-guide');
  await expect(guides).toHaveCount(4);
  const connections = guides.filter({ has: page.getByRole('heading', { name: /1\. Conexões/ }) });
  await expect(connections).toContainText('QR Code');
  await expect(connections).toContainText('Aparelhos conectados');
  const automation = guides.filter({ has: page.getByRole('heading', { name: /2\. Autoatendimento/ }) });
  await expect(automation).toContainText('Espaço de Teste');
  await expect(automation).toContainText('Economia de Tokens');
  const campaigns = guides.filter({ has: page.getByRole('heading', { name: /3\. Campanhas/ }) });
  await expect(campaigns).toContainText('Excel');
  await expect(campaigns).toContainText('intervalos');
  const team = guides.filter({ has: page.getByRole('heading', { name: /4\. Atendimento/ }) });
  await expect(team).toContainText('HUD');
  await expect(team).toContainText('mensagens fixadas');
  for (const card of [connections, automation, campaigns, team]) {
    await expect(card.locator('header svg')).toHaveCount(1);
    await expect(card.locator('ol li')).not.toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Abrir seção' })).toBeVisible();
  }
  await saveEvidence(page, ['REQ-353', 'REQ-354', 'REQ-355', 'REQ-356'], info, { guides: 4, illustrated: true, actionable: true });
});
