import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'REVISAO/REQUISITOS.md');
const output = resolve(root, 'REVISAO/INVENTARIO-PENDENTES.md');
const lines = readFileSync(source, 'utf8').split(/\r?\n/);
const rows = lines.flatMap((line, index) => {
  if (!/^\| REQ-\d+ \|/.test(line)) return [];
  const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
  if (cells.length !== 10) throw new Error(`Linha ${index + 1}: ${cells.length} colunas.`);
  const [id, origin, request, type, module, criterion, declared, status, evidence, limit] = cells;
  return [{ id, origin, request, type, module, criterion, declared, status, evidence, limit, line: index + 1 }];
});

if (rows.length !== 703 || new Set(rows.map((row) => row.id)).size !== 703)
  throw new Error('O livro precisa conter 703 IDs únicos antes de gerar o inventário.');

const pending = rows.filter((row) => !/COMPLETO|SUBSTITUÍDO OU CANCELADO/.test(row.status));
const aiTerms = /(?:\bIA\b|I\.A\.|inteligência artificial|Gemini|OpenAI|Anthropic|GPT|modelo de linguagem|embeddings)/i;
const visualModules = new Set(['Interface global', 'Personalização', 'Atendimento e personalização']);
const priorityModules = new Set(['Infraestrutura', 'Backups', 'Conexões', 'Chaves e operações', 'Acesso e operação']);

function isAiRelated(row) {
  return ['IA', 'IA e mídia', 'Economia de IA'].includes(row.module) || aiTerms.test(row.request);
}

function priority(row) {
  if (isAiRelated(row)) return 'Adiada IA';
  if (row.module === 'Mensagens' || row.id === 'REQ-661') return 'Leitura REQ-661';
  if (/PRECISA DE DECISÃO|NÃO TESTADO|DESCONECTADO|AUSENTE/.test(row.status)) return 'P1 diagnóstico';
  if (priorityModules.has(row.module)) return 'P1 diagnóstico';
  if (visualModules.has(row.module)) return 'P3 visual';
  return 'P2 funcional';
}

function dependencies(row) {
  const parts = [];
  const refs = [...new Set((`${row.request} ${row.evidence} ${row.limit}`).match(/REQ-\d{3}/g) ?? [])]
    .filter((id) => id !== row.id);
  if (refs.length) parts.push(`IDs citados: ${refs.join(', ')}`);
  if (isAiRelated(row)) parts.push('IA adiada pelo usuário; chave/API não disponível');
  if (row.module === 'Mensagens' || row.id === 'REQ-661')
    parts.push('REQ-661: somente leitura de código e ligações');
  if (/PRECISA DE DECISÃO/.test(row.status)) parts.push('Decisão do usuário antes de implementar');
  if (/interface|navegador|visual|tela|celular|aparelho|dispositivo/i.test(row.limit))
    parts.push('Evidência visual autorizada ou fornecida pelo usuário');
  if (/WhatsApp real|conexão real|telefone real|aparelho de teste|envio em conta de teste/i.test(row.limit))
    parts.push('Conexão ou aparelho de teste; nenhum envio real sem autorização');
  if (/cliente real|outra conta|conta de teste|e-mail de teste|Firebase|confirma(?:r)? e-mail/i.test(row.limit))
    parts.push('Conta de teste e confirmação manual');
  if (/backup real|importação real|cópia descartável|base descartável/i.test(row.limit))
    parts.push('Cópia do backup e ambiente descartável');
  return parts.length ? parts.join('; ') : 'Não explicitada no livro; levantar no diagnóstico';
}

function evidenceParts(row) {
  if (/^Fase 2 ainda não iniciada; sem prova de execução por requisito\.$/.test(row.evidence))
    return ['Sem prova individual vinculada neste livro; consultar histórico antes de testar.', ''];
  const split = /\.\s+(?=(?:Falta|Faltam|Resta|Restam|Ainda falta|Ainda faltam)\b)/i.exec(row.evidence);
  if (!split) return [row.evidence, ''];
  return [row.evidence.slice(0, split.index + 1), row.evidence.slice(split.index + split[0].length)];
}

function missing(row) {
  const gapInEvidence = evidenceParts(row)[1];
  if (row.limit === 'Sem conclusão funcional nesta fase.')
    return [gapInEvidence, 'Diagnosticar histórico e critério de aceite; registrar o limite específico.'].filter(Boolean).join(' ');
  return [gapInEvidence, row.limit].filter(Boolean).join(' ');
}

function safe(value) {
  return value.replaceAll('|', '\\|').replaceAll(/\s+/g, ' ').trim();
}

const byModule = Map.groupBy(pending, (row) => row.module);
const statusCounts = Map.groupBy(pending, (row) => row.status);
const sections = [...byModule].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
const out = [
  '# Inventário dos requisitos pendentes do Noctua CRM',
  '',
  'Fonte: REVISAO/REQUISITOS.md, livro com 703 IDs. Este inventário preserva a evidência e o limite de cada linha. O estado “a verificar” significa falta de prova individual vinculada no livro; não significa que o requisito nunca tenha sido testado. A prioridade abaixo é proposta para triagem, não aprovação de implementação.',
  '',
  `Pendentes ativos: **${pending.length}**. Concluídos excluídos: **${rows.filter((row) => /COMPLETO/.test(row.status)).length}**. Substituídos ou cancelados excluídos: **${rows.filter((row) => /SUBSTITUÍDO OU CANCELADO/.test(row.status)).length}**.`,
  '',
  '## Estados pendentes',
  '',
  '| Estado | IDs |',
  '|---|---:|',
  ...[...statusCounts].sort(([a], [b]) => a.localeCompare(b, 'pt-BR')).map(([state, items]) => `| ${state} | ${items.length} |`),
  '',
  '## Módulos e ordem de triagem',
  '',
  '| Módulo | IDs pendentes | P1 diagnóstico | P2 funcional | P3 visual | Leitura REQ-661 | Adiada IA |',
  '|---|---:|---:|---:|---:|---:|---:|',
  ...sections.map(([module, items]) => {
    const count = (label) => items.filter((item) => priority(item) === label).length;
    return `| ${safe(module)} | ${items.length} | ${count('P1 diagnóstico')} | ${count('P2 funcional')} | ${count('P3 visual')} | ${count('Leitura REQ-661')} | ${count('Adiada IA')} |`;
  }),
  '',
  '## Critério de uso',
  '',
  '- “Já comprovado” reproduz a parte de prova registrada no livro; não declara aprovação nova. Frases de lacuna identificadas no campo de evidência foram movidas para “Falta verificar”.',
  '- “Falta verificar” reproduz o limite do livro. Quando o limite era genérico, pede diagnóstico do histórico.',
  '- “Dependências” traz IDs citados e condições identificadas no limite. “A levantar” indica que o livro não especifica uma dependência.',
  '- Mensagens segue REQ-661: somente leitura de código e ligações. IA continua adiada. Efeitos externos e decisões estruturais exigem aprovação do usuário.',
  '',
];

for (const [module, items] of sections) {
  out.push(`## ${module}`, '', '| ID e linha do livro | Estado | Prioridade proposta | Pedido | Já comprovado | Falta verificar ou limite do livro | Dependências |', '|---|---|---|---|---|---|---|');
  for (const row of items.sort((a, b) => Number(a.id.slice(4)) - Number(b.id.slice(4)))) {
    out.push(`| ${row.id} (L${row.line}) | ${safe(row.status)} | ${priority(row)} | ${safe(row.request)} | ${safe(evidenceParts(row)[0])} | ${safe(missing(row))} | ${safe(dependencies(row))} |`);
  }
  out.push('');
}

writeFileSync(output, `${out.join('\n').trimEnd()}\n`, 'utf8');
console.log(`Inventário: ${pending.length} IDs pendentes, ${sections.length} módulos, ${output}`);
