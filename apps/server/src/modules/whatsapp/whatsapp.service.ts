import { DisconnectReason, jidNormalizedUser, type BaileysEventMap } from '@whiskeysockets/baileys';
import type { ConnectionStatus, PrismaClient } from '@prisma/client';
import QRCode from 'qrcode';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { SerialQueue } from '../../shared/serial-queue.js';
import { createAuthStore } from './auth-store.js';
import { CredentialCipher } from './credential-cipher.js';
import { PhotoSync } from './photo-sync.js';
import { SyncService } from './sync.service.js';
import { socketFactory, type SocketFactory, type WhatsappSocket } from './socket-factory.js';
import { silentPublisher, type SessionSnapshot, type WhatsappPublisher } from './whatsapp.types.js';
import { LabelOutbox } from './label-outbox.js';
import { retryDatabaseOperation } from '../../database/retry.js';

interface Runtime {
  controls: SerialQueue;
  data: SerialQueue;
  socket?: WhatsappSocket;
  auth?: Awaited<ReturnType<typeof createAuthStore>>;
  photos?: PhotoSync;
  generation: number;
  desired: boolean;
  connected: boolean;
  retryCount: number;
  timer?: ReturnType<typeof setTimeout>;
  qrTimer?: ReturnType<typeof setTimeout>;
  qrDataUrl: string | null;
  qrExpiresAt: string | null;
  error: string | null;
  lastError: { code: string | null; operation: string } | null;
  detach: (() => void)[];
}

export class WhatsappService {
  private readonly runtimes = new Map<string, Runtime>();
  private readonly sync: SyncService;
  private stopping = false;
  private readonly factory: SocketFactory;
  private readonly outbox: LabelOutbox;

  constructor(
    private readonly db: PrismaClient,
    private readonly cipher: CredentialCipher,
    private readonly publisher: WhatsappPublisher = silentPublisher,
    factory?: SocketFactory,
  ) {
    this.factory = factory ?? socketFactory(db);
    this.sync = new SyncService(db, publisher);
    this.outbox = new LabelOutbox(
      db,
      (id) => {
        const runtime = this.runtimes.get(id);
        return runtime?.socket && runtime.connected && runtime.desired ? runtime.socket : undefined;
      },
      (sessionId) => this.publisher.sync({ sessionId, kind: 'labels', count: 1 }),
    );
  }

  private runtime(id: string): Runtime {
    let runtime = this.runtimes.get(id);
    if (!runtime) {
      runtime = {
        controls: new SerialQueue(),
        data: new SerialQueue(),
        generation: 0,
        desired: false,
        connected: false,
        retryCount: 0,
        qrDataUrl: null,
        qrExpiresAt: null,
        error: null,
        lastError: null,
        detach: [],
      };
      this.runtimes.set(id, runtime);
    }
    return runtime;
  }

  async create(name: string) {
    const session = await this.db.whatsappSession.create({ data: { name, settings: { create: {} } } });
    return this.snapshot(session.id);
  }

  async list() {
    const sessions = await this.db.whatsappSession.findMany({ orderBy: { createdAt: 'asc' } });
    return Promise.all(sessions.map((s) => this.snapshot(s.id)));
  }

  async snapshot(id: string): Promise<SessionSnapshot> {
    const session = await this.db.whatsappSession.findUnique({ where: { id } });
    if (!session) throw new AppError(404, 'Sessão WhatsApp não encontrada.');
    const runtime = this.runtimes.get(id);
    return {
      id,
      name: session.name,
      status: runtime?.qrDataUrl ? 'AWAITING_QR' : session.status,
      phoneNumber: session.phoneNumber,
      lastConnectedAt: session.lastConnectedAt,
      autoConnect: session.autoConnect,
      qrDataUrl: runtime?.qrDataUrl ?? null,
      qrExpiresAt: runtime?.qrExpiresAt ?? null,
      error: runtime?.error ?? null,
      retryCount: runtime?.retryCount ?? 0,
      lastError: runtime?.lastError ?? null,
    };
  }

  private async publish(id: string, status?: ConnectionStatus) {
    if (status) await this.db.whatsappSession.update({ where: { id }, data: { status } });
    this.publisher.state(await this.snapshot(id));
  }

  private failure(id: string, error: unknown, operation = 'connection') {
    const message =
      error instanceof AppError
        ? error.message
        : 'Falha na sincronização WhatsApp. Consulte a conexão e tente novamente.';
    this.runtime(id).error = message;
    const code =
      error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string' &&
      /^P\d{4}$/.test(error.code)
        ? error.code
        : null;
    this.runtime(id).lastError = { code, operation };
    this.publisher.error({ sessionId: id, message });
    console.error(
      `[WhatsApp ${id}] ${error instanceof Error ? error.name : 'Erro'} ${code ?? ''}; evento: ${operation}.`,
    );
  }

  async connect(id: string) {
    if (this.stopping) throw new AppError(503, 'Servidor encerrando.');
    await this.snapshot(id);
    const runtime = this.runtime(id);
    return runtime.controls.run(async () => {
      if (runtime.socket || runtime.timer) return this.snapshot(id);
      runtime.desired = true;
      runtime.retryCount = 0;
      await this.db.whatsappSession.update({ where: { id }, data: { autoConnect: true } });
      await this.open(id, runtime);
      return this.snapshot(id);
    });
  }

  private async open(id: string, runtime: Runtime) {
    try {
      runtime.auth = await createAuthStore(this.db, id, this.cipher);
      runtime.error = null;
      await this.publish(id, 'CONNECTING');
      const socket = this.factory(runtime.auth.state, id);
      runtime.socket = socket;
      const generation = ++runtime.generation;
      const active = () => !this.stopping && runtime.generation === generation && runtime.socket === socket;
      const on = <T extends keyof BaileysEventMap>(
        event: T,
        handler: (payload: BaileysEventMap[T]) => Promise<unknown>,
        queue = runtime.data,
      ) => {
        const listener = (payload: BaileysEventMap[T]) => {
          if (!active()) return;
          void queue
            .run(async () => {
              if (!active()) return;
              if (queue === runtime.data) {
                await retryDatabaseOperation(async () => {
                  if (active()) await handler(payload);
                });
                if (active() && runtime.lastError?.operation === event) {
                  runtime.error = null;
                  runtime.lastError = null;
                  await this.publish(id);
                }
              } else await handler(payload);
            })
            .catch((error: unknown) => {
              if (active()) this.failure(id, error, event);
            });
        };
        socket.ev.on(event, listener);
        runtime.detach.push(() => socket.ev.off(event, listener));
      };
      if (env.WHATSAPP_SYNC_PHOTOS)
        runtime.photos = new PhotoSync(
          this.db,
          (jid) => socket.profilePictureUrl(jid, 'preview', 10_000),
          () => this.publisher.sync({ sessionId: id, kind: 'contacts', count: 1 }),
        );
      on('connection.update', (event) => this.connectionUpdate(id, runtime, event), runtime.controls);
      const saveCreds = () => {
        if (active()) void runtime.auth!.save().catch((error: unknown) => this.failure(id, error));
      };
      socket.ev.on('creds.update', saveCreds);
      runtime.detach.push(() => socket.ev.off('creds.update', saveCreds));
      on('messaging-history.set', async (event) => {
        await this.sync.history(id, event);
        runtime.photos?.add(event.contacts.map((c) => c.id));
      });
      on('contacts.upsert', async (entries) => {
        await this.sync.contactsUpsert(id, entries);
        runtime.photos?.add(entries.map((c) => c.id));
      });
      on('contacts.update', async (entries) => {
        await this.sync.contactsUpsert(id, entries);
        runtime.photos?.add(
          entries.filter((c) => c.imgUrl === 'changed').flatMap((c) => (c.id ? [c.id] : [])),
          true,
        );
      });
      on('lid-mapping.update', (entry) => this.sync.mapping(id, entry));
      on('chats.upsert', (entries) => this.sync.chatsUpsert(id, entries, false));
      on('chats.update', (entries) => this.sync.chatsUpsert(id, entries, false));
      on('messages.upsert', async (event) => {
        await this.sync.messagesUpsert(id, event.messages, event.type === 'notify');
        runtime.photos?.add(event.messages.flatMap((m) => (m.key.remoteJid ? [m.key.remoteJid] : [])));
      });
      on('messages.update', (entries) => this.sync.messageUpdates(id, entries));
      on('labels.edit', (label) => this.sync.labelEdit(id, label));
      on('labels.association', (event) => this.sync.labelAssociation(id, event));
    } catch (error) {
      await this.retire(runtime);
      runtime.desired = false;
      await this.db.whatsappSession.update({
        where: { id },
        data: { autoConnect: false, status: 'DISCONNECTED' },
      });
      const message =
        'Não foi possível abrir a sessão. Confira a chave em .secrets e a configuração do servidor.';
      runtime.error = message;
      await this.publish(id);
      throw new AppError(503, message);
    }
  }

  private clearQr(runtime: Runtime) {
    if (runtime.qrTimer) clearTimeout(runtime.qrTimer);
    runtime.qrTimer = undefined;
    runtime.qrDataUrl = null;
    runtime.qrExpiresAt = null;
  }

  private async retire(runtime: Runtime) {
    runtime.connected = false;
    runtime.generation++;
    this.clearQr(runtime);
    for (const detach of runtime.detach.splice(0)) detach();
    const socket = runtime.socket;
    runtime.socket = undefined;
    await runtime.photos?.stop();
    runtime.photos = undefined;
    if (socket) await socket.end(undefined).catch(() => undefined);
    await runtime.auth?.flush();
    runtime.auth = undefined;
  }

  private async connectionUpdate(id: string, runtime: Runtime, event: BaileysEventMap['connection.update']) {
    if (event.qr) {
      this.clearQr(runtime);
      runtime.qrDataUrl = await QRCode.toDataURL(event.qr, {
        width: 320,
        margin: 2,
        errorCorrectionLevel: 'M',
      });
      runtime.qrExpiresAt = new Date(Date.now() + 60_000).toISOString();
      const generation = runtime.generation;
      runtime.qrTimer = setTimeout(() => {
        void runtime.controls
          .run(async () => {
            if (runtime.generation !== generation) return;
            this.clearQr(runtime);
            runtime.error = 'O QR Code expirou. Aguarde a renovação ou conecte novamente.';
            await this.publish(id, 'CONNECTING');
          })
          .catch((error: unknown) => this.failure(id, error));
      }, 60_000).unref();
      await this.publish(id, 'AWAITING_QR');
    }
    if (event.connection === 'open') {
      runtime.connected = true;
      this.clearQr(runtime);
      runtime.retryCount = 0;
      runtime.error = null;
      const user = runtime.socket?.user?.id;
      const phoneNumber = user ? jidNormalizedUser(user).split('@')[0] : undefined;
      await runtime.auth?.save();
      await this.db.whatsappSession.update({
        where: { id },
        data: { status: 'CONNECTED', lastConnectedAt: new Date(), phoneNumber },
      });
      await this.publish(id);
    }
    if (event.connection === 'close') {
      const error = event.lastDisconnect?.error;
      const code =
        error && 'output' in error ? (error.output as { statusCode?: number }).statusCode : undefined;
      const reason =
        error instanceof Error ? error.message.replace(/[\r\n]/g, ' ').slice(0, 200) : 'indisponível';
      console.warn(`[WhatsApp ${id}] Conexão fechada. Código: ${code ?? 'indisponível'}. Motivo: ${reason}`);
      await this.retire(runtime);
      const terminal = [
        DisconnectReason.loggedOut,
        DisconnectReason.badSession,
        DisconnectReason.connectionReplaced,
        DisconnectReason.multideviceMismatch,
        DisconnectReason.forbidden,
      ].includes(code ?? -1);
      if (terminal || !runtime.desired || this.stopping || runtime.retryCount >= env.WHATSAPP_MAX_RETRIES) {
        runtime.desired = false;
        runtime.error =
          code === DisconnectReason.loggedOut
            ? 'Sessão encerrada no WhatsApp. Gere um novo QR Code.'
            : code === DisconnectReason.connectionReplaced
              ? 'A sessão foi aberta em outro processo. Encerre a outra execução antes de conectar.'
              : 'Conexão encerrada. Verifique a internet e tente conectar novamente.';
        await this.db.whatsappSession.update({ where: { id }, data: { autoConnect: false } });
        if (code === DisconnectReason.loggedOut || code === DisconnectReason.badSession) {
          await this.db.whatsappAuthEntry.deleteMany({ where: { sessionId: id } });
        }
        await this.publish(id, 'DISCONNECTED');
      } else {
        runtime.retryCount++;
        runtime.error =
          code === DisconnectReason.restartRequired ? null : 'Conexão interrompida. Tentando reconectar…';
        await this.publish(id, 'CONNECTING');
        const delay =
          code === DisconnectReason.restartRequired
            ? 500
            : Math.min(30_000, 1000 * 2 ** (runtime.retryCount - 1));
        runtime.timer = setTimeout(() => {
          runtime.timer = undefined;
          void runtime.controls
            .run(async () => {
              if (runtime.desired && !this.stopping) await this.open(id, runtime);
            })
            .catch((cause: unknown) => this.failure(id, cause));
        }, delay).unref();
      }
    }
  }

  async disconnect(id: string, logout = false) {
    await this.snapshot(id);
    const runtime = this.runtime(id);
    return runtime.controls.run(async () => {
      if (logout && !runtime.connected) {
        const saved = await this.db.whatsappAuthEntry.count({ where: { sessionId: id } });
        if (saved)
          throw new AppError(
            409,
            'Conecte a sessão antes de desvincular, ou remova o Noctua em Aparelhos conectados no celular.',
          );
      }
      if (logout && runtime.socket) {
        try {
          await runtime.socket.logout('Desvinculado pelo Noctua');
        } catch {
          throw new AppError(
            502,
            'O WhatsApp não confirmou a desvinculação. Tente novamente ou remova em Aparelhos conectados no celular.',
          );
        }
      }
      runtime.desired = false;
      if (runtime.timer) clearTimeout(runtime.timer);
      runtime.timer = undefined;
      await this.db.whatsappSession.update({ where: { id }, data: { autoConnect: false } });
      await this.retire(runtime);
      await runtime.data.idle();
      if (logout) await this.db.whatsappAuthEntry.deleteMany({ where: { sessionId: id } });
      runtime.error = null;
      await this.publish(id, 'DISCONNECTED');
      return this.snapshot(id);
    });
  }

  async resync(id: string) {
    const snapshot = await this.snapshot(id);
    const runtime = this.runtime(id);
    if (snapshot.status !== 'CONNECTED' || !runtime.socket)
      throw new AppError(409, 'Conecte o WhatsApp antes de sincronizar etiquetas.');
    await runtime.socket.resyncAppState(['regular', 'regular_low', 'regular_high'], false);
    return { requested: true };
  }

  connectedSocket(id: string): WhatsappSocket {
    const runtime = this.runtimes.get(id);
    if (!runtime?.connected || !runtime.socket || this.stopping)
      throw new AppError(409, 'O WhatsApp desta conexão está desconectado.');
    return runtime.socket;
  }

  notify(sessionId: string, kind: 'messages' | 'chats' | 'labels', count = 1) {
    this.publisher.sync({ sessionId, kind, count });
  }

  async restore() {
    await this.outbox.start();
    const sessions = await this.db.whatsappSession.findMany({ where: { autoConnect: true } });
    await this.db.whatsappSession.updateMany({ data: { status: 'DISCONNECTED' } });
    for (const session of sessions) {
      const credentials = await this.db.whatsappAuthEntry.findUnique({
        where: { sessionId_category_key: { sessionId: session.id, category: 'creds', key: 'main' } },
      });
      if (credentials)
        await this.connect(session.id).catch((error: unknown) => this.failure(session.id, error));
      else await this.db.whatsappSession.update({ where: { id: session.id }, data: { autoConnect: false } });
    }
  }

  async idle(id: string) {
    const runtime = this.runtime(id);
    await runtime.controls.idle();
    await runtime.data.idle();
    await runtime.auth?.flush();
  }

  async shutdown() {
    this.stopping = true;
    await this.outbox.stop();
    await Promise.all(
      [...this.runtimes.entries()].map(([id, runtime]) =>
        runtime.controls.run(async () => {
          runtime.desired = false;
          if (runtime.timer) clearTimeout(runtime.timer);
          await this.retire(runtime);
          await runtime.data.idle();
          await this.publish(id, 'DISCONNECTED');
        }),
      ),
    );
  }
}
