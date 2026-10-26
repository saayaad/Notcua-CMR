import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareAttachment, type AttachmentDraftInsert } from '../../web/src/context/attendance.js';

test('preparar imagem só conclui quando o atendimento confirma que recebeu o rascunho', () => {
  const previous = globalThis.window;
  const target = new EventTarget();
  (globalThis as any).window = target;
  try {
    const detail = { sessionId: 'teste', conversationId: 'cliente-teste', file: new File(['png'], 'criacao.png', { type: 'image/png' }) };
    assert.equal(prepareAttachment(detail), false, 'sem compositor disponível não deve fechar o estúdio');
    const received: AttachmentDraftInsert[] = [];
    target.addEventListener('noctua:prepare-attachment', event => {
      received.push((event as CustomEvent<AttachmentDraftInsert>).detail);
      event.preventDefault();
    });
    assert.equal(prepareAttachment(detail), true);
    assert.equal(received[0]!.file, detail.file);
    assert.equal(received[0]!.conversationId, 'cliente-teste');
    assert.equal(received[0]!.sessionId, 'teste');
  } finally {
    if (previous) globalThis.window = previous;
    else delete (globalThis as any).window;
  }
});
