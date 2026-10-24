import type { ConnectionStatus } from '@prisma/client';

export interface SessionSnapshot {
  id: string;
  name: string;
  status: ConnectionStatus;
  phoneNumber: string | null;
  lastConnectedAt: Date | null;
  autoConnect: boolean;
  qrDataUrl: string | null;
  qrExpiresAt: string | null;
  error: string | null;
  lastError: { code: string | null; operation: string } | null;
  retryCount: number;
}

export interface SyncNotice {
  sessionId: string;
  kind: 'contacts' | 'chats' | 'messages' | 'labels' | 'history' | 'identity';
  count: number;
  progress?: number | null;
}

export interface WhatsappPublisher {
  state(snapshot: SessionSnapshot): void;
  sync(notice: SyncNotice): void;
  error(payload: { sessionId: string; message: string }): void;
}

export const silentPublisher: WhatsappPublisher = { state() {}, sync() {}, error() {} };
