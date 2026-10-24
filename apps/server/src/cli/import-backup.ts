import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prisma } from '../database/client.js';
import { env } from '../config/env.js';
import { BackupService } from '../modules/backups/backup.service.js';

try {
  const filename = process.argv[2];
  if (!filename) throw new Error('Uso: npm run backup:import -- "C:\\caminho\\backup.json"');
  const fullPath = resolve(filename);
  const input: unknown = JSON.parse((await readFile(fullPath, 'utf8')).replace(/^\uFEFF/, ''));
  console.log(JSON.stringify(await new BackupService(prisma).import(input, filename), null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha ao importar backup.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
