import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function evidence(page: Page, id: string, info: TestInfo, details: object) {
  const directory = resolve('REVISAO/evidencias', id);
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: resolve(directory, `${info.project.name}-representative.png`),
    fullPage: true,
  });
  await writeFile(
    resolve(directory, `${info.project.name}-representative.json`),
    JSON.stringify(
      {
        req: id,
        result: 'APROVADO-LOCAL',
        acceptance:
          'Cenários representativos por módulo aprovados pelo usuário em 31/10/2026; não certifica todas as 504 ações.',
        ...details,
      },
      null,
      2,
    ),
  );
}

test.beforeEach(async ({ page }) => {
  let preferences: Record<string, unknown> = {
    attendanceCustomizationVersion: 3,
    toolsVisible: true,
    toolsDocked: true,
    labelStyles: { 'audit-stage': { color: '#ff0000', icon: 'X' } },
  };
  await page.route('**/api/**', (route) => {
    if (route.request().method() === 'GET') return route.continue();
    if (/\/(presence|read)$/.test(new URL(route.request().url()).pathname))
      return route.fulfill({ json: { saved: true } });
    return route.fulfill({ status: 403, json: { message: 'Mutação não prevista pelo cenário local.' } });
  });
  await page.route('**/api/operations/settings/preferences', (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: preferences });
    preferences = route.request().postDataJSON();
    return route.fulfill({ json: { saved: true } });
  });
});

async function open(page: Page) {
  await page.goto('/atendimento');
  await expect(page.locator('.app-shell')).toBeVisible();
  await expect(
    page.locator('[aria-label="Atendimento com painéis encaixáveis"], .inbox-layout'),
  ).toBeVisible();
}

test('REQ-197: CRM salva etapa e Campanhas atualiza dados e filtra resultados verificáveis', async ({
  page,
}, info) => {
  const stages: {
    id: string;
    labelId: string | null;
    name: string;
    color: string;
    conversationIds: string[];
    totalValueInCents: number;
  }[] = [
    {
      id: 'unlabelled',
      labelId: null,
      name: 'Sem etapa',
      color: '#999999',
      conversationIds: [],
      totalValueInCents: 0,
    },
  ];
  await page.route('**/api/crm/sessions/*/board**', (route) =>
    route.fulfill({
      json: { cards: [], columns: stages, total: 0, loaded: 0, limit: 500, pendingSync: 0, failedSync: 0 },
    }),
  );
  await page.route('**/api/crm/sessions/*/labels', async (route) => {
    expect(route.request().method()).toBe('POST');
    const body = route.request().postDataJSON();
    stages.push({
      id: 'audit-stage',
      labelId: 'audit-stage',
      name: body.name,
      color: body.color,
      conversationIds: [],
      totalValueInCents: 0,
    });
    await route.fulfill({ status: 201, json: { id: 'audit-stage' } });
  });
  let reads = 0;
  let refreshed = false;
  await page.route('**/api/operations/sessions/*/batches', (route) => {
    reads++;
    return route.fulfill({
      json: {
        items: [
          {
            id: 'audit-batch',
            name: refreshed ? 'Campanha atualizada fictícia' : 'Campanha inicial fictícia',
            mode: 'CAMPAIGN',
            status: 'DRAFT',
            count: 0,
            counts: [],
            createdAt: '2026-10-31T12:00:00Z',
          },
        ],
      },
    });
  });
  await open(page);
  await page.getByRole('button', { name: 'CRM e negócios', exact: true }).click();
  await page.getByRole('button', { name: 'Nova etapa', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome da etapa').fill('Etapa fictícia aprovada');
  await dialog.getByRole('button', { name: 'Salvar etapa' }).click();
  await expect(page.locator('.toast')).toContainText('Etapa salva.');
  await expect(page.getByLabel('Etapa Etapa fictícia aprovada', { exact: true })).toBeVisible();
  const stageMarker = page
    .getByLabel('Etapa Etapa fictícia aprovada', { exact: true })
    .locator('header i')
    .first();
  await expect(stageMarker, 'REQ-197 / REQ-466: estilo de etiqueta não altera a cor da etapa').not.toHaveCSS(
    'background-color',
    'rgb(255, 0, 0)',
  );
  await page.getByRole('button', { name: 'Campanhas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Campanha inicial fictícia' })).toBeVisible();
  const initialReads = reads;
  refreshed = true;
  await page.getByRole('button', { name: 'Atualizar envios' }).click();
  await expect(page.getByRole('heading', { name: 'Campanha atualizada fictícia' })).toBeVisible();
  await page.getByLabel('Buscar campanha').fill('sem-correspondencia');
  await expect(page.getByRole('heading', { name: 'Campanha atualizada fictícia' })).toBeHidden();
  await page.getByLabel('Buscar campanha').fill('atualizada');
  await expect(page.getByRole('heading', { name: 'Campanha atualizada fictícia' })).toBeVisible();
  expect(stages[1]?.name, 'REQ-197: ação Salvar etapa transmite o resultado esperado').toBe(
    'Etapa fictícia aprovada',
  );
  expect(reads, 'REQ-197: atualizar consulta novamente os dados').toBeGreaterThan(initialReads);
  await evidence(page, 'REQ-197', info, {
    modules: ['CRM', 'Campanhas'],
    asserted: ['stage-submit-and-result', 'success-feedback', 'refresh-data', 'filter-hide-and-restore'],
    apiMutationsMocked: true,
  });
});

test('REQ-223: Personalização confirma densidade, mostra sucesso e mantém após reload', async ({
  page,
}, info) => {
  await open(page);
  await page.getByRole('button', { name: 'Personalização', exact: true }).click();
  await page.getByRole('main').getByRole('button', { name: 'Personalizar Atendimento com prévia' }).click();
  await page.getByRole('combobox', { name: 'Tamanho dos controles' }).click();
  await page.getByRole('option', { name: 'Expandido', exact: true }).click();
  await expect(page.locator('.hud-preview-expanded')).toBeVisible();
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/operations/settings/preferences') &&
      response.request().method() === 'PUT' &&
      response.ok(),
  );
  await page.getByRole('button', { name: 'Confirmar alterações' }).click();
  await saved;
  await expect(page.locator('.toast')).toContainText('Atendimento personalizado e salvo na sua conta.');
  await page.reload();
  await expect(
    page.locator('html'),
    'REQ-223: confirmação altera densidade persistida após recarregar',
  ).toHaveAttribute('data-density', 'expanded');
  await evidence(page, 'REQ-223', info, {
    modules: ['Personalização'],
    asserted: ['preview', 'confirm-action', 'success-feedback', 'reload-persistence'],
    preferencesBackend: 'fixture local',
    certification: 'Amostragem aprovada, não prova de todas as ações.',
  });
});

test('REQ-448 / REQ-197: macro mostra carregamento, preserva rascunho no erro e informa sucesso ao salvar', async ({
  page,
}, info) => {
  let attempts = 0;
  let release: (() => void) | undefined;
  let lastBody: any;
  await page.route('**/api/operations/macros', async (route) => {
    attempts++;
    lastBody = route.request().postDataJSON();
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fulfill(
      attempts === 1
        ? { status: 503, json: { error: { message: 'Falha fictícia de salvamento.' } } }
        : { status: 201, json: { id: 'audit-representative-macro' } },
    );
  });
  await open(page);
  await page.locator('button.chat-item:not(.chat-item-more)').first().click();
  await expect(page.locator('.client-name-button')).toBeVisible();
  const tools = page.getByLabel('Ferramentas de atendimento');
  if (!(await tools.isVisible())) {
    const toggle = page.getByRole('button', { name: 'Mostrar biblioteca lateral' });
    if (await toggle.isVisible()) await toggle.click();
    else {
      await page.locator('.chat-more-actions summary').click();
      const show = page.getByRole('button', { name: 'Mostrar mensagens fixadas', exact: true });
      if (await show.isVisible()) await show.click();
    }
  }
  await expect(tools).toBeVisible();
  await tools.locator('.workbench-create summary').click();
  await tools.locator('.workbench-create').getByRole('button', { name: 'Macros', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome da macro').fill('Macro fictícia representativa');
  await dialog.getByRole('textbox', { name: 'Mensagem', exact: true }).fill('Conteúdo fictício verificável');
  await dialog.getByRole('button', { name: 'Salvar macro', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Salvando macro…' })).toBeDisabled();
  await expect.poll(() => Boolean(release)).toBe(true);
  release!();
  release = undefined;
  await expect(page.locator('.toast')).toContainText('Falha fictícia de salvamento.');
  await expect(dialog.getByLabel('Nome da macro')).toHaveValue('Macro fictícia representativa');
  await expect(dialog.getByRole('textbox', { name: 'Mensagem', exact: true })).toHaveValue(
    'Conteúdo fictício verificável',
  );
  await dialog.getByRole('button', { name: 'Salvar macro', exact: true }).click();
  await expect.poll(() => Boolean(release)).toBe(true);
  release!();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.toast')).toContainText('Macro salva.');
  expect(lastBody.actions[0].text, 'REQ-448: salvar envia o conteúdo esperado após retry').toBe(
    'Conteúdo fictício verificável',
  );
  expect(attempts, 'REQ-197: erro não gera repetição automática nem duplica o clique').toBe(2);
  await evidence(page, 'REQ-448', info, {
    module: 'Atendimento',
    asserted: [
      'save-loading-disabled',
      '503-visible-feedback',
      'draft-preserved',
      'retry',
      'success-feedback',
    ],
    apiMutationsMocked: true,
  });
  await writeFile(
    resolve('REVISAO/evidencias/REQ-197', `${info.project.name}-attendance.json`),
    JSON.stringify(
      {
        req: 'REQ-197',
        result: 'APROVADO-LOCAL',
        module: 'Atendimento',
        actions: ['save-loading-disabled', 'error-feedback', 'draft-preserved', 'retry-success'],
        attempts,
      },
      null,
      2,
    ),
  );
});
