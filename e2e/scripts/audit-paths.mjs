import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const auditDir = join(root, '.audit');
export const databaseFile = join(auditDir, 'noctua-audit.db');
export const databaseUrl = `file:${databaseFile.replace(/\\/g, '/')}`;
export const platformDataDir = join(auditDir, 'platform-data');
export const backupDir = join(auditDir, 'backups');
export const whatsappKeyFile = join(auditDir, 'whatsapp.key');

export function assertAuditPath(path) {
  const resolved = resolve(path);
  if (resolved !== auditDir && !resolved.startsWith(`${auditDir}${sep}`))
    throw new Error(`O caminho de auditoria saiu de .audit: ${resolved}`);
  return resolved;
}

export function scriptUrl(name) {
  return pathToFileURL(join(root, 'e2e', 'scripts', name)).href;
}
