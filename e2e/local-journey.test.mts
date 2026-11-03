import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect, type Browser } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createSqliteClient } from '../apps/server/src/database/sqlite-client.js';
import { createApp } from '../apps/server/src/app.js';
import { WhatsappService } from '../apps/server/src/modules/whatsapp/whatsapp.service.js';
import { CredentialCipher } from '../apps/server/src/modules/whatsapp/credential-cipher.js';
import { silentPublisher } from '../apps/server/src/modules/whatsapp/whatsapp.types.js';
import { CrmService } from '../apps/server/src/modules/crm/crm.service.js';

const root = process.cwd();
const audit = resolve(root, '.audit');
await mkdir(audit, { recursive: true });
const directory = await mkdtemp(join(audit, 'journey-'));
assert.ok(directory.startsWith(`${audit}${process.platform === 'win32' ? '\\' : '/'}`));
const databaseUrl = `file:${join(directory, 'journey.db').replace(/\\/g, '/')}`;
const db = createSqliteClient(databaseUrl);
// A socket factory must never be invoked in these disconnected, local journeys.
const whatsapp = new WhatsappService(db, new CredentialCipher(randomBytes(32)), silentPublisher, () => {
  throw new Error('Conexão externa proibida no teste.');
});
let sessionId: string;
let server: Server;
let apiOrigin: string;
let browser: Browser;
const evidenceDirectory = join(audit, 'journey-evidence');

before(async () => {
  execFileSync(
    process.execPath,
    [
      join(root, 'node_modules/prisma/build/index.js'),
      'migrate',
      'deploy',
      '--schema',
      join(root, 'apps/server/prisma/schema.prisma'),
    ],
    {
      env: { ...process.env, DATABASE_URL: databaseUrl, RUST_LOG: 'info' },
      stdio: 'pipe',
      windowsHide: true,
    },
  );
  sessionId = (await whatsapp.create('Conexão fictícia da jornada')).id;
  await new CrmService(db, whatsapp).initializeStages();
  server = createServer(createApp(db, whatsapp));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  apiOrigin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
  await mkdir(evidenceDirectory, { recursive: true });
});
after(async () => {
  await browser?.close();
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await whatsapp.shutdown();
  await db.$disconnect();
});

for (const [index, viewport] of [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
  { width: 390, height: 844 },
].entries()) {
  test(
    `JORNADA / REQ-455/457/466: contato → negócio → etapa → etiqueta → recarregar (${viewport.width})`,
    { timeout: 90000 },
    async () => {
      const originalName = `Cliente Fictício Jornada ${viewport.width}`;
      const editedName = `Contato Editado Jornada ${viewport.width}`;
      const phone = `55110000100${index}1`;
      const contact = await db.contact.create({
        data: { name: originalName, phoneNumber: phone, whatsappJid: `${phone}@s.whatsapp.net` },
      });
      const conversation = await db.conversation.create({
        data: { sessionId, contactId: contact.id, lastMessageAt: new Date() },
      });
      const labelId = `audit-journey-tag-${index}`;
      await db.label.create({ data: { id: labelId, name: `Etiqueta Jornada ${viewport.width}`, sessionId } });
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const failures: string[] = [];
      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname.startsWith('/api/')) {
          // Use real route/controller/database behavior, never fixture responses.
          const response = await route.fetch({
            url: `${apiOrigin}${url.pathname}${url.search}`,
            maxRedirects: 0,
          });
          if (!response.ok() && !url.pathname.endsWith('/read'))
            failures.push(`${route.request().method()} ${url.pathname} ${response.status()}`);
          return route.fulfill({ response });
        }
        if (url.hostname === '127.0.0.1' && url.port === '5180') return route.continue();
        return route.abort();
      });
      try {
        // Complete the unrelated first-run profile through the isolated local API;
        // the journey under audit starts in the working application shell.
        const onboarding = await context.request.put(`${apiOrigin}/api/operations/me`, {
          headers: { origin: 'http://127.0.0.1:5180' },
          data: {
            name: `Operadora Fictícia ${viewport.width}`,
            company: `Empresa Fictícia ${viewport.width}`,
            segment: 'Teste local',
            employees: 'Somente eu',
            objective: '',
            social: '',
            phone: '',
            completed: true,
          },
        });
        assert.equal(onboarding.status(), 200, await onboarding.text());
        await page.goto('http://127.0.0.1:5180/atendimento');
        await expect(page.locator('.app-shell')).toBeVisible();
        await page.getByPlaceholder('Buscar nome ou telefone').fill(originalName);
        await page.locator('button.chat-item:not(.chat-item-more)').filter({ hasText: originalName }).click();
        await page.locator('.client-name-button').click();
        let dialog = page.getByRole('dialog');
        await dialog.getByLabel('Nome', { exact: true }).fill(editedName);
        await dialog.getByLabel('Telefone', { exact: true }).fill(`55110000200${index}1`);
        await dialog.getByRole('button', { name: 'Salvar dados', exact: true }).click();
        await expect(page.locator('.toast')).toContainText('Dados do cliente salvos.');
        await dialog.getByRole('button', { name: 'Fechar janela' }).click();
        const persistedContact = await db.contact.findUniqueOrThrow({ where: { id: contact.id } });
        assert.equal(persistedContact.name, editedName, 'REQ-455: nome persistido no SQLite real do teste');
        assert.equal(
          persistedContact.phoneNumber,
          `55110000200${index}1`,
          'REQ-455: telefone persistido sem trocar o contato',
        );
        assert.equal(
          persistedContact.whatsappJid,
          `${phone}@s.whatsapp.net`,
          'REQ-455: identificador da conexão preservado ao editar o telefone',
        );
        assert.equal(
          (await db.conversation.findUniqueOrThrow({ where: { id: conversation.id } })).contactId,
          contact.id,
          'REQ-455: conversa continua associada ao mesmo contato',
        );
        await page.getByRole('button', { name: 'CRM e negócios', exact: true }).click();
        await page.getByRole('button', { name: 'Nova etapa', exact: true }).click();
        dialog = page.getByRole('dialog');
        const stageName = `Etapa Jornada ${viewport.width}`;
        await dialog.getByLabel('Nome da etapa').fill(stageName);
        await dialog.getByRole('button', { name: 'Salvar etapa' }).click();
        await expect(page.getByLabel(`Etapa ${stageName}`, { exact: true })).toBeVisible();
        await page.getByRole('button', { name: new RegExp(`Editar negociação de ${editedName} em`) }).click();
        await page.getByLabel('Valor (R$)').fill('125.50');
        await page.getByRole('button', { name: 'Salvar negociação', exact: true }).click();
        await expect(page.locator('.toast')).toContainText('Negociação atualizada.');
        await page.getByRole('button', { name: new RegExp(`Editar negociação de ${editedName} em`) }).click();
        await page.locator('.opportunity-move').getByRole('combobox').click();
        await page.getByRole('option', { name: stageName, exact: true }).click();
        await page.getByRole('button', { name: 'Mover cartão', exact: true }).click();
        const stage = page.getByLabel(`Etapa ${stageName}`, { exact: true });
        await expect(
          stage.getByRole('button', { name: new RegExp(`Editar negociação de ${editedName} em`) }),
        ).toBeVisible();
        const opportunity = await db.crmOpportunity.findUniqueOrThrow({
          where: { conversationId: conversation.id },
        });
        assert.equal(opportunity.valueInCents, 12550, 'REQ-457: valor persistido em centavos');
        const tags = `${apiOrigin}/api/attendance/sessions/${sessionId}/conversations/${conversation.id}/labels/${labelId}`;
        for (const active of [true, false, true]) {
          const response = await context.request.put(tags, { data: { active } });
          assert.equal(response.status(), 200, await response.text());
          assert.deepEqual(
            await db.crmOpportunity.findUniqueOrThrow({ where: { conversationId: conversation.id } }),
            opportunity,
            'REQ-466: alterar etiquetas preserva etapa, valor e versão',
          );
        }
        await page.reload();
        await page.getByRole('button', { name: 'CRM e negócios', exact: true }).click();
        await expect(
          page
            .getByLabel(`Etapa ${stageName}`, { exact: true })
            .getByRole('button', { name: new RegExp(`Editar negociação de ${editedName} em`) }),
        ).toBeVisible();
        await page.screenshot({ path: join(evidenceDirectory, `crm-${viewport.width}.png`), fullPage: true });
        const reopened = createSqliteClient(databaseUrl);
        try {
          assert.deepEqual(
            await reopened.crmOpportunity.findUniqueOrThrow({ where: { conversationId: conversation.id } }),
            opportunity,
          );
          assert.equal(await reopened.contactLabel.count({ where: { contactId: contact.id, labelId } }), 1);
        } finally {
          await reopened.$disconnect();
        }
        assert.equal(await db.chatMessage.count(), 0, 'Nenhuma mensagem enviada');
        assert.deepEqual(failures, [], 'Nenhuma falha HTTP inesperada na jornada');
        await writeFile(
          join(evidenceDirectory, `crm-${viewport.width}.json`),
          JSON.stringify(
            {
              requirements: ['REQ-455', 'REQ-457', 'REQ-466'],
              result: 'APROVADO',
              viewport,
              realApiAndSqlite: true,
              isolatedDatabase: '.audit/journey-*/journey.db (temporary)',
              mutatedDemoDatabase: false,
              messageCount: 0,
              preservedContactId: contact.id,
              opportunity,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        await page.screenshot({
          path: join(evidenceDirectory, `crm-${viewport.width}-failure.png`),
          fullPage: true,
        });
        await writeFile(
          join(evidenceDirectory, `crm-${viewport.width}-failure.txt`),
          `${String(error)}\n${await page.locator('body').innerText()}`,
        );
        throw error;
      } finally {
        await context.close();
      }
    },
  );
}
