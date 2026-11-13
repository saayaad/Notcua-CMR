import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const origin = process.env.MEDIA_PREVIEW_URL ?? 'http://127.0.0.1:5173/dev-media-preview.html';
const shots: string[] = [];
const checks: { combo: string; scrollHeightDelta: number; anchorTopDelta: number }[] = [];
const combinations = [
  { name: 'dark-desktop', theme: 'dark', width: 1440, height: 1000 },
  { name: 'light-desktop', theme: 'light', width: 1440, height: 1000 },
  { name: 'dark-mobile', theme: 'dark', width: 390, height: 844 },
  { name: 'light-mobile', theme: 'light', width: 390, height: 844 },
];
const browser = await chromium.launch({ headless: true });

try {
  for (const combination of combinations) {
    const page = await browser.newPage({ viewport: { width: combination.width, height: combination.height }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(15000);
    await page.goto(`${origin}?hold=1`, { waitUntil: 'networkidle' });
    await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, combination.theme);

    const scroll = page.getByTestId('chat-scroll-container');
    const pending = page.locator('[data-media-id="audio-loading"] .conversation-media-skeleton.is-loading');
    await page.locator('[data-media-id="audio-loading"]').scrollIntoViewIfNeeded();
    await pending.waitFor({ state: 'visible' });
    const before = await page.locator('[data-fixture-message="audio-loading"]').evaluate((element) => {
      const root = element.closest('.media-fixture-scroll')!;
      return { scrollHeight: root.scrollHeight, anchorTop: element.getBoundingClientRect().top };
    });
    const loadingPath = join(tmpdir(), `noctua-media-${combination.name}-audio-loading.png`);
    await page.screenshot({ path: loadingPath });
    shots.push(loadingPath);

    await page.evaluate(() => window.__releaseMediaDownloads?.());
    await page.locator('[data-media-id="audio-error"] .conversation-media-error').waitFor({ state: 'visible' });
    for (const id of ['audio-short-in', 'audio-long-out', 'audio-loading']) {
      await page.locator(`.conversation-audio-player[data-audio-id="${id}"]`).waitFor({ state: 'visible' });
    }
    await page.locator('.conversation-media-image.is-ready img').nth(1).waitFor({ state: 'visible' });
    await page.locator('[data-media-id="audio-loading"] .conversation-media-skeleton.is-loading').waitFor({ state: 'detached' });
    const after = await page.locator('[data-fixture-message="audio-loading"]').evaluate((element) => {
      const root = element.closest('.media-fixture-scroll')!;
      return { scrollHeight: root.scrollHeight, anchorTop: element.getBoundingClientRect().top };
    });
    checks.push({ combo: combination.name, scrollHeightDelta: after.scrollHeight - before.scrollHeight, anchorTopDelta: after.anchorTop - before.anchorTop });
    assert.ok(Math.abs(after.scrollHeight - before.scrollHeight) <= 2, `${combination.name}: scrollHeight mudou ${after.scrollHeight - before.scrollHeight}px durante o carregamento`);
    assert.ok(Math.abs(after.anchorTop - before.anchorTop) <= 2, `${combination.name}: a mensagem mudou ${after.anchorTop - before.anchorTop}px durante o carregamento`);

    const errorPath = join(tmpdir(), `noctua-media-${combination.name}-audio-error.png`);
    await page.locator('[data-fixture-message="audio-error"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: errorPath });
    shots.push(errorPath);
    await page.locator('[data-media-id="audio-error"] .conversation-media-error button').click();
    await page.locator('.conversation-audio-player[data-audio-id="audio-error"]').waitFor({ state: 'visible' });

    const shortAudio = page.locator('.conversation-audio-player[data-audio-id="audio-short-in"]');
    await shortAudio.scrollIntoViewIfNeeded();
    const stoppedPath = join(tmpdir(), `noctua-media-${combination.name}-audio-stopped.png`);
    await page.screenshot({ path: stoppedPath });
    shots.push(stoppedPath);
    await shortAudio.getByRole('button', { name: 'Reproduzir áudio' }).click();
    await page.waitForFunction(() => {
      const audio = document.querySelector<HTMLAudioElement>('[data-audio-id="audio-short-in"] audio');
      return Boolean(audio && !audio.paused && audio.currentTime > 0.15);
    });
    const playingPath = join(tmpdir(), `noctua-media-${combination.name}-audio-playing.png`);
    await page.screenshot({ path: playingPath });
    shots.push(playingPath);
    await shortAudio.getByRole('button', { name: 'Pausar áudio' }).click();
    assert.equal(await shortAudio.locator('audio').evaluate((audio: HTMLAudioElement) => audio.paused), true);

    const imageRow = page.locator('[data-fixture-message="image-landscape"]');
    await imageRow.scrollIntoViewIfNeeded();
    const imagePath = join(tmpdir(), `noctua-media-${combination.name}-image-thumbnail.png`);
    await page.screenshot({ path: imagePath });
    shots.push(imagePath);
    await imageRow.getByRole('button', { name: 'Abrir imagem em tela cheia' }).click();
    const viewer = page.locator('dialog.conversation-lightbox[open]');
    await viewer.waitFor({ state: 'visible' });
    const lightboxPath = join(tmpdir(), `noctua-media-${combination.name}-image-lightbox.png`);
    await page.screenshot({ path: lightboxPath });
    shots.push(lightboxPath);
    await page.keyboard.press('ArrowRight');
    await viewer.getByAltText('Imagem vertical com legenda de exemplo.').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await viewer.waitFor({ state: 'detached' });

    const videoRow = page.locator('[data-fixture-message="video-sample"]');
    await videoRow.scrollIntoViewIfNeeded();
    await videoRow.getByRole('button', { name: 'Carregar vídeo' }).click();
    const video = videoRow.locator('video');
    await page.waitForFunction(() => {
      const element = document.querySelector<HTMLVideoElement>('[data-fixture-message="video-sample"] video');
      return Boolean(element && element.readyState >= 1 && element.duration > 0);
    }, undefined, { timeout: 20000 });
    const videoPath = join(tmpdir(), `noctua-media-${combination.name}-video-thumbnail.png`);
    await page.screenshot({ path: videoPath });
    shots.push(videoPath);
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ screenshots: shots, scrollStability: checks }, null, 2));
