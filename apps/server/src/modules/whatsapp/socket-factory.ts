import makeWASocket, {
  Browsers,
  BufferJSON,
  makeCacheableSignalKeyStore,
  type AuthenticationState,
  type WAMessageKey,
  type WASocket,
  type proto,
} from '@whiskeysockets/baileys';
import { pino } from 'pino';
import type { PrismaClient } from '@prisma/client';
import { env } from '../../config/env.js';

export type WhatsappSocket = Pick<
  WASocket,
  'ev' | 'end' | 'logout' | 'profilePictureUrl' | 'resyncAppState' | 'user' | 'addChatLabel'
> &
  Partial<
    Pick<
      WASocket,
      | 'updateBlockStatus'
      | 'sendMessage'
      | 'sendPresenceUpdate'
      | 'readMessages'
      | 'updateMediaMessage'
      | 'removeChatLabel'
      | 'onWhatsApp'
    >
  >;
export type SocketFactory = (auth: AuthenticationState, sessionId: string) => WhatsappSocket;

export function socketFactory(db: PrismaClient): SocketFactory {
  const logger = pino({ level: env.WHATSAPP_LOG_LEVEL });
  return (auth, sessionId) =>
    makeWASocket({
      auth: { creds: auth.creds, keys: makeCacheableSignalKeyStore(auth.keys, logger) },
      logger,
      browser: Browsers.macOS('Chrome'),
      syncFullHistory: true,
      markOnlineOnConnect: false,
      connectTimeoutMs: 30_000,
      defaultQueryTimeoutMs: 30_000,
      qrTimeout: 60_000,
      getMessage: async (key: WAMessageKey) => {
        if (!key.id) return undefined;
        const message = await db.chatMessage.findFirst({
          where: {
            whatsappMessageId: key.id,
            conversation: {
              sessionId,
              contact: { identities: { some: { jid: key.remoteJid ?? '' } } },
            },
          },
          select: { rawPayload: true },
        });
        if (!message) return undefined;
        const raw = JSON.parse(JSON.stringify(message.rawPayload), BufferJSON.reviver) as {
          message?: proto.IMessage;
          sent?: { message?: proto.IMessage };
        };
        return raw.sent?.message ?? raw.message;
      },
    });
}
