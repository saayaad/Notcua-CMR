import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const launcherPath = join(root, 'Iniciar Noctua.cmd');
const scriptPath = join(root, 'scripts', 'iniciar-noctua-online.ps1');

test('REQ-533 iniciador resolve scripts pela própria pasta sem depender do diretório atual', async () => {
  const [launcher, script] = await Promise.all([
    readFile(launcherPath, 'utf8'),
    readFile(scriptPath, 'utf8'),
  ]);

  assert.match(launcher, /cd \/d "%~dp0"/u);
  assert.match(launcher, /-File "%~dp0scripts\\iniciar-noctua-online\.ps1"/u);
  assert.match(script, /\$ProjectRoot = Split-Path -Parent \$PSScriptRoot/u);
  assert.match(script, /Set-Location -LiteralPath \$ProjectRoot/u);
});

test('REQ-534 mensagens do iniciador usam UTF-8 válido e preservam acentuação', async () => {
  const bytes = await readFile(scriptPath);
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const script = new TextDecoder('utf-8', { fatal: true }).decode(bytes);

  for (const message of [
    'Falta a configuração local do servidor.',
    'Não consegui iniciar o servidor.',
    'Preparando a conexão segura',
    'Abrindo o túnel e atualizando o site',
    'Conexão pronta.',
    'Já abri o site no navegador.',
    'primeira utilização',
    'registros técnicos',
  ]) assert.ok(script.includes(message), `mensagem acentuada ausente: ${message}`);

  assert.doesNotMatch(script, /\uFFFD|Ã(?:¡|¢|£|¤|¥|§|©|ª|«|¬|®|³|µ|¶|º|»|¼|½|¾|¿)|Â[\u0080-\u00bf]/u);
});

test('REQ-541 iniciador abre a rota exata do atendimento', async () => {
  const [script, guide] = await Promise.all([
    readFile(scriptPath, 'utf8'),
    readFile(join(root, 'LEIA-ME - Noctua Online.txt'), 'utf8'),
  ]);
  const url = 'https://notcua.vercel.app/atendimento';

  assert.match(script, /\$VercelSite = 'https:\/\/notcua\.vercel\.app\/atendimento'/u);
  assert.match(script, /Start-Process \$VercelSite/u);
  assert.ok(guide.includes(url));
});

test('REQ-542 repositório local está ligado ao remoto e pronto para publicação autorizada', async () => {
  const safeRoot = root.replaceAll('\\', '/').replace(/\/$/u, '');
  const git = (...args: string[]) => execFileSync('git', ['-c', `safe.directory=${safeRoot}`, ...args], { cwd: root, encoding: 'utf8' }).trim();
  const remote = git('remote', 'get-url', 'origin');
  const head = git('rev-parse', '--verify', 'HEAD');
  const vercel = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8')) as { buildCommand?: string; outputDirectory?: string };

  assert.match(remote, /github\.com[/:]saayaad\/Notcua-CMR\.git$/u);
  assert.match(head, /^[0-9a-f]{40}$/u);
  assert.equal(vercel.buildCommand, 'npm run build -w @noctua/web');
  assert.equal(vercel.outputDirectory, 'apps/web/dist');
});
