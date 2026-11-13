import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeDockingPreferences } from '../src/context/docking-preferences.js';

test('REQ-ATENDIMENTO persiste larguras, alturas, painéis recolhidos e opções da lista', () => {
  const normalized = normalizeDockingPreferences({
    dockingPanelWidths: { list: 340, chat: 680, tools: 320 },
    dockingPanelSizes: {
      list: { width: 340, height: 720 },
      chat: { width: 680, height: 720 },
      tools: { width: 320, height: 360 },
    },
    dockingHiddenPanels: ['tools'],
    conversationOptionsExpanded: true,
  });
  assert.deepEqual(normalized.dockingPanelSizes, {
    list: { width: 340, height: 720 },
    chat: { width: 680, height: 720 },
    tools: { width: 320, height: 360 },
  });
  assert.deepEqual(normalized.dockingHiddenPanels, ['tools']);
  assert.equal(normalized.conversationOptionsExpanded, true);
});

test('REQ-ATENDIMENTO descarta dimensões inválidas sem perder as válidas', () => {
  const normalized = normalizeDockingPreferences({
    dockingPanelSizes: {
      list: { width: 120, height: 720 },
      chat: { width: 680, height: 720 },
      tools: { width: 320, height: Number.NaN },
    },
  });
  assert.deepEqual(normalized.dockingPanelSizes, { chat: { width: 680, height: 720 } });
});
