import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanPhone,
  formatContactPhone,
  cleanContactName,
  contactMatches,
  newContactPhone,
  validScheduledContacts,
} from '../../web/src/context/contact-search.js';
import { chooseCampaignText, expandSpintax } from '../src/modules/operations/campaign-text.js';
import { isInsideSendWindow, nextSendWindowAt } from '../src/modules/operations/send-window.js';

test('janela de envio respeita dias, horário e fuso de Brasília', () => {
  const window = { timezone: 'America/Sao_Paulo', days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' };
  assert.equal(isInsideSendWindow(window, new Date('2026-10-30T15:30:00.000Z')), true);
  assert.equal(isInsideSendWindow(window, new Date('2026-10-30T21:00:00.000Z')), false);
  assert.equal(nextSendWindowAt(window, new Date('2026-10-30T21:30:00.000Z')).toISOString(),
    '2026-11-02T12:00:00.000Z');
  assert.equal(nextSendWindowAt(window, new Date('2026-10-30T11:59:01.000Z')).toISOString(),
    '2026-10-30T12:00:00.000Z');
});
test('contatos técnicos e zero são removidos e o telefone brasileiro recebe uma única formatação', () => {
  assert.equal(cleanPhone('0'), '');
  assert.equal(cleanPhone('lid:113288486621283@lid'), '');
  assert.equal(cleanPhone('5511999991234@c.us'), '5511999991234');
  assert.equal(formatContactPhone('5511999991234'), '+55 (11) 99999-1234');
  assert.equal(cleanContactName('· +lid:123@lid', '5511999991234'), '+55 (11) 99999-1234');
  assert.equal(
    validScheduledContacts([{ contact: { phoneNumber: '0', isGroup: false } }] as never).length,
    0,
  );
});
test('busca ignora acentos e formatação e aceita DDI, DDD ou parte do celular', () => {
  const item = { name: 'Márcio Alves', phoneNumber: '5562998765432' };
  for (const query of ['marcio', '+55 (62) 99876', '62 99876', '99876'])
    assert.equal(contactMatches(item, query), true, query);
  assert.equal(contactMatches(item, 'Fernanda'), false);
  assert.equal(newContactPhone('(62) 99876-5432'), '5562998765432');
  assert.equal(newContactPhone('99876'), '');
});
test('campanha alterna variações e fixa escolhas de spintax sem alterar variáveis de personalização', () => {
  assert.equal(chooseCampaignText('base', ['A {{nome}}', 'B {{nome}}'], 0, 'a'), 'base');
  assert.equal(chooseCampaignText('base', ['A {{nome}}', 'B {{nome}}'], 1, 'b'), 'A {{nome}}');
  assert.equal(chooseCampaignText('base', ['A {{nome}}', 'B {{nome}}'], 2, 'c'), 'B {{nome}}');
  assert.equal(chooseCampaignText('base', ['A {{nome}}', 'B {{nome}}'], 3, 'd'), 'base');
  const source = '{Olá|Oi}, {{nome}}! {{saudacao}}';
  const result = expandSpintax(source, 'lead-a');
  assert.equal(result, expandSpintax(source, 'lead-a'));
  assert.match(result, /^(Olá|Oi), \{\{nome\}\}! \{\{saudacao\}\}$/);
});
