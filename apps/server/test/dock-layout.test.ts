import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readDockLayout } from '../../web/src/context/dock-layout.js';

test('Vercel preserva a página vazia da janela externa e os arquivos estáticos', async () => {
  const config = JSON.parse(await readFile(new URL('../../../vercel.json', import.meta.url), 'utf8'));
  const route = new RegExp(`^${config.rewrites[0].source}$`);
  assert.equal(route.test('/atendimento'), true);
  assert.equal(route.test('/popout.html'), false);
  assert.equal(route.test('/assets/app.js'), false);
  const html = await readFile(new URL('../../web/public/popout.html', import.meta.url), 'utf8');
  assert.ok(html.includes('Noctua'));
  assert.equal(html.includes('<script'), false);
});

const group = (id: string, views: string[]) => ({ id, views, activeView: views[0] });
const initial = () => ({
  grid: {
    root: { type: 'branch', data: [{ type: 'leaf', data: group('g1', ['chat']), size: 900 }], size: 600 },
    width: 900,
    height: 600,
    orientation: 'HORIZONTAL',
  },
  panels: {
    chat: {
      id: 'chat',
      contentComponent: 'workspace',
      title: 'Conversa',
      params: { privateText: 'NÃO PERSISTIR' },
    },
  },
});
test('layout salva somente identificação estrutural, sem parâmetros da conversa', () => {
  const parsed = readDockLayout(JSON.stringify(initial()));
  assert.ok(parsed);
  assert.equal(JSON.stringify(parsed).includes('NÃO PERSISTIR'), false);
  assert.deepEqual(readDockLayout(JSON.stringify(parsed)), parsed);
});
test('restauração recupera janela externa como painel local sem abrir URL', () => {
  const value = {
    ...initial(),
    panels: { ...initial().panels, tools: { id: 'tools', contentComponent: 'workspace' } },
    popoutGroups: [{ data: group('external', ['tools']), url: 'https://invalid.example', position: null }],
  };
  const parsed = readDockLayout(JSON.stringify(value), 800, 500);
  assert.ok(parsed);
  assert.equal(parsed.popoutGroups, undefined);
  assert.equal(parsed.floatingGroups?.length, 1);
  assert.equal(JSON.stringify(parsed).includes('invalid.example'), false);
});
test('layout rejeita componente desconhecido, referências duplicadas, protótipos e excesso de dados', () => {
  const invalid = initial();
  invalid.panels.chat.contentComponent = 'foreign';
  assert.equal(readDockLayout(JSON.stringify(invalid)), null);
  const duplicate = initial();
  duplicate.grid.root.data[0]!.data.views.push('chat');
  assert.equal(readDockLayout(JSON.stringify(duplicate)), null);
  assert.equal(
    readDockLayout(
      '{"panels":{"constructor":{}},"grid":{"root":{},"width":1,"height":1,"orientation":"HORIZONTAL"}}',
    ),
    null,
  );
  assert.equal(readDockLayout('x'.repeat(16001)), null);
});
test('painel flutuante é limitado à área disponível ao recuperar outro monitor', () => {
  const value = {
    ...initial(),
    panels: { ...initial().panels, tools: { id: 'tools', contentComponent: 'workspace' } },
    floatingGroups: [
      { data: group('float', ['tools']), position: { left: 5000, top: 3000, width: 1800, height: 1600 } },
    ],
  };
  const parsed = readDockLayout(JSON.stringify(value), 900, 600);
  assert.ok(parsed);
  assert.deepEqual(parsed.floatingGroups?.[0]?.position, { left: 0, top: 0, width: 900, height: 600 });
});
