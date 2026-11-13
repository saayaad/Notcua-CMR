import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mediaTypeLabel, requestComposerFocus } from '../src/components/message-preview.js';
import { uploadErrorMessage } from '../src/components/upload-errors.js';

test('tipo da mídia aparece com rótulo consistente na conversa e na lista', () => {
  assert.equal(mediaTypeLabel('audioMessage'), 'Áudio');
  assert.equal(mediaTypeLabel('imageMessage'), 'Foto');
  assert.equal(mediaTypeLabel('videoMessage'), 'Vídeo');
  assert.equal(mediaTypeLabel('documentMessage'), 'Documento');
});

test('envio agenda o foco de volta ao campo de mensagem', () => {
  let scheduled: (() => void) | undefined;
  let focused = false;
  requestComposerFocus(() => { focused = true; }, (callback) => { scheduled = callback; });
  assert.equal(focused, false);
  scheduled?.();
  assert.equal(focused, true);
});

test('erro de arquivo grande informa tamanho escolhido e limite configurado', () => {
  const message = uploadErrorMessage(Object.assign(new Error('Limite BODY_LIMIT_MB=40'), { status: 413 }), 25 * 1024 * 1024);
  assert.match(message, /25\.00 MiB/);
  assert.match(message, /BODY_LIMIT_MB=40/);
  assert.equal(uploadErrorMessage(new Error('Falha comum'), 1), 'Falha comum');
});
