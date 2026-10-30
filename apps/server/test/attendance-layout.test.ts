import test from 'node:test';
import assert from 'node:assert/strict';
import { toolTarget, hotkeyMatches } from '../../web/src/context/attendance.js';
import { hudGrid } from '../../web/src/context/hud.js';
test('atalhos de conteúdo abrem somente a lateral e ferramentas abrem somente uma janela', () => {
  assert.equal(toolTarget('responses'), 'shelf');
  assert.equal(toolTarget('catalog'), 'shelf');
  for (const section of ['faq', 'notes', 'profile', 'next', 'transfers', 'settings'])
    assert.equal(toolTarget(section), 'dialog');
});
test('teclas configuradas respeitam todas as modificadoras e ficam inativas quando vazias', () => {
  const event = { key: 'm', altKey: true, ctrlKey: false, metaKey: false, shiftKey: false };
  assert.equal(hotkeyMatches(event, 'Alt+M'), true);
  assert.equal(hotkeyMatches({ ...event, ctrlKey: true }, 'Alt+M'), false);
  assert.equal(hotkeyMatches(event, ''), false);
  assert.equal(hotkeyMatches(event, 'M'), false);
  assert.equal(
    hotkeyMatches({ ...event, altKey: false, ctrlKey: true, shiftKey: true, key: 'M' }, 'Ctrl+Shift+M'),
    true,
  );
});
test('REQ-216: blocos desencaixados não deixam área fantasma e a lista empilhada preserva altura útil', () => {
  const preferences = {
    hudPanelLayout: 'columns',
    hudListWidth: 17,
    hudToolsWidth: 18,
    panelPosition: 'right',
  };
  assert.equal(hudGrid([], preferences)['--hud-areas'], 'none');
  assert.equal(hudGrid(['list', 'chat'], preferences)['--hud-areas'], '"list chat"');
  assert.equal(
    hudGrid(['list', 'chat', 'tools'], { ...preferences, hudPanelLayout: 'rows' })['--hud-areas'],
    '"list tools" "chat tools"',
  );
  assert.equal(
    hudGrid(['list', 'chat', 'tools'], { ...preferences, hudPanelLayout: 'rows' })['--hud-rows'],
    'clamp(20rem,42vh,26rem) minmax(0,1fr)',
  );
});
