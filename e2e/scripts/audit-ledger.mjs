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
  'REQ-017': 'C', 'REQ-018': 'C', 'REQ-019': 'C', 'REQ-020': 'C', 'REQ-021': 'B',
  'REQ-024': 'B', 'REQ-027': 'B', 'REQ-028': 'B',
  'REQ-030': 'C', 'REQ-031': 'C', 'REQ-032': 'C', 'REQ-033': 'C', 'REQ-034': 'C', 'REQ-035': 'C',
  'REQ-037': 'C', 'REQ-038': 'C',
  'REQ-040': 'B', 'REQ-041': 'B', 'REQ-042': 'B', 'REQ-044': 'B', 'REQ-045': 'C', 'REQ-046': 'B',
  'REQ-047': 'B', 'REQ-048': 'B', 'REQ-049': 'B', 'REQ-050': 'B', 'REQ-051': 'B', 'REQ-052': 'C', 'REQ-053': 'B',
  'REQ-076': 'B',
  'REQ-077': 'B',
  'REQ-078': 'B',
  'REQ-079': 'B',
  'REQ-080': 'B',
  'REQ-081': 'B',
  'REQ-082': 'B',
  'REQ-083': 'B',
  'REQ-084': 'B',
  'REQ-085': 'B',
  'REQ-086': 'B',
  'REQ-087': 'B',
  'REQ-088': 'B',
  'REQ-089': 'C', 'REQ-090': 'C', 'REQ-093': 'C', 'REQ-094': 'C', 'REQ-095': 'C', 'REQ-096': 'B', 'REQ-097': 'B',
  'REQ-098': 'C', 'REQ-099': 'C', 'REQ-100': 'C', 'REQ-101': 'A', 'REQ-102': 'B',
  'REQ-103': 'B', 'REQ-104': 'B', 'REQ-105': 'B', 'REQ-106': 'B', 'REQ-107': 'B',
  'REQ-108': 'B', 'REQ-109': 'B', 'REQ-110': 'B', 'REQ-111': 'C', 'REQ-112': 'C',
  'REQ-113': 'C', 'REQ-114': 'B', 'REQ-115': 'B', 'REQ-116': 'B', 'REQ-117': 'A',
  'REQ-118': 'C', 'REQ-119': 'A', 'REQ-120': 'A', 'REQ-121': 'A', 'REQ-122': 'A',
  'REQ-123': 'A', 'REQ-124': 'A', 'REQ-125': 'C', 'REQ-126': 'D', 'REQ-127': 'B',
  'REQ-128': 'A', 'REQ-129': 'A', 'REQ-130': 'C', 'REQ-131': 'A', 'REQ-132': 'B',
  'REQ-133': 'A', 'REQ-134': 'A', 'REQ-135': 'A', 'REQ-136': 'B', 'REQ-137': 'B',
  'REQ-138': 'B', 'REQ-139': 'C', 'REQ-140': 'C', 'REQ-141': 'C', 'REQ-142': 'A',
  'REQ-143': 'A', 'REQ-144': 'A', 'REQ-145': 'A', 'REQ-146': 'A', 'REQ-147': 'B',
  'REQ-148': 'A', 'REQ-149': 'A', 'REQ-150': 'C', 'REQ-151': 'A', 'REQ-152': 'C',
  'REQ-153': 'B', 'REQ-154': 'B', 'REQ-155': 'A', 'REQ-156': 'B', 'REQ-157': 'B',
  'REQ-158': 'B',
  'REQ-159': 'B', 'REQ-161': 'B', 'REQ-164': 'C', 'REQ-165': 'B', 'REQ-166': 'B',
  'REQ-167': 'B', 'REQ-168': 'B', 'REQ-169': 'B', 'REQ-171': 'B', 'REQ-172': 'B',
  'REQ-173': 'B', 'REQ-174': 'B', 'REQ-175': 'B', 'REQ-176': 'B', 'REQ-177': 'B',
  'REQ-178': 'B', 'REQ-179': 'B', 'REQ-180': 'B', 'REQ-181': 'B', 'REQ-182': 'B',
  'REQ-184': 'B', 'REQ-185': 'B', 'REQ-187': 'B', 'REQ-188': 'B', 'REQ-189': 'B',
  'REQ-190': 'B', 'REQ-191': 'B', 'REQ-193': 'A', 'REQ-194': 'D', 'REQ-195': 'D',
  'REQ-196': 'D', 'REQ-197': 'D', 'REQ-198': 'C',
  'REQ-199': 'B', 'REQ-200': 'B', 'REQ-201': 'B', 'REQ-202': 'C', 'REQ-203': 'C',
  'REQ-204': 'C', 'REQ-206': 'B', 'REQ-208': 'B', 'REQ-209': 'B', 'REQ-214': 'B',
  'REQ-215': 'B', 'REQ-216': 'B', 'REQ-217': 'C', 'REQ-218': 'B', 'REQ-219': 'B',
  'REQ-220': 'B', 'REQ-221': 'B', 'REQ-222': 'B', 'REQ-223': 'D', 'REQ-224': 'B',
  'REQ-225': 'B', 'REQ-226': 'B', 'REQ-227': 'B', 'REQ-228': 'B', 'REQ-229': 'B',
  'REQ-230': 'B', 'REQ-231': 'B', 'REQ-232': 'B', 'REQ-233': 'B',
  'REQ-236': 'B', 'REQ-237': 'B', 'REQ-238': 'B', 'REQ-239': 'B', 'REQ-240': 'B',
  'REQ-241': 'B', 'REQ-242': 'B', 'REQ-243': 'B', 'REQ-244': 'B', 'REQ-245': 'B',
  'REQ-247': 'B', 'REQ-248': 'B', 'REQ-249': 'B',
  'REQ-250': 'C', 'REQ-251': 'C', 'REQ-252': 'C', 'REQ-253': 'C',
  'REQ-254': 'B', 'REQ-255': 'B', 'REQ-256': 'B', 'REQ-258': 'B', 'REQ-259': 'B',
  'REQ-261': 'C', 'REQ-262': 'C', 'REQ-263': 'C', 'REQ-264': 'C', 'REQ-265': 'C',
  'REQ-267': 'C', 'REQ-268': 'B',
  'REQ-269': 'B', 'REQ-270': 'B', 'REQ-271': 'B',
  'REQ-275': 'B', 'REQ-276': 'B', 'REQ-277': 'B', 'REQ-278': 'B',
  'REQ-279': 'C', 'REQ-280': 'B', 'REQ-281': 'B', 'REQ-282': 'B',
  'REQ-283': 'B', 'REQ-284': 'B', 'REQ-285': 'B', 'REQ-286': 'B',
  'REQ-287': 'B', 'REQ-288': 'B', 'REQ-289': 'B', 'REQ-290': 'B',
  'REQ-291': 'B', 'REQ-292': 'B', 'REQ-293': 'B', 'REQ-294': 'B',
  'REQ-295': 'B', 'REQ-296': 'B', 'REQ-297': 'B',
  'REQ-298': 'B', 'REQ-299': 'B', 'REQ-300': 'C', 'REQ-301': 'C', 'REQ-302': 'C',
  'REQ-303': 'C', 'REQ-304': 'C', 'REQ-305': 'C', 'REQ-306': 'C', 'REQ-307': 'B',
  'REQ-308': 'B', 'REQ-309': 'B', 'REQ-310': 'B', 'REQ-312': 'B', 'REQ-313': 'B',
  'REQ-315': 'B', 'REQ-316': 'B', 'REQ-317': 'B', 'REQ-318': 'B', 'REQ-320': 'B',
  'REQ-321': 'B', 'REQ-322': 'B', 'REQ-323': 'B', 'REQ-324': 'B', 'REQ-326': 'B',
  'REQ-327': 'C',
  'REQ-328': 'B', 'REQ-329': 'B', 'REQ-330': 'C', 'REQ-331': 'C', 'REQ-332': 'C',
  'REQ-333': 'B', 'REQ-334': 'C', 'REQ-335': 'B', 'REQ-336': 'B',
  'REQ-337': 'B', 'REQ-338': 'B', 'REQ-339': 'B', 'REQ-343': 'B',
  'REQ-345': 'B', 'REQ-346': 'B', 'REQ-351': 'B', 'REQ-352': 'B',
  'REQ-340': 'B', 'REQ-341': 'B', 'REQ-342': 'B', 'REQ-344': 'B',
  'REQ-347': 'B', 'REQ-348': 'B', 'REQ-349': 'B', 'REQ-350': 'B',
  'REQ-353': 'B', 'REQ-354': 'B', 'REQ-355': 'B', 'REQ-356': 'B',
  'REQ-360': 'C', 'REQ-361': 'C', 'REQ-362': 'C', 'REQ-363': 'C', 'REQ-364': 'C',
  'REQ-365': 'B', 'REQ-366': 'B', 'REQ-367': 'B', 'REQ-368': 'B', 'REQ-369': 'B',
  'REQ-370': 'C', 'REQ-371': 'C', 'REQ-372': 'C', 'REQ-373': 'B', 'REQ-374': 'B',
  'REQ-375': 'C', 'REQ-376': 'B', 'REQ-377': 'B', 'REQ-378': 'B', 'REQ-379': 'B',
  'REQ-380': 'B', 'REQ-381': 'B', 'REQ-382': 'B', 'REQ-383': 'C', 'REQ-384': 'C',
  'REQ-385': 'C', 'REQ-386': 'C', 'REQ-387': 'B', 'REQ-388': 'B', 'REQ-389': 'C',
  'REQ-390': 'C', 'REQ-391': 'C',
  'REQ-392': 'C', 'REQ-393': 'C', 'REQ-394': 'C', 'REQ-395': 'C', 'REQ-396': 'C',
  'REQ-397': 'C', 'REQ-398': 'C', 'REQ-399': 'B', 'REQ-400': 'C', 'REQ-401': 'D',
  'REQ-402': 'A', 'REQ-403': 'A', 'REQ-406': 'C', 'REQ-407': 'C', 'REQ-408': 'E',
  'REQ-409': 'E', 'REQ-410': 'D', 'REQ-411': 'C', 'REQ-412': 'C', 'REQ-413': 'C',
  'REQ-414': 'B', 'REQ-415': 'B', 'REQ-416': 'B', 'REQ-417': 'B', 'REQ-418': 'B',
  'REQ-419': 'E', 'REQ-420': 'E', 'REQ-421': 'E', 'REQ-422': 'E', 'REQ-423': 'B',
  'REQ-424': 'C', 'REQ-425': 'A', 'REQ-426': 'A', 'REQ-427': 'B', 'REQ-428': 'B',
  'REQ-429': 'B', 'REQ-430': 'E', 'REQ-431': 'C', 'REQ-432': 'C', 'REQ-433': 'C',
  'REQ-434': 'C', 'REQ-435': 'C', 'REQ-436': 'C', 'REQ-437': 'C', 'REQ-438': 'C',
  'REQ-439': 'C', 'REQ-440': 'C', 'REQ-441': 'C', 'REQ-442': 'C', 'REQ-443': 'C',
  'REQ-523': 'D', 'REQ-527': 'D', 'REQ-530': 'C', 'REQ-533': 'C',
  'REQ-534': 'A', 'REQ-540': 'D', 'REQ-541': 'C', 'REQ-542': 'C',
  'REQ-574': 'B',
  'REQ-575': 'B',
  'REQ-576': 'B',
  'REQ-577': 'B',
  'REQ-578': 'B',
  'REQ-579': 'B',
  'REQ-580': 'B',
  'REQ-581': 'B',
  'REQ-582': 'B',
  'REQ-583': 'B',
  'REQ-584': 'B',
  'REQ-585': 'B',
  'REQ-586': 'B',
  'REQ-587': 'B',
  'REQ-588': 'B',
  'REQ-589': 'B',
  'REQ-590': 'B',
  'REQ-591': 'B',
  'REQ-592': 'B',
  'REQ-593': 'B',
  'REQ-594': 'B',
  'REQ-595': 'B',
  'REQ-596': 'B',
  'REQ-597': 'B',
  'REQ-598': 'B',
  'REQ-599': 'B',
  'REQ-600': 'B',
  'REQ-601': 'B',
  'REQ-602': 'B',
  'REQ-660': 'A', 'REQ-661': 'A', 'REQ-662': 'A', 'REQ-663': 'A',
  'REQ-664': 'A', 'REQ-665': 'A', 'REQ-666': 'A', 'REQ-667': 'A',
  'REQ-668': 'C', 'REQ-673': 'B', 'REQ-675': 'B', 'REQ-676': 'C',
  'REQ-678': 'C', 'REQ-680': 'D', 'REQ-682': 'B',
  'REQ-684': 'A', 'REQ-685': 'A', 'REQ-686': 'A', 'REQ-687': 'A',
  'REQ-695': 'C', 'REQ-696': 'C', 'REQ-697': 'C',
  'REQ-054': 'B',
  'REQ-055': 'B',
  'REQ-056': 'B',
  'REQ-057': 'B',
  'REQ-058': 'B',
  'REQ-059': 'B',
  'REQ-060': 'B',
  'REQ-061': 'B',
  'REQ-062': 'B',
  'REQ-063': 'B',
  'REQ-064': 'C',
  'REQ-065': 'C',
  'REQ-066': 'B',
  'REQ-067': 'B',
  'REQ-068': 'B',
  'REQ-069': 'B',
  'REQ-070': 'B',
  'REQ-071': 'B',
  'REQ-072': 'B',
  'REQ-073': 'B',
  'REQ-074': 'B',
  'REQ-075': 'B',
};
const dateOverrides = { 'REQ-017': '2026-10-31', 'REQ-018': '2026-10-31', 'REQ-019': '2026-10-31', 'REQ-020': '2026-10-31', 'REQ-021': '2026-10-31', 'REQ-024': '2026-10-31', 'REQ-027': '2026-10-31', 'REQ-028': '2026-10-31', 'REQ-030': '2026-10-31', 'REQ-031': '2026-10-31', 'REQ-032': '2026-10-31', 'REQ-033': '2026-10-31', 'REQ-034': '2026-10-31', 'REQ-035': '2026-10-31', 'REQ-036': '2026-10-31', 'REQ-037': '2026-10-31', 'REQ-038': '2026-10-31', 'REQ-040': '2026-10-31', 'REQ-041': '2026-10-31', 'REQ-042': '2026-10-31', 'REQ-044': '2026-10-31', 'REQ-045': '2026-10-31', 'REQ-046': '2026-10-31', 'REQ-047': '2026-10-31', 'REQ-048': '2026-10-31', 'REQ-049': '2026-10-31', 'REQ-050': '2026-10-31', 'REQ-051': '2026-10-31', 'REQ-052': '2026-10-31', 'REQ-053': '2026-10-31', 'REQ-054': '2026-10-31', 'REQ-055': '2026-10-31', 'REQ-056': '2026-10-31', 'REQ-057': '2026-10-31', 'REQ-058': '2026-10-31', 'REQ-059': '2026-10-31', 'REQ-060': '2026-10-31', 'REQ-061': '2026-10-31', 'REQ-062': '2026-10-31', 'REQ-063': '2026-10-31', 'REQ-064': '2026-10-31', 'REQ-065': '2026-10-31', 'REQ-066': '2026-10-31', 'REQ-067': '2026-10-31', 'REQ-068': '2026-10-31', 'REQ-069': '2026-10-31', 'REQ-070': '2026-10-31', 'REQ-071': '2026-10-31', 'REQ-072': '2026-10-31', 'REQ-073': '2026-10-31', 'REQ-074': '2026-10-31', 'REQ-075': '2026-10-31' };
for (let n = 76; n <= 97; n++) dateOverrides['REQ-' + String(n).padStart(3, '0')] = '2026-10-31';
dateOverrides['REQ-381'] = '2026-10-31';
dateOverrides['REQ-425'] = '2026-10-31';
dateOverrides['REQ-464'] = '2026-10-31';
dateOverrides['REQ-512'] = '2026-10-31';
for (const id of ['REQ-523', 'REQ-527', 'REQ-530', 'REQ-533', 'REQ-534', 'REQ-540', 'REQ-541', 'REQ-542']) dateOverrides[id] = '2026-10-31';
for (const id of ['REQ-448', 'REQ-453', 'REQ-455', 'REQ-457', 'REQ-458', 'REQ-461', 'REQ-462', 'REQ-463', 'REQ-465', 'REQ-466', 'REQ-472', 'REQ-475', 'REQ-482', 'REQ-483', 'REQ-487', 'REQ-499']) dateOverrides[id] = '2026-10-31';
for (const id of ['REQ-567', 'REQ-573']) dateOverrides[id] = '2026-10-31';
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
  const resultado = estado.includes('COMPLETO') ? 'APROVADO' : estado.includes('DEFEITO') ? 'DEFEITO' : estado.includes('CANCELADO') ? 'FORA_DO_ESCOPO'
    : estado.includes('DECISÃO') ? 'DECISÃO' : estado.includes('DESCONECTADO') ? 'DESCONECTADA'
      : estado.includes('AUSENTE') ? 'AUSENTE' : 'PENDENTE';
  rows.push({ id, modulo, tela: modulo, criterio_aceite: criterio, estado, tipo_de_prova: tipo,
    teste: tests.join(';'), evidencia, resultado, bloqueio: observacao, data: dateOverrides[id] ?? '2026-10-30' });
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
