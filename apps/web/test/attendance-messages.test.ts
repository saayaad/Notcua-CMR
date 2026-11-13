import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import { MessageRevision } from '../src/components/MessageRevision.js';

test('REQ-ATENDIMENTO editada identifica a mensagem e permite abrir o texto original', () => {
  const markup = renderToStaticMarkup(createElement(MessageRevision, {
    editedAt: '2026-11-13T10:00:00.000Z',
    editedByClient: true,
    originalText: 'Texto antes da edição',
  }));
  assert.match(markup, /Editada pelo cliente/);
  assert.match(markup, /<details class="edited-original">/);
  assert.match(markup, /Ver texto original/);
  assert.match(markup, /Texto antes da edição/);
});

test('REQ-ATENDIMENTO apagada mantém o X de exclusão com estilo vermelho', async () => {
  const markup = renderToStaticMarkup(createElement(MessageRevision, { deleted: true }));
  const css = await readFile(new URL('../src/components/MessageRevision.css', import.meta.url), 'utf8');
  assert.match(markup, /Apagada pelo cliente/);
  assert.match(markup, /deleted-message-badge/);
  assert.match(css, /\.message-bubble \.deleted-message-badge\s*\{\s*color:\s*#f87171/s);
});
