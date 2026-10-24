import {
  initAuthCreds,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap,
} from '@whiskeysockets/baileys';
import type { PrismaClient } from '@prisma/client';
import { CredentialCipher } from './credential-cipher.js';
import { SerialQueue } from '../../shared/serial-queue.js';

export async function createAuthStore(db: PrismaClient, sessionId: string, cipher: CredentialCipher) {
  const queue = new SerialQueue();
  const where = (category: string, key: string) => ({ sessionId_category_key: { sessionId, category, key } });
  const saved = await db.whatsappAuthEntry.findUnique({ where: where('creds', 'main') });
  const creds = saved ? cipher.decrypt<AuthenticationCreds>(saved.encryptedValue) : initAuthCreds();
  const state: AuthenticationState = {
    creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
        await queue.idle();
        const entries = await db.whatsappAuthEntry.findMany({
          where: { sessionId, category: type, key: { in: ids } },
        });
        const result: { [id: string]: SignalDataTypeMap[T] } = {};
        for (const entry of entries) {
          const value = cipher.decrypt<SignalDataTypeMap[T]>(entry.encryptedValue);
          result[entry.key] =
            type === 'app-state-sync-key'
              ? (proto.Message.AppStateSyncKeyData.create(
                  value as Record<string, unknown>,
                ) as unknown as SignalDataTypeMap[T])
              : value;
        }
        return result;
      },
      set: (data) =>
        queue.run(async () => {
          await db.$transaction(
            async (tx) => {
              for (const [category, entries] of Object.entries(data)) {
                if (!entries) continue;
                for (const [key, value] of Object.entries(entries)) {
                  if (value == null)
                    await tx.whatsappAuthEntry.deleteMany({ where: { sessionId, category, key } });
                  else {
                    const encryptedValue = new Uint8Array(cipher.encrypt(value));
                    await tx.whatsappAuthEntry.upsert({
                      where: where(category, key),
                      create: { sessionId, category, key, encryptedValue },
                      update: { encryptedValue },
                    });
                  }
                }
              }
            },
            { timeout: 30_000 },
          );
        }),
    },
  };
  const save = () =>
    queue.run(async () => {
      const encryptedValue = new Uint8Array(cipher.encrypt(creds));
      await db.whatsappAuthEntry.upsert({
        where: where('creds', 'main'),
        create: { sessionId, category: 'creds', key: 'main', encryptedValue },
        update: { encryptedValue },
      });
    });
  return { state, save, flush: () => queue.idle() };
}
