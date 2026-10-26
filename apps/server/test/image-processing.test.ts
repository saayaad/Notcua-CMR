import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawWatermark, optimizeImage } from '../../web/src/image-processing.js';

test('marca d’água falha de forma segura; compressão opcional pode preservar original', async () => {
  const original = globalThis.createImageBitmap;
  globalThis.createImageBitmap = async () => { throw new Error('Imagem inválida'); };
  try {
    const file = new File(['imagem fictícia'], 'amostra.png', { type: 'image/png' });
    assert.equal(await optimizeImage(file), file);
    await assert.rejects(() => optimizeImage(file, { text: 'Amostra', opacity: 42, position: 'center' }), /Nenhum arquivo foi enviado/);
    const gif = new File(['gif'], 'animacao.gif', { type: 'image/gif' });
    assert.equal(await optimizeImage(gif), gif);
    await assert.rejects(() => optimizeImage(gif, { text: 'Amostra', opacity: 42, position: 'center' }), /imagem animada/);
  } finally {
    if (original) globalThis.createImageBitmap = original;
    else delete (globalThis as any).createImageBitmap;
  }
});

test('prévia e aplicação posicionam texto longo dentro da imagem e respeitam tamanho/opacidade', async () => {
  const translations: number[][] = [];
  const fontSizes: number[] = [];
  let font = '';
  const context = {
    save() {}, restore() {}, rotate() {},
    translate(x: number, y: number) { translations.push([x, y]); },
    set font(value: string) { font = value; fontSizes.push(Number(value.match(/[\d.]+(?=px)/)?.[0])); },
    get font() { return font; },
    measureText(text: string) { return { width: text.length * Number(font.match(/[\d.]+(?=px)/)?.[0]) * 0.6 }; },
    strokeText() {}, fillText() {}, globalAlpha: 0,
  };
  await drawWatermark(context as unknown as CanvasRenderingContext2D, 320, 180, {
    text: 'Amostra de aprovação — texto comprido para a imagem', opacity: 35, size: 200, position: 'bottom-right',
  });
  assert.equal(context.globalAlpha, 0.35);
  assert.ok(fontSizes.at(-1)! < fontSizes[0]!);
  assert.ok(translations[0]![0]! > 0 && translations[0]![0]! < 320);
  assert.ok(translations[0]![1]! > 0 && translations[0]![1]! < 180);
  await assert.rejects(() => drawWatermark(context as unknown as CanvasRenderingContext2D, 320, 180, {
    text: '', opacity: 35, position: 'center',
  }), /precisa de texto/);
});
