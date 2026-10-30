import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inflateRawSync } from 'node:zlib';

const api = 'http://127.0.0.1:3340/api';
const evidenceRoot = resolve(process.cwd(), 'REVISAO', 'evidencias');

test.describe.configure({ mode: 'serial' });

async function openApp(page: Page) {
  await page.goto('/atendimento');
  await expect(page.getByRole('button', { name: 'Atendimento', exact: false }).first()).toBeVisible();
}

async function saveEvidence(page: Page, id: string, info: TestInfo, result: Record<string, unknown> = {}) {
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

async function enableSimulatedAi(page: Page) {
  const feature = await page.request.put(`${api}/operations/features`, { data: { aiEnabled: true } });
  expect(feature.ok()).toBeTruthy();
  const integration = await page.request.put(`${api}/operations/ai`, {
    data: {
      apiKey: 'fake-audit-key-not-real',
      provider: 'openai',
      model: 'modelo-simulado',
      instructions: 'Não inventar preços.',
      knowledge: 'Base fictícia.',
      style: 'Cordial',
      fallbackText: 'Encaminhando para a equipe.',
      enabled: true,
      mediaEnabled: true,
      mediaModel: 'modelo-simulado',
      dailyLimit: 100,
      dailyTokenLimit: 10000,
      maxOutputTokens: 1200,
      monthlyBudget: 5,
      inputPrice: 1,
      outputPrice: 2,
    },
  });
  expect(integration.ok()).toBeTruthy();
}

async function selectFirstConversation(page: Page) {
  await page.getByRole('button', { name: 'Atendimento', exact: false }).first().click();
  await page.locator('button.chat-item:not(.chat-item-more)').first().click();
  await expect(page.locator('.client-name-button')).toBeVisible();
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

test('REQ-136 menu alcança chat, Kanban, campanhas, contatos, IA e conexões', async ({ page }, info) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Atendimento', exact: false }).first().click();
  await expect(page.getByText('Cada conversa, uma oportunidade.')).toBeVisible();
  await page.getByRole('button', { name: 'CRM e negócios', exact: true }).click();
  await expect(page.getByRole('heading', { name: /CRM/ }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Campanhas', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Campanhas/ }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Contatos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Contatos', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Conexões', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Conexão fictícia da auditoria', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('button', { name: 'Integração de IA', exact: true }).click();
  await expect(page.getByText('Habilitar I.A.', { exact: true })).toBeVisible();
  await saveEvidence(page, 'REQ-136', info, { paths: ['chat', 'crm', 'campaigns', 'contacts', 'connections', 'ai'] });
});

test('REQ-137 chat mostra mídia, etiqueta e controle de pausa da IA simulada', async ({ page }, info) => {
  await enableSimulatedAi(page);
  await openApp(page);
  await selectFirstConversation(page);
  await page.getByRole('button', { name: 'Carregar imagem' }).click();
  await expect(page.getByAltText('Imagem da conversa')).toBeVisible();
  const mobileBack = page.getByRole('button', { name: 'Voltar à lista' });
  if (await mobileBack.isVisible()) {
    await mobileBack.click();
    await expect(page.getByText('Novo lead', { exact: true }).first()).toBeVisible();
    await selectFirstConversation(page);
  } else {
    await expect(page.getByText('Novo lead', { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText('IA ativa nesta conversa', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Assumir atendimento' })).toBeVisible();
  await saveEvidence(page, 'REQ-137', info, { media: 'image', label: 'Novo lead', ai: 'active' });
});

test('REQ-138 visão mostra fila, conexão e consumo de IA da operação', async ({ page }, info) => {
  await enableSimulatedAi(page);
  await openApp(page);
  await page.getByRole('button', { name: 'Visão geral', exact: true }).click();
  await expect(page.getByText('Envios pendentes', { exact: true })).toBeVisible();
  await expect(page.getByText('Tokens de IA hoje · operação', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Conexões', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Conexão fictícia da auditoria', exact: true })).toBeVisible();
  await expect(page.locator('.connection-detail .status-pill')).toHaveText('Desconectado');
  await saveEvidence(page, 'REQ-138', info, { queue: true, aiUsage: true, connectionState: 'disconnected' });
});

test('REQ-152/REQ-153/REQ-154 modelo, limites e regras persistem sem provedor real', async ({ page }, info) => {
  await enableSimulatedAi(page);
  await openApp(page);
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('button', { name: 'Integração de IA', exact: true }).click();
  const model = `modelo-${info.project.name}`;
  const rules = `Regra absoluta ${info.project.name}`;
  await page.getByLabel('Modelo de atendimento').fill(model);
  await page.getByLabel('Regras absolutas do administrador').fill(rules);
  await page.getByLabel('Tokens por dia · 0 sem limite').fill('4321');
  await page.getByLabel('Orçamento mensal estimado em US$ · 0 sem limite').fill('3.25');
  const saved = page.waitForResponse(
    (response) => response.url().endsWith('/api/operations/ai') && response.request().method() === 'PUT' && response.ok(),
  );
  await page.getByRole('button', { name: 'Salvar integração' }).click();
  await saved;
  await page.reload();
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('button', { name: 'Integração de IA', exact: true }).click();
  await expect(page.getByLabel('Modelo de atendimento'), 'REQ-152 persiste o modelo').toHaveValue(model);
  await expect(page.getByLabel('Tokens por dia · 0 sem limite'), 'REQ-153 persiste o limite').toHaveValue('4321');
  await expect(page.getByLabel('Orçamento mensal estimado em US$ · 0 sem limite'), 'REQ-153 persiste o orçamento').toHaveValue('3.25');
  await expect(page.getByLabel('Regras absolutas do administrador'), 'REQ-154 persiste as regras').toHaveValue(rules);
  for (const id of ['REQ-152', 'REQ-153', 'REQ-154'])
    await saveEvidence(page, id, info, { model, dailyTokenLimit: 4321, monthlyBudget: 3.25, rules });
});

test('REQ-156 pausa e retoma a IA por conversa com persistência após recarregar', async ({ page }, info) => {
  await enableSimulatedAi(page);
  await openApp(page);
  await selectFirstConversation(page);
  await page.getByRole('button', { name: 'Assumir atendimento' }).click();
  await expect(page.getByText('Atendimento humano · IA pausada', { exact: true })).toBeVisible();
  await page.reload();
  await selectFirstConversation(page);
  await expect(page.getByText('Atendimento humano · IA pausada', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retomar IA' }).click();
  await expect(page.getByText('IA ativa nesta conversa', { exact: true })).toBeVisible();
  await saveEvidence(page, 'REQ-156', info, { pausedAfterReload: true, resumed: true });
});

test('REQ-132/REQ-157/REQ-158 exporta seleção por responsável com mídias e formatos', async ({ page }, info) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Contatos', exact: true }).click();
  await page.getByRole('button', { name: 'Exportar históricos' }).click();
  await page.getByLabel('Responsável atual · e-mail ou identificador').fill('admin@example.com');
  await expect(page.getByLabel('Ana Exemplo')).toBeVisible();
  await expect(page.getByLabel('Bruno Exemplo')).toHaveCount(0);
  await page.getByLabel('Ana Exemplo').check();
  await page.getByLabel('Incluir arquivos de áudio, imagem e vídeo disponíveis').check();
  for (const id of ['REQ-132', 'REQ-157', 'REQ-158'])
    await saveEvidence(page, id, info, { responsible: 'admin@example.com', contact: 'Ana Exemplo', media: true });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar 1 conversas' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  const files = unzipEntries(await readFile(path!));
  expect(files.has('historico.json'), 'REQ-132 inclui manifesto do histórico').toBeTruthy();
  expect([...files.keys()].some((name) => name.startsWith('midias/') && name.endsWith('.png')), 'REQ-132 inclui a imagem').toBeTruthy();
  expect(files.has('dialogo.jsonl'), 'REQ-158 inclui JSONL').toBeTruthy();
  expect(files.has('dialogo.txt'), 'REQ-158 inclui TXT').toBeTruthy();
  expect(files.has('dialogo.csv'), 'REQ-158 inclui CSV').toBeTruthy();
  expect(files.get('dialogo.jsonl')!.toString()).toContain('"role":"user"');
});
