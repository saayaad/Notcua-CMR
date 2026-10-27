import test from 'node:test';
import assert from 'node:assert/strict';
import { clearOperationLocalState } from '../../web/src/context/reset-local-state.js';

test('reset remove preferências e rascunhos atuais sem apagar outra conta ou autenticação', () => {
  const map = new Map([
    ['noctua-preferences:ana', 'cor antiga'],
    ['noctua-active-session:ana', 'sessao'],
    ['noctua:sandbox:v1:ana', 'exemplos'],
    ['noctua:draft:ana:sessao:conversa', 'rascunho'],
    ['noctua-theme', 'light'],
    ['noctua-tools-open', 'true'],
    ['noctua-tools-size', 'compact'],
    ['noctua-preferences:beto', 'preferência de outra conta'],
    ['noctua:draft:beto:sessao:conversa', 'outro rascunho'],
    ['noctua:sandbox:v1:beto', 'outros exemplos'],
    ['firebase:authUser:ficticio', 'autenticação preservada'],
  ]);
  clearOperationLocalState(
    {
      get length() {
        return map.size;
      },
      key: (index) => [...map.keys()][index] ?? null,
      removeItem: (key) => {
        map.delete(key);
      },
    },
    'ana',
  );
  assert.deepEqual(
    [...map.keys()],
    [
      'noctua-preferences:beto',
      'noctua:draft:beto:sessao:conversa',
      'noctua:sandbox:v1:beto',
      'firebase:authUser:ficticio',
    ],
  );
});
