import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { exampleSandbox, sandboxAudience, tickSandbox } from '../../web/src/context/sandbox.js';

test('sandbox segmenta etiqueta e inatividade sem alterar a base de exemplo', () => {
  const state = exampleSandbox(0);
  const before = JSON.stringify(state);
  assert.deepEqual(
    sandboxAudience(state, 'rm2', 10).map((c) => c.name),
    ['Pedro Alves'],
  );
  assert.equal(sandboxAudience(state, '', 10).length, 3);
  assert.equal(JSON.stringify(state), before);
});

test('sandbox não executa campanha pausada e não duplica etapa concluída', () => {
  const state = exampleSandbox(0);
  state.batches = [
    {
      id: 'teste',
      name: 'Teste',
      ids: ['demo-0'],
      text: 'Olá, {{nome}}',
      min: 2,
      max: 5,
      status: 'PAUSED',
      sent: 0,
      next: 1000,
    },
  ];
  assert.equal(tickSandbox(state, 10000).batches[0]?.sent, 0);
  state.batches[0]!.status = 'ACTIVE';
  const initialCount = state.contacts[0]!.messages.length;
  assert.equal(tickSandbox(state, 999).contacts[0]!.messages.length, initialCount);
  const sent = tickSandbox(state, 1000);
  assert.equal(sent.contacts[0]!.messages.at(-1)?.text, 'Olá, Marina');
  assert.equal(sent.batches[0]?.status, 'COMPLETED');
  assert.equal(tickSandbox(sent, 999999).contacts[0]!.messages.length, initialCount + 1);
  assert.equal(state.contacts[0]!.messages.length, initialCount);
});

test('sandbox só conclui lembrete após o horário agendado', () => {
  const state = exampleSandbox(0);
  assert.equal(tickSandbox(state, 3599999).agenda[0]?.done, false);
  assert.equal(tickSandbox(state, 3600000).agenda[0]?.done, true);
  assert.equal(state.agenda[0]?.done, false);
});

test('mídias de demonstração são arquivos locais com formatos reconhecíveis', async () => {
  const root = new URL('../../web/public/sandbox-media/', import.meta.url);
  const audio = await readFile(new URL('audio.wav', root));
  assert.equal(audio.subarray(0, 4).toString(), 'RIFF');
  assert.equal(audio.subarray(8, 12).toString(), 'WAVE');
  const video = await readFile(new URL('video.mp4', root));
  assert.equal(video.subarray(4, 8).toString(), 'ftyp');
  assert.match(await readFile(new URL('projeto.svg', root), 'utf8'), /<svg\b/);
});
