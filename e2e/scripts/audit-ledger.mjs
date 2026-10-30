import { execFileSync } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { root } from './audit-paths.mjs';

const requirementsFile = join(root, 'REVISAO', 'REQUISITOS.md');
const ledgerFile = join(root, 'REVISAO', 'LEDGER.csv');
const source = await readFile(requirementsFile, 'utf8');

async function filesBelow(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesBelow(path));
    else if (['.ts', '.tsx', '.js', '.mjs'].includes(extname(entry.name))) result.push(path);
  }
  return result;
}

const testFiles = [
  ...await filesBelow(join(root, 'apps', 'server', 'test')),
  ...await filesBelow(join(root, 'e2e')),
].filter((path) => /(?:\.test\.|\.spec\.)/.test(path));
const links = new Map();
for (const file of testFiles) {
  const text = await readFile(file, 'utf8');
  for (const match of text.matchAll(/REQ-(\d{1,3})/g)) {
    const id = `REQ-${match[1].padStart(3, '0')}`;
    const list = links.get(id) ?? [];
    list.push(relative(root, file).replace(/\\/g, '/'));
    links.set(id, [...new Set(list)]);
  }
}

const external = /WhatsApp real|iPhone|Android|aparelho|dispositivo físico|segundo monitor|2º monitor|janela externa real|e-mail real|chave real|conta real|Vercel|Firebase|túnel|produção/i;
const visual = /exibir|mostrar|abrir|interface|tela|botão|modal|layout|painel|menu|tooltip|arrastar|redimensionar|prévia|visualizar|tema|cor|ícone|responsiv/i;
const typeOverrides = {
  'REQ-098': 'C', 'REQ-099': 'C', 'REQ-100': 'C', 'REQ-101': 'A', 'REQ-102': 'B',
  'REQ-103': 'B', 'REQ-104': 'B', 'REQ-105': 'B', 'REQ-106': 'B', 'REQ-107': 'B',
  'REQ-108': 'B', 'REQ-109': 'B', 'REQ-110': 'B', 'REQ-111': 'C', 'REQ-112': 'C',
  'REQ-113': 'C', 'REQ-114': 'B', 'REQ-115': 'B', 'REQ-116': 'B', 'REQ-117': 'A',
  'REQ-118': 'C', 'REQ-119': 'A', 'REQ-120': 'A', 'REQ-121': 'A', 'REQ-122': 'A',
  'REQ-123': 'A', 'REQ-124': 'A', 'REQ-125': 'C', 'REQ-126': 'D', 'REQ-127': 'B',
};
const rows = [];
for (const line of source.split(/\r?\n/)) {
  if (!/^\| REQ-\d+ \|/.test(line)) continue;
  const cell = line.split('|').slice(1, -1).map((value) => value.trim());
  const [id, , pedido, , modulo, criterioOriginal, , estado, evidencia, observacao] = cell;
  const tests = links.get(id) ?? [];
  let tipo = estado.includes('DECISÃO') ? 'D' : /DESCONECTADO|AUSENTE/.test(estado) ? 'E'
    : external.test(`${criterioOriginal} ${observacao}`) ? 'C' : visual.test(pedido) ? 'B' : 'A';
  tipo = typeOverrides[id] ?? tipo;
  if (id === 'REQ-410') tipo = 'D';
  const criterio = criterioOriginal || `Comprovar que ${pedido.replace(/\.$/, '').toLowerCase()}.`;
  const resultado = estado.includes('COMPLETO') ? 'APROVADO' : estado.includes('CANCELADO') ? 'FORA_DO_ESCOPO'
    : estado.includes('DECISÃO') ? 'DECISÃO' : estado.includes('DESCONECTADO') ? 'DESCONECTADA'
      : estado.includes('AUSENTE') ? 'AUSENTE' : 'PENDENTE';
  rows.push({ id, modulo, tela: modulo, criterio_aceite: criterio, estado, tipo_de_prova: tipo,
    teste: tests.join(';'), evidencia, resultado, bloqueio: observacao, data: '2026-10-30' });
}

const headers = ['id', 'modulo', 'tela', 'criterio_aceite', 'estado', 'tipo_de_prova', 'teste', 'evidencia', 'resultado', 'bloqueio', 'data', 'commit'];
const csv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
for (const row of rows) {
  row.commit = '';
  if (row.teste) {
    const first = row.teste.split(';')[0];
    try { row.commit = execFileSync('git', ['log', '-1', '--format=%h', '--', first], { cwd: root, encoding: 'utf8' }).trim(); } catch {}
  }
}
await writeFile(ledgerFile, [headers.map(csv).join(','), ...rows.map((row) => headers.map((key) => csv(row[key])).join(','))].join('\r\n') + '\r\n', 'utf8');
const linked = rows.filter((row) => row.teste).length;
console.log(`REQs com teste vinculado: ${linked}`);
console.log(`REQs sem teste vinculado: ${rows.length - linked}`);
