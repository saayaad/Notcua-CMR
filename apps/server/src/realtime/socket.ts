import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { authorizeToken } from '../http/auth.js';
import { allowedOrigins, trustedOrigin } from '../config/origins.js';
import type { SessionSnapshot, SyncNotice, WhatsappPublisher } from '../modules/whatsapp/whatsapp.types.js';

interface ServerEvents {
  'server:ready': (payload: { service: string; stage: number }) => void;
  'whatsapp:state': (payload: SessionSnapshot) => void;
  'whatsapp:sync': (payload: SyncNotice) => void;
  'whatsapp:error': (payload: { sessionId: string; message: string }) => void;
}

export function attachRealtime(httpServer: HttpServer, snapshots?: () => Promise<SessionSnapshot[]>) {
  const io = new Server<Record<string, never>, ServerEvents>(httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
    allowRequest: (req, done) => done(null, trustedOrigin(req.headers.origin)),
    maxHttpBufferSize: 1024 * 1024,
  });
  io.use((socket, next) => {
    void authorizeToken(socket.handshake.auth.token)
      .then(() => next())
      .catch(() => next(new Error('Token de acesso inválido.')));
  });
  io.on('connection', (socket) => {
    const refreshAccess =
      env.AUTH_MODE === 'firebase'
        ? setInterval(() => {
            void authorizeToken(socket.handshake.auth.token).catch(() => socket.disconnect(true));
          }, 60000).unref()
        : undefined;
    socket.on('disconnect', () => {
      if (refreshAccess) clearInterval(refreshAccess);
    });
    socket.emit('server:ready', { service: 'noctua-server', stage: 5 });
    if (snapshots)
      void snapshots()
        .then((states) => {
          for (const state of states) if (socket.connected) socket.emit('whatsapp:state', state);
        })
        .catch(() => socket.disconnect(true));
  });
  return io;
}

export class RealtimeHub implements WhatsappPublisher {
  private io?: ReturnType<typeof attachRealtime>;
  attach(http: HttpServer, snapshots: () => Promise<SessionSnapshot[]>) {
    this.io = attachRealtime(http, snapshots);
    return this.io;
  }
  state(snapshot: SessionSnapshot) {
    this.io?.emit('whatsapp:state', snapshot);
  }
  sync(notice: SyncNotice) {
    this.io?.emit('whatsapp:sync', notice);
  }
  error(payload: { sessionId: string; message: string }) {
    this.io?.emit('whatsapp:error', payload);
  }
}
