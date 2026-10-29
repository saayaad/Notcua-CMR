import test from 'node:test';
import assert from 'node:assert/strict';
import {
  floatingBlocksOverlap,
  normalizeFloatingPositions,
  snapFloatingPosition,
  type HudBlockPosition,
} from '../../web/src/context/hud-placement.js';

const floating = (x: number, y: number, width: number, height: number): HudBlockPosition => ({
  mode: 'floating', x, y, width, height,
});

test('REQ-510: ao soltar sobre outro bloco, encaixa no espaço livre mais próximo', () => {
  const obstacle = floating(30, 20, 20, 20);
  const desired = floating(20, 20, 20, 20);
  const snapped = snapFloatingPosition('chat', desired, { tools: obstacle });
  assert.deepEqual(snapped, floating(9.5, 20, 20, 20));
  assert.equal(floatingBlocksOverlap(snapped, obstacle), false);
  assert.deepEqual(obstacle, floating(30, 20, 20, 20));
});

test('REQ-510: preserva posição livre e resolve colisões legadas sem mover blocos anteriores', () => {
  const clear = floating(70, 70, 20, 20);
  assert.deepEqual(snapFloatingPosition('chat', clear, { tools: floating(0, 0, 20, 20) }), clear);
  const result = normalizeFloatingPositions({
    chat: floating(10, 10, 30, 30),
    functions: floating(10, 10, 30, 30),
    tools: { mode: 'dock', x: 0, y: 0, width: 20, height: 20 },
  });
  assert.deepEqual(result.chat, floating(10, 10, 30, 30));
  assert.equal(result.functions!.mode, 'floating');
  assert.equal(floatingBlocksOverlap(result.chat!, result.functions!), false);
  assert.equal(result.tools!.mode, 'dock');
});

test('REQ-510: sem espaço livre, volta ao layout encaixado', () => {
  const result = snapFloatingPosition('chat', floating(20, 20, 20, 20), {
    tools: floating(0, 0, 100, 100),
  });
  assert.equal(result.mode, 'dock');
});
