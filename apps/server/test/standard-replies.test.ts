import test from 'node:test';
import assert from 'node:assert/strict';
import { questionSimilarity, groupRepeatedQuestions } from '../src/modules/operations/standard-replies.js';

test('agrupa variações de prazo em português sem confundir vídeo com aplicativo', () => {
  assert.ok(
    questionSimilarity('Qual o tempo para finalizar o aplicativo?', 'Qual prazo para entrega do app?') >=
      0.67,
  );
  assert.equal(questionSimilarity('Qual o prazo do vídeo?', 'Qual o prazo do aplicativo?'), 0);
});
test('exige clientes distintos e aproveita resposta histórica somente como sugestão', () => {
  const date = new Date().toISOString();
  const duplicates = [
    { text: 'Qual o tempo para finalizar o aplicativo?', conversationId: 'cliente-1', sentAt: date },
    { text: 'Qual prazo para entrega do app?', conversationId: 'cliente-1', sentAt: date },
  ];
  assert.equal(groupRepeatedQuestions(duplicates).length, 0);
  const groups = groupRepeatedQuestions([
    ...duplicates,
    {
      text: 'Qual o prazo para entregar o app?',
      conversationId: 'cliente-2',
      sentAt: date,
      suggestedText: 'Resposta de exemplo para revisão.',
    },
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]!.clients, 2);
  assert.equal(groups[0]!.occurrences, 3);
  assert.equal(groups[0]!.suggestedText, 'Resposta de exemplo para revisão.');
});
