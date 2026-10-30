import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const evidenceRoot = resolve(process.cwd(), 'REVISAO', 'evidencias');
const aiReply = 'Objetivo: confirmar o prazo. Objeções: custo e disponibilidade. Próximo passo: enviar opções.';
const options = [
  'Entendo sua dúvida; posso explicar as opções.',
  'Posso verificar a disponibilidade antes de confirmar.',
  'Vamos comparar as alternativas com calma.',
];

test.describe.configure({ mode: 'serial' });

async function openWithSimulatedAi(page: Page) {
  await page.route('**/api/operations/features', (route) =>
    route.fulfill({ json: { aiEnabled: true, canManage: true } }),
  );
  await page.route('**/api/operations/sessions/*/contacts/*/ai', async (route) => {
    const { task } = route.request().postDataJSON() as { task: string };
    const text = task.startsWith('Crie um resumo executivo')
      ? aiReply
      : task.startsWith('Revise e melhore')
        ? 'Rascunho corrigido com clareza.'
        : JSON.stringify(options);
    await route.fulfill({ json: { text } });
  });
  await page.goto('/atendimento');
  await expect(page.locator('.app-shell')).toBeVisible();
  await page.locator('button.chat-item:not(.chat-item-more)').first().click();
  await expect(page.locator('.client-name-button')).toBeVisible();
}

async function saveEvidence(page: Page, ids: string[], info: TestInfo, result: Record<string, unknown>) {
  const suffix = info.project.name.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
  for (const id of ids) {
    const directory = resolve(evidenceRoot, id);
    await mkdir(directory, { recursive: true });
    await page.screenshot({ path: resolve(directory, `${suffix}.png`), fullPage: true });
    await writeFile(
      resolve(directory, `${suffix}.json`),
      JSON.stringify({ req: id, result: 'APROVADO', project: info.project.name, url: page.url(), simulatedProvider: true, ...result }, null, 2),
      'utf8',
    );
  }
}

test('REQ-250/REQ-251 abre o resumo e mostra objetivo, objeções e próximo passo', async ({ page }, info) => {
  await openWithSimulatedAi(page);
  const mobileSummary = page.locator('.mobile-summary-trigger');
  if (await mobileSummary.isVisible()) await mobileSummary.click();
  else {
    const summarize = page.getByRole('button', { name: 'Resumir conversa' });
    if (!(await summarize.isVisible())) await page.locator('.chat-more-actions summary').click();
    await summarize.click();
  }
  await expect(page.getByRole('heading', { name: '✨ Resumo da conversa' })).toBeVisible();
  await page.getByRole('button', { name: 'Gerar resumo' }).click();
  await expect(page.getByText(aiReply)).toBeVisible();
  await expect(page.getByText('Copiar resumo')).toBeVisible();
  await saveEvidence(page, ['REQ-250', 'REQ-251'], info, { summary: aiReply, resultModal: true });
});

test('REQ-252 revisa rascunho com Copiloto e só substitui após confirmação', async ({ page }, info) => {
  await openWithSimulatedAi(page);
  const draft = page.getByRole('textbox', { name: 'Mensagem', exact: true });
  await draft.fill('  rascunho simples  ');
  await page.getByRole('button', { name: 'Copiloto IA' }).click();
  await page.getByRole('button', { name: 'Melhorar e corrigir meu rascunho' }).click();
  await page.getByRole('checkbox', { name: /Enviar o histórico recente/ }).check();
  await page.getByRole('button', { name: 'Melhorar e corrigir', exact: true }).click();
  const suggestion = page.locator('.copilot-modal textarea');
  await expect(suggestion).toBeVisible();
  await expect(suggestion).toHaveValue('Rascunho corrigido com clareza.');
  await expect(draft).toHaveValue('  rascunho simples  ');
  await page.getByRole('button', { name: 'Usar no rascunho' }).click();
  await expect(draft).toHaveValue('Rascunho corrigido com clareza.');
  await saveEvidence(page, ['REQ-252'], info, { acceptedDraft: 'Rascunho corrigido com clareza.', sent: false });
});

test('REQ-253 sugere três respostas e aplica a opção escolhida ao rascunho', async ({ page }, info) => {
  await openWithSimulatedAi(page);
  await page.getByRole('button', { name: 'Copiloto IA' }).click();
  await page.getByRole('button', { name: 'Sugerir quebra de objeção' }).click();
  await page.getByRole('checkbox', { name: /Enviar o histórico recente/ }).check();
  await page.getByRole('button', { name: 'Sugerir respostas', exact: true }).click();
  for (const option of options) await expect(page.getByRole('button', { name: option, exact: true })).toBeVisible();
  await page.getByRole('button', { name: options[1], exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Mensagem', exact: true })).toHaveValue(options[1]);
  await saveEvidence(page, ['REQ-253'], info, { suggestions: options, selected: options[1], sent: false });
});
