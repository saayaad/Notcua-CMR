import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const evidenceDir = resolve(process.cwd(), 'REVISAO', 'evidencias', 'REQ-126');

test('REQ-126 importação CSV permite mapear colunas e revisar antes de gravar', async ({ page }, info) => {
  const previewCalls: Array<{ phoneColumn?: number; nameColumn?: number }> = [];
  const blockedWrites: string[] = [];
  let importCalls = 0;
  let presenceCalls = 0;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.route('**/api/**', async route => {
    const request = route.request();
    const method = request.method();
    const url = request.url();
    if (method === 'POST' && url.includes('/operations/directory/presence')) {
      presenceCalls += 1;
      await route.fulfill({ json: { ok: true } });
      return;
    }
    if (method === 'POST' && url.includes('/operations/contacts/import/preview')) {
      const body = request.postDataJSON() as { phoneColumn?: number; nameColumn?: number };
      previewCalls.push({ phoneColumn: body.phoneColumn, nameColumn: body.nameColumn });
      const mapped = body.phoneColumn === 1 && body.nameColumn === 0;
      await route.fulfill({ json: {
        headers: ['Nome principal', 'Telefone principal'],
        phoneColumn: body.phoneColumn ?? 0,
        nameColumn: body.nameColumn ?? 1,
        items: [{
          name: mapped ? 'Lead CSV Fictício' : '558811122233',
          phoneNumber: mapped ? '558811122233' : '550000000000',
          tags: [], email: '', optIn: false,
        }],
        rejected: [], total: 1, inferred: true,
      } });
      return;
    }
    if (method === 'POST' && url.includes('/operations/sessions/') && url.includes('/contacts/import')) {
      importCalls += 1;
      blockedWrites.push(`${method} ${new URL(url).pathname}`);
      await route.fulfill({ status: 409, json: { message: 'Bloqueado: teste sem gravação.' } });
      return;
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      blockedWrites.push(`${method} ${new URL(url).pathname}`);
      await route.fulfill({ status: 409, json: { message: 'Bloqueado: teste sem gravação.' } });
      return;
    }
    await route.continue();
  });

  await page.goto('/atendimento');
  await expect(page.locator('.app-shell')).toBeVisible();
  await page.getByRole('button', { name: 'Contatos', exact: true }).click();
  await page.getByRole('button', { name: 'Importar Excel / CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Importar contatos de uma planilha' });
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'req126-colunas-invertidas.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Nome principal;Telefone principal\n558811122233;Lead CSV Fictício', 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Ler planilha', exact: true }).click();
  await expect(dialog.getByRole('combobox', { name: 'Coluna do telefone' })).toBeVisible();
  await dialog.getByRole('combobox', { name: 'Coluna do telefone' }).click();
  await page.getByRole('option', { name: 'Telefone principal', exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Coluna do nome' }).click();
  await page.getByRole('option', { name: 'Nome principal', exact: true }).click();
  await expect(dialog.locator('.import-preview')).toContainText('Lead CSV Fictício');
  await expect(dialog.locator('.import-preview')).toContainText('+558811122233');
  await expect(dialog.getByText('1 contatos válidos', { exact: false })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Importar 1 contatos' })).toBeEnabled();
  expect(previewCalls.at(-1)).toEqual({ phoneColumn: 1, nameColumn: 0 });
  expect(importCalls).toBe(0);
  expect(blockedWrites).toEqual([]);
  expect(errors).toEqual([]);

  await mkdir(evidenceDir, { recursive: true });
  const suffix = info.project.name.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
  await dialog.screenshot({ path: resolve(evidenceDir, `operation-acceptance-${suffix}.png`) });
  await writeFile(resolve(evidenceDir, `operation-acceptance-${suffix}.json`), JSON.stringify({
    req: 'REQ-126', result: 'APROVADO-LOCAL', project: info.project.name,
    checkpoints: {
      csvColumnMapping: { phoneColumn: 1, nameColumn: 0, mappedName: 'Lead CSV Fictício', mappedPhone: '558811122233' },
      previewBeforeSave: true,
      importMutationCalls: importCalls,
      nonPreviewWritesBlocked: blockedWrites,
      pageErrors: errors,
    },
    supportingEvidence: [
      'REQ-315/316: segmentação por listas importadas, etiquetas e inatividade; contador de público.',
      'REQ-317/318: conteúdo e intervalo, rascunho persistido e sem envio.',
      'REQ-288/320: cancelamento de campanha e agendamento fictício persistido como rascunho; nenhum envio.',
      'REQ-309: XLSX com colunas invertidas, mapeamento manual, prévia e reload; REQ-311/314: CSV, prévia antes da gravação e reload.',
    ],
    safety: { fictitiousCsv: true, databaseMutation: false, messagesSent: 0 },
    url: page.url(),
  }, null, 2), 'utf8');
});
