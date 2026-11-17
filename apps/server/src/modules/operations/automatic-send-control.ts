import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors.js';
import { putRecord } from './records.js';

export const AUTOMATIC_SENDS_RECORD_ID = 'settings:automatic-sends';
export type AutomaticSendSettings = { enabled: boolean; updatedAt?: string; updatedBy?: string };
export type SendOrigin = {
  module: string;
  route?: string;
  userId?: string;
  taskId?: string;
  automatic: boolean;
};
const defaults: AutomaticSendSettings = { enabled: false };

export async function automaticSendSettings(db: PrismaClient) {
  const row = await db.operationRecord.findUnique({ where: { id: AUTOMATIC_SENDS_RECORD_ID } });
  const stored = row ? row.data as AutomaticSendSettings : defaults;
  const forcedOff = process.env.AUTOMATIC_SENDS_ENABLED?.trim().toLowerCase() === 'false';
  const testDefault = !row && process.env.NODE_ENV === 'test' && process.env.AUTOMATIC_SENDS_TEST_DEFAULT === 'true';
  return { ...stored, enabled: !forcedOff && (stored.enabled === true || testDefault), forcedOff };
}

export async function setAutomaticSendSettings(db: PrismaClient, enabled: boolean, userId: string) {
  const value: AutomaticSendSettings = { enabled, updatedAt: new Date().toISOString(), updatedBy: userId };
  await putRecord(db, AUTOMATIC_SENDS_RECORD_ID, 'SETTING', value);
  return automaticSendSettings(db);
}

export async function logBlockedAutomaticSend(
  db: PrismaClient,
  origin: SendOrigin,
  requestId?: string,
) {
  await putRecord(db, `automatic-send-blocked:${randomUUID()}`, 'AUTOMATIC_SEND_BLOCKED', {
    at: new Date().toISOString(),
    module: origin.module,
    route: origin.route ?? null,
    userId: origin.userId ?? null,
    taskId: origin.taskId ?? null,
    requestId: requestId ?? null,
    automatic: true,
  });
}

export async function logBlockedAutomaticSendOnce(db: PrismaClient, key: string, origin: SendOrigin) {
  await putRecord(db, `automatic-send-blocked:${key.replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 180)}`, 'AUTOMATIC_SEND_BLOCKED', {
    at: new Date().toISOString(), module: origin.module, route: origin.route ?? null,
    userId: origin.userId ?? null, taskId: origin.taskId ?? null, automatic: true,
  });
}

export async function assertAutomaticSendsAllowed(
  db: PrismaClient,
  origin: SendOrigin,
  requestId?: string,
) {
  if (!origin.automatic) return;
  const settings = await automaticSendSettings(db);
  if (settings.enabled) return;
  await logBlockedAutomaticSend(db, origin, requestId);
  throw new AppError(423, 'Envios automáticos estão desligados. As filas foram preservadas.');
}
