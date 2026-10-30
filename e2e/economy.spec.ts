import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const evidenceRoot = resolve(process.cwd(), 'REVISAO', 'evidencias');

async function saveEvidence(page: Page, ids: string[], info: TestInfo, details: Record<string, unknown>, statusByReq: Record<string, string> = {}) {
  const suffix = info.project.name.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
  const consoleErrors = (page as Page & { __auditConsoleErrors?: string[] }).__auditConsoleErrors ?? [];
  for (const id of ids) {
    const directory = resolve(evidenceRoot, id);
    await mkdir(directory, { recursive: true });
    await page.screenshot({ path: resolve(directory, `${suffix}.png`), fullPage: true });
    await writeFile(resolve(directory, `${suffix}.json`), JSON.stringify({
      req: id, result: statusByReq[id] ?? 'APROVADO', project: info.project.name, url: page.url(), consoleErrors,
      provider: 'fixture local; nenhuma chamada externa', ...details,
    }, null, 2), 'utf8');
  }
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  (page as Page & { __auditConsoleErrors?: string[] }).__auditConsoleErrors = errors;
  await page.route('**/*operations/features**', (route) => route.fulfill({ json: { aiEnabled: true, canManage: true } }));
  await page.route('**/*settings/preferences**', (route) => route.fulfill({ json: { hudHiddenActions: [], hudHeaderOrder: [] } }));
});

test('REQ-414–REQ-429 Economia abre, persiste ajustes e permite revisar e remover cache', async ({ page }, info) => {
  let settings = {
    enabled: true, semanticCache: true, rag: true, cacheDays: 14, summaryEvery: 10,
    systems: { autoReply: true, copilot: true, summaries: true, campaigns: true, training: true, receipts: true, dailyDigest: true },
  };
  let items = [{ id: 'cache-audit-1', question: 'Qual o prazo do mascote?', answer: 'Prazo depende do escopo confirmado.', hits: 2, createdAt: new Date().toISOString(), approvedAt: undefined, sourceConversationId: 'conversation-fixture' }];
  await page.route('**/api/operations/economy/cache**', async (route) => {
    const url = new URL(route.request().url());
    const id = decodeURIComponent(url.pathname.split('/').at(-1) ?? '');
    if (route.request().method() === 'GET') return route.fulfill({ json: { items } });
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as { answer: string; approve?: boolean };
      items = items.map((item) => item.id === id ? { ...item, answer: body.answer, approvedAt: body.approve ? new Date().toISOString() : undefined } : item);
      return route.fulfill({ json: { saved: true, approved: Boolean(body.approve) } });
    }
    if (route.request().method() === 'DELETE') {
      items = url.pathname.endsWith('/cache') ? [] : items.filter((item) => item.id !== id);
      return route.fulfill({ json: { deleted: true } });
    }
    return route.fallback();
  });
  await page.route('**/api/operations/economy', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { settings, saved: { today: { tokens: 120, requests: 2 }, month: { tokens: 420, requests: 6 } } } });
    if (route.request().method() === 'PUT') { settings = route.request().postDataJSON() as typeof settings; return route.fulfill({ json: { saved: true } }); }
    return route.fallback();
  });
  await page.route('**/api/operations/ai', (route) => route.fulfill({ json: { enabled: false, configured: false, model: '', instructions: 'Regra base.', style: 'Tom cordial.', usage: {} } }));
  await page.goto('/atendimento');
  await expect(page.locator('.app-shell')).toBeVisible();
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('button', { name: 'Economia de Tokens', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Economia de tokens' })).toBeVisible();
  await expect(page.getByText('120 tokens estimados poupados hoje')).toBeVisible();
  await expect(page.getByText('420 tokens estimados poupados este mês')).toBeVisible();

  await page.getByText('Ativar técnicas de economia', { exact: true }).click();
  await page.getByLabel('Validade do cache (dias)').fill('21');
  await page.getByLabel('Atualizar resumo a cada mensagens').fill('15');
  await page.getByText('Autoatendimento e chatbot', { exact: true }).click();
  await page.getByText('Copiloto do vendedor', { exact: true }).click();
  await page.getByText('Resumos e passagem de turno', { exact: true }).click();
  await page.getByRole('button', { name: 'Salvar economia' }).click();
  expect(settings.enabled).toBe(false);
  expect(settings.cacheDays).toBe(21);
  expect(settings.summaryEvery).toBe(15);
  expect(settings.systems.autoReply).toBe(false);
  expect(settings.systems.copilot).toBe(false);
  expect(settings.systems.summaries).toBe(false);
  await page.reload();
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('button', { name: 'Economia de Tokens', exact: true }).click();
  await expect(page.getByLabel('Validade do cache (dias)')).toHaveValue('21');
  await expect(page.getByLabel('Atualizar resumo a cada mensagens')).toHaveValue('15');
  await expect(page.getByRole('checkbox', { name: 'Autoatendimento e chatbot' })).not.toBeChecked();

  const cacheHeading = page.getByRole('heading', { name: 'Respostas salvas no cache' });
  await expect(cacheHeading).toBeVisible();
  await expect(page.getByText('Qual o prazo do mascote?')).toBeVisible();
  const entry = page.locator('.economy-cache article').first();
  await entry.locator('textarea').fill('Resposta revisada sem dados pessoais.');
  await entry.getByRole('button', { name: 'Salvar rascunho' }).click();
  expect(items[0]?.answer).toBe('Resposta revisada sem dados pessoais.');
  await entry.getByRole('button', { name: 'Revisado · aprovar' }).click();
  expect(items[0]?.approvedAt).toBeTruthy();
  await entry.getByRole('button', { name: 'Remover' }).click();
  await expect(page.locator('.economy-cache article')).toHaveCount(0);
  items = [{ id: 'cache-audit-2', question: 'Fixture para limpeza do cache?', answer: 'Fictício.', hits: 0, createdAt: new Date().toISOString(), approvedAt: undefined, sourceConversationId: 'conversation-fixture' }];
  await page.reload();
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('button', { name: 'Economia de Tokens', exact: true }).click();
  await page.getByRole('button', { name: 'Limpar cache' }).click();
  expect(items).toHaveLength(0);
  await expect(page.locator('.economy-cache article')).toHaveCount(0);
  await saveEvidence(page, ['REQ-414', 'REQ-415', 'REQ-416', 'REQ-417', 'REQ-418', 'REQ-423', 'REQ-424', 'REQ-426', 'REQ-427', 'REQ-428', 'REQ-429'], info, { settings, dailyAndMonthlyStats: true, cacheReviewedApprovedEditedAndCleared: true, fixtureOnly: true });
});

test('REQ-419–REQ-422 controles sem consumidores são marcados DESCONECTADO', async ({ page }, info) => {
  const settings = { enabled: true, semanticCache: true, rag: true, cacheDays: 14, summaryEvery: 10, systems: { autoReply: true, copilot: true, summaries: true, campaigns: true, training: true, receipts: true, dailyDigest: true } };
  await page.route('**/api/operations/economy/cache**', (route) => route.fulfill({ json: { items: [] } }));
  await page.route('**/api/operations/economy', (route) => route.fulfill({ json: { settings, saved: { today: { tokens: 0, requests: 0 }, month: { tokens: 0, requests: 0 } } } }));
  await page.route('**/api/operations/ai', (route) => route.fulfill({ json: { enabled: false, configured: false, usage: {} } }));
  await page.goto('/atendimento');
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('button', { name: 'Economia de Tokens', exact: true }).click();
  for (const label of ['Campanhas e testes A/B', 'Treinamento do vendedor', 'Comprovantes e auditoria', 'Resumo diário de leads']) await expect(page.getByText(label, { exact: true })).toBeVisible();
  await saveEvidence(page, ['REQ-419', 'REQ-420', 'REQ-421', 'REQ-422'], info, { visibleButDisconnected: ['campaigns', 'training', 'receipts', 'dailyDigest'] }, { 'REQ-419': 'DESCONECTADA', 'REQ-420': 'DESCONECTADA', 'REQ-421': 'DESCONECTADA', 'REQ-422': 'DESCONECTADA' });
});

test('REQ-430 controle de embeddings ausente; REQ-439/REQ-440 revisão de otimização precede aplicar', async ({ page }, info) => {
  let config = { enabled: false, configured: true, model: 'simulado', instructions: 'Regra base.', style: 'Tom cordial.', usage: {} };
  await page.route('**/api/operations/economy/cache**', (route) => route.fulfill({ json: { items: [] } }));
  await page.route('**/api/operations/economy', (route) => route.fulfill({ json: { settings: { enabled: true, semanticCache: true, rag: true, cacheDays: 14, summaryEvery: 10, systems: { autoReply: true, copilot: true, summaries: true } }, saved: { today: { tokens: 0, requests: 0 }, month: { tokens: 0, requests: 0 } } } }));
  await page.route('**/api/operations/ai', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: config });
    if (route.request().method() === 'PUT') { config = route.request().postDataJSON() as typeof config; return route.fulfill({ json: { saved: true } }); }
    return route.fallback();
  });
  await page.route('**/api/operations/economy/optimize-prompts', (route) => route.fulfill({ json: { instructions: '- Preserve preço e exceção.', style: '- Use tom breve.' } }));
  await page.goto('/atendimento');
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('button', { name: 'Economia de Tokens', exact: true }).click();
  await expect(page.getByText('Indexar histórico e regras por embeddings')).toHaveCount(0);
  await page.getByRole('button', { name: 'Otimizar regras e estilo com IA' }).click();
  await expect(page.getByRole('heading', { name: 'Prévia das regras otimizadas' })).toBeVisible();
  expect(config.instructions).toBe('Regra base.');
  await expect(page.getByLabel('Regras')).toHaveValue('- Preserve preço e exceção.');
  await page.getByRole('button', { name: 'Revisado · aplicar' }).click();
  await expect(page.getByRole('heading', { name: 'Prévia das regras otimizadas' })).toHaveCount(0);
  expect(config.instructions).toBe('- Preserve preço e exceção.');
  await saveEvidence(page, ['REQ-430', 'REQ-439', 'REQ-440'], info, { embeddingControl: 'absent', proposalReviewedBeforeApply: true, provider: 'fixture local' }, { 'REQ-430': 'AUSENTE' });
});
