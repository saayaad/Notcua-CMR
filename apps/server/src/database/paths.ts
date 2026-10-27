import type { PrismaClient } from '@prisma/client';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
interface DatabasePaths {
  keyFile: string;
  backupDir: string;
}
const paths = new WeakMap<PrismaClient, DatabasePaths>();
const root = fileURLToPath(new URL('../../', import.meta.url));
export function setDatabasePaths(db: PrismaClient, value: DatabasePaths) {
  paths.set(db, value);
}
export function databasePaths(db: PrismaClient): DatabasePaths {
  return (
    paths.get(db) ?? {
      keyFile: resolve(root, env.WHATSAPP_KEY_FILE),
      backupDir: resolve(root, env.BACKUP_DIR),
    }
  );
}
