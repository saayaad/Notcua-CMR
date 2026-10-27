import test from 'node:test';
import assert from 'node:assert/strict';
import { menuPosition, safeMenuUrl } from '../../web/src/context/context-menu-utils.js';

test('menu permanece dentro da tela nas quatro bordas e em viewport estreita', () => {
  assert.deepEqual(menuPosition(1000, 700, 240, 300, 1024, 720), { left: 776, top: 412 });
  assert.deepEqual(menuPosition(-50, -20, 240, 300, 320, 480), { left: 8, top: 8 });
  assert.deepEqual(menuPosition(300, 470, 304, 464, 320, 480), { left: 8, top: 8 });
  assert.deepEqual(menuPosition(50, 60, 240, 300, 1024, 720), { left: 50, top: 60 });
});

test('menu rejeita links executáveis e aceita somente navegação segura', () => {
  const base = 'https://noctua.example/atendimento';
  assert.equal(safeMenuUrl('javascript:alert(1)', base), null);
  assert.equal(safeMenuUrl('data:text/html,<script>bad()</script>', base), null);
  assert.equal(safeMenuUrl('file:///private.txt', base), null);
  assert.equal(safeMenuUrl('/biblioteca', base), 'https://noctua.example/biblioteca');
  assert.equal(safeMenuUrl('blob:https://noctua.example/media', base), 'blob:https://noctua.example/media');
  assert.equal(safeMenuUrl('https://example.com', base), 'https://example.com/');
});
