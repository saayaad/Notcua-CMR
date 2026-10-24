import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prisma } from '../database/client.js';
import { BackupService } from '../modules/backups/backup.service.js';

try {
  const filename = process.argv[2];
  if (!filename) throw new Error('Uso: npm run backup:export -- "C:\\caminho\\backup.json"');
  const fullPath = resolve(filename);
  await writeFile(fullPath, JSON.stringify(await new BackupService(prisma).export(), null, 2), {
    encoding: 'utf8',
    flag: 'wx',
  });
  console.log(`Backup exportado: ${fullPath}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha ao exportar backup.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
