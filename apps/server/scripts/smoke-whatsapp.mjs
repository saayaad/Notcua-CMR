import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'noctua-qr-'));
const listener = createServer();
await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const base = `http://127.0.0.1:${port}`;
const environment = {
  ...process.env, RUST_LOG: 'info', NODE_ENV: 'test', HOST: '127.0.0.1', PORT: String(port), API_TOKEN: '',
  DATABASE_URL: `file:${join(temporary, 'smoke.db').replace(/\\/g, '/')}`,
  WHATSAPP_KEY_FILE: join(temporary, 'whatsapp.key'), WHATSAPP_LOG_LEVEL: 'warn',
};
let child;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL('../../../node_modules/prisma/build/index.js', import.meta.url)), 'migrate', 'deploy', '--schema', join(root, 'prisma/schema.prisma')], { cwd: root, env: environment, stdio: 'pipe' });
  child = spawn(process.execPath, [join(root, 'dist/server.js')], { cwd: root, env: environment, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let logBuffer = '';
  child.stdout.on('data', (chunk) => {
    logBuffer += chunk.toString();
    const lines = logBuffer.split('\n'); logBuffer = lines.pop() || '';
    for (const line of lines) {
      try {
        const log = JSON.parse(line);
        if (log.level >= 40) console.log(JSON.stringify({ message: log.msg, reason: log.err?.message, code: log.err?.code }));
      } catch { /* Only structured warning metadata is displayed. */ }
    }
  });
  child.stderr.on('data', (data) => process.stderr.write(data));
  const api = async (path, method = 'GET', body) => {
    const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(5000) });
    const result = await response.json();
    assert.ok(response.ok, result.error?.message || `HTTP ${response.status}`);
    return result;
  };
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { await api('/health'); ready = true; break; } catch { await delay(300); }
  }
  assert.ok(ready, 'Servidor temporário não iniciou.');
  if (process.argv.includes('--preview')) console.log(`PREVIEW_URL=${base}/whatsapp`);
  const session = await api('/api/whatsapp/sessions', 'POST', { name: 'Validação isolada' });
  await api(`/api/whatsapp/sessions/${session.id}/connect`, 'POST');
  let qrReceived = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    const state = await api(`/api/whatsapp/sessions/${session.id}`);
    if (attempt % 10 === 0) console.log(`Estado: ${state.status}; tentativas: ${state.retryCount}; aviso: ${state.error ?? 'nenhum'}`);
    if (state.qrDataUrl) {
      assert.match(state.qrDataUrl, /^data:image\/png;base64,/);
      assert.equal(state.status, 'AWAITING_QR');
      qrReceived = true;
      console.log('QR real recebido do WhatsApp e convertido em PNG. Nenhuma conta foi vinculada.');
      break;
    }
    await delay(1000);
  }
  assert.ok(qrReceived, 'O WhatsApp não entregou QR dentro de 40 segundos. Confira a rede e a versão da biblioteca.');
  if (process.argv.includes('--preview')) {
    console.log('Prévia isolada disponível por até um minuto.');
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 60_000);
      if (process.stdin.isTTY) process.stdin.once('data', () => { clearTimeout(timer); resolve(); });
    });
  }
  await api(`/api/whatsapp/sessions/${session.id}/disconnect`, 'POST');
} finally {
  if (child && child.exitCode === null) {
    child.kill();
    await new Promise((resolve) => child.once('exit', resolve));
  }
  await rm(temporary, { recursive: true, force: true });
}
