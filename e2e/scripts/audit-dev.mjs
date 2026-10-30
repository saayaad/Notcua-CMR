import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { backupDir, databaseFile, databaseUrl, platformDataDir, root, whatsappKeyFile } from './audit-paths.mjs';

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('O caminho do npm não foi informado ao audit:dev.');
if (!existsSync(databaseFile)) {
  const reset = spawnSync(process.execPath, ['e2e/scripts/audit-reset.mjs'], { cwd: root, stdio: 'inherit' });
  if (reset.status !== 0) process.exit(reset.status ?? 1);
}

const common = {
  ...process.env,
  NODE_ENV: 'development',
  AUTH_MODE: 'local',
  API_TOKEN: '',
  HOST: '127.0.0.1',
  PORT: '3340',
  CLIENT_ORIGIN: 'http://127.0.0.1:5180',
  DATABASE_URL: databaseUrl,
  PLATFORM_DATA_DIR: platformDataDir,
  BACKUP_DIR: backupDir,
  WHATSAPP_KEY_FILE: whatsappKeyFile,
  WHATSAPP_SYNC_PHOTOS: 'false',
  VITE_API_URL: 'http://127.0.0.1:3340',
};
const children = [
  spawn(process.execPath, [npmCli, 'run', 'dev', '-w', '@noctua/server'], { cwd: root, env: common, stdio: 'inherit' }),
  spawn(process.execPath, [npmCli, 'run', 'dev', '-w', '@noctua/web', '--', '--port', '5180'], { cwd: root, env: common, stdio: 'inherit' }),
];

let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
for (const child of children) child.once('exit', (code) => {
  if (!stopping && code) {
    stop();
    process.exitCode = code;
  }
});
await Promise.all(children.map((child) => new Promise((resolve) => child.once('exit', resolve))));
