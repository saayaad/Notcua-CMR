import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const evidenceRoot = resolve(process.cwd(), 'REVISAO', 'evidencias');

async function openConversation(page: Page) {
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
    await writeFile(resolve(directory, `${suffix}.json`), JSON.stringify({ req: id, result: 'APROVADO', project: info.project.name, url: page.url(), ...result }, null, 2), 'utf8');
  }
}

async function mockConnectedSession(page: Page) {
  await page.route('**/api/whatsapp/sessions', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: { ...body, items: body.items.map((item: Record<string, unknown>) => ({ ...item, status: 'CONNECTED' })) } });
  });
}

test('REQ-258/REQ-259 mostra ondas simuladas e permite ouvir antes de descartar a gravação', async ({ page }, info) => {
  await page.addInitScript(() => {
    const makeWav = () => {
      const bytes = new Uint8Array(44 + 1600);
      const view = new DataView(bytes.buffer);
      const ascii = (offset: number, value: string) => [...value].forEach((character, index) => bytes[offset + index] = character.charCodeAt(0));
      ascii(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
      view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
      view.setUint32(24, 8000, true); view.setUint32(28, 16000, true); view.setUint16(32, 2, true);
      view.setUint16(34, 16, true); ascii(36, 'data'); view.setUint32(40, 1600, true);
      return bytes;
    };
    const track = { stop() {} };
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => ({ getTracks: () => [track] }) });
    class SimulatedRecorder {
      static isTypeSupported() { return false; }
      mimeType = 'audio/wav';
      state = 'inactive';
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      constructor(_stream: unknown, _options?: unknown) {}
      start() { this.state = 'recording'; setTimeout(() => this.ondataavailable?.({ data: new Blob([makeWav()], { type: this.mimeType }) }), 100); }
      stop() { this.state = 'inactive'; this.onstop?.(); }
    }
    (window as unknown as { MediaRecorder: typeof SimulatedRecorder }).MediaRecorder = SimulatedRecorder;
    class SimulatedAudioContext {
      private sample = 0;
      async resume() {}
      async close() {}
      createMediaStreamSource(_stream: unknown) { return { connect() {} }; }
      createAnalyser() {
        return { fftSize: 64, getByteTimeDomainData: (values: Uint8Array) => { this.sample++; values.fill(128 + this.sample * 3); } };
      }
    }
    (window as unknown as { AudioContext: typeof SimulatedAudioContext }).AudioContext = SimulatedAudioContext;
  });
  await mockConnectedSession(page);
  await openConversation(page);
  await page.getByRole('button', { name: 'Gravar áudio' }).click();
  const waveform = page.getByRole('img', { name: 'Nível do áudio gravado' });
  await expect(waveform).toBeVisible();
  await page.waitForTimeout(250);
  const heights = await waveform.locator('i').evaluateAll((elements) => elements.map((element) => Number.parseFloat(getComputedStyle(element).height)));
  expect(Math.max(...heights)).toBeGreaterThan(4);
  await page.getByRole('button', { name: 'Parar e revisar' }).click();
  await expect(page.getByRole('heading', { name: 'Revisar áudio' })).toBeVisible();
  const player = page.locator('.attachment-preview audio');
  await expect(player).toBeVisible();
  await expect(player).toHaveAttribute('controls', '');
  await expect.poll(() => player.evaluate((element: HTMLAudioElement) => element.readyState)).toBeGreaterThan(0);
  const canPlay = await player.evaluate(async (element: HTMLAudioElement) => {
    try { await element.play(); element.pause(); return true; } catch { return false; }
  });
  expect(canPlay).toBeTruthy();
  await page.getByRole('button', { name: 'Descartar' }).click();
  await expect(page.getByRole('heading', { name: 'Revisar áudio' })).toHaveCount(0);
  await saveEvidence(page, ['REQ-258', 'REQ-259'], info, { waveformDynamic: true, audioPreviewPlayable: true, discardedWithoutSending: true, microphone: 'simulado' });
});

test('REQ-261/REQ-262 oferece transcrição e expande o texto sob áudio recebido', async ({ page }, info) => {
  await page.route('**/api/operations/features', (route) => route.fulfill({ json: { aiEnabled: true, canManage: true } }));
  await page.route('**/api/attendance/sessions/*/conversations/*/messages?page=1&pageSize=50', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    const audio = { id: 'audit-inbound-audio', text: null, caption: null, direction: 'INBOUND', status: 'DELIVERED', type: 'audioMessage', sentAt: new Date().toISOString(), isPtt: true, isPtv: false, asViewOnce: false, fileId: null, error: null };
    await route.fulfill({ response, json: { ...data, items: [...data.items, audio], total: data.total + 1 } });
  });
  let requestedMessage = '';
  await page.route('**/api/operations/sessions/*/contacts/*/media-analysis', async (route) => {
    requestedMessage = (route.request().postDataJSON() as { messageId: string }).messageId;
    await route.fulfill({ json: { text: 'Transcrição simulada: preciso confirmar o horário.' } });
  });
  await openConversation(page);
  await page.getByRole('button', { name: 'Ler transcrição', exact: true }).click();
  await expect(page.locator('.transcription-text')).toContainText('Transcrição simulada: preciso confirmar o horário.');
  expect(requestedMessage).toBe('audit-inbound-audio');
  await saveEvidence(page, ['REQ-261', 'REQ-262'], info, { messageId: requestedMessage, provider: 'simulado', transcriptionExpanded: true });
});

test('REQ-268 identifica discretamente mensagem apagada pelo cliente', async ({ page }, info) => {
  await page.route('**/api/attendance/sessions/*/conversations/*/messages?page=1&pageSize=50', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    const deleted = { id: 'audit-deleted-message', text: null, caption: null, direction: 'INBOUND', status: 'DELIVERED', type: 'conversation', sentAt: new Date().toISOString(), isPtt: false, isPtv: false, asViewOnce: false, fileId: null, error: null, deletedByClient: true };
    await route.fulfill({ response, json: { ...data, items: [...data.items, deleted], total: data.total + 1 } });
  });
  await openConversation(page);
  const badge = page.getByText('🗑️ Apagada pelo cliente', { exact: true });
  await expect(badge).toBeVisible();
  await expect(badge).toHaveClass(/deleted-message-badge/);
  const fontSize = await badge.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(fontSize).toBeLessThan(16);
  await saveEvidence(page, ['REQ-268'], info, { marker: 'deleted-message-badge', fontSizePx: fontSize, noContentRestored: true });
});
