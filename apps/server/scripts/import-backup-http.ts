import { openAsBlob } from 'node:fs';
import { basename, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { env } from '../src/config/env.js';
const path = process.argv[2];
if (!path) throw new Error('Informe o arquivo JSON para importar pelo servidor local.');
if (env.AUTH_MODE !== 'local') throw new Error('Use o painel autenticado para importar no modo Firebase.');
const origin = `http://127.0.0.1:${env.PORT}`;
const headers = env.API_TOKEN ? { Authorization: `Bearer ${env.API_TOKEN}` } : {};
async function api(path: string, method = 'GET', body?: Blob, extra: Record<string, string> = {}) {
  const response = await fetch(origin + path, {
    method,
    headers: { ...headers, ...extra },
    body,
    signal: AbortSignal.timeout(900000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `HTTP ${response.status}`);
  return data;
}
const sessions = (await api('/api/whatsapp/sessions')).items as { id: string; status: string }[];
const connected = sessions.filter((session) => session.status === 'CONNECTED');
const sessionId =
  process.argv[3] ||
  (connected.length === 1 ? connected[0]!.id : sessions.length === 1 ? sessions[0]!.id : '');
if (!sessionId || !sessions.some((session) => session.id === sessionId))
  throw new Error('Informe a conexão de destino como segundo argumento.');
await api('/api/operations/system-backups', 'POST');
console.log('Cópia integral de segurança criada antes da importação.');
const file = await openAsBlob(resolve(path), { type: 'application/json' });
const job = await api(`/api/backups/upload?sessionId=${encodeURIComponent(sessionId)}`, 'POST', file, {
  'Content-Type': 'application/json',
  'X-Backup-Name': encodeURIComponent(basename(path)),
});
console.log('Arquivo recebido pelo servidor. Processando em segundo plano.');
for (let attempt = 0; attempt < 1000; attempt++) {
  let state;
  try {
    state = await api(`/api/backups/jobs/${encodeURIComponent(job.id)}`);
  } catch {
    if (attempt === 999)
      throw new Error(
        'Consulte o relatório no painel: o servidor ficou temporariamente ocupado e a importação pode já ter sido concluída.',
      );
    await delay(1500);
    continue;
  }
  if (state.status === 'COMPLETED') {
    console.log(JSON.stringify(state.report, null, 2));
    break;
  }
  if (state.status === 'FAILED') throw new Error(state.error);
  if (attempt === 999)
    throw new Error('Consulte o relatório no painel; a importação ainda está em processamento.');
  await delay(1000);
}
