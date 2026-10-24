import { mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { env } from '../../config/env.js';
import { putRecord, record } from './records.js';
import { CredentialCipher } from '../whatsapp/credential-cipher.js';
const root = fileURLToPath(new URL('../../../', import.meta.url));
export interface SystemBackup {
  id: string;
  filename: string;
  database: string;
  key: string;
  createdAt: string;
}
export async function createSystemBackup(db: PrismaClient, directory = resolve(root, env.BACKUP_DIR)) {
  await mkdir(directory, { recursive: true });
  await CredentialCipher.load(env.WHATSAPP_KEY_FILE);
  const id = `system-backup:${randomUUID()}`;
  const filename = `noctua-${new Date().toISOString().replace(/[:.]/g, '-')}-${id.slice(-8)}`;
  const database = resolve(directory, `${filename}.db`);
  const key = resolve(directory, `${filename}.key`);
  await db.$executeRawUnsafe('VACUUM INTO ?', database);
  await copyFile(resolve(root, env.WHATSAPP_KEY_FILE), key);
  const data: SystemBackup = { id, filename, database, key, createdAt: new Date().toISOString() };
  await putRecord(db, id, 'SYSTEM_BACKUP', data);
  return data;
}
export class BackupWorker {
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private work: Promise<void> = Promise.resolve();
  constructor(private db: PrismaClient) {}
  start() {
    this.schedule();
  }
  private schedule() {
    if (!this.stopped)
      this.timer = setTimeout(() => {
        this.work = this.flush()
          .catch(() => undefined)
          .finally(() => this.schedule());
      }, 60000).unref();
  }
  async stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.work;
  }
  async flush() {
    const settings = await record<{ automatic?: boolean; time?: string }>(this.db, 'settings:backups', {});
    if (!settings.automatic) return;
    const time = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date());
    if (settings.time && time < settings.time) return;
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const marker = `backup-day:${today}`;
    if (await this.db.operationRecord.findUnique({ where: { id: marker } })) return;
    await createSystemBackup(this.db);
    await putRecord(this.db, marker, 'BACKUP_DAY', { completedAt: new Date().toISOString() });
  }
}
