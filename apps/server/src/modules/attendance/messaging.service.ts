import {
  BufferJSON,
  downloadMediaMessage,
  generateMessageIDV2,
  normalizeMessageContent,
  type AnyMessageContent,
  type WAMessage,
} from '@whiskeysockets/baileys';
import { pino } from 'pino';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../../shared/errors.js';
import { SerialQueue } from '../../shared/serial-queue.js';
import type { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { messageJson } from '../whatsapp/sync.service.js';
import { digest } from '../backups/validation.js';

export const sendSchema = z
  .object({
    requestId: z.string().min(1).max(160),
    kind: z.enum(['text', 'audio', 'image', 'video', 'document', 'sticker']),
    text: z.string().max(20_000).optional(),
    fileId: z.string().min(1).optional(),
    caption: z.string().max(2000).optional(),
    isPtt: z.boolean().default(false),
    isPtv: z.boolean().default(false),
    asViewOnce: z.boolean().default(false),
    composingMs: z.number().int().min(0).max(30_000).default(0),
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'text' ? !value.text?.trim() : !value.fileId)
      ctx.addIssue({ code: 'custom', message: 'Informe a mensagem ou o arquivo a enviar.' });
    if (value.isPtt && value.kind !== 'audio') ctx.addIssue({ code: 'custom', message: 'PTT exige áudio.' });
    if (value.isPtv && value.kind !== 'video')
      ctx.addIssue({ code: 'custom', message: 'Recado circular exige vídeo.' });
    if (value.asViewOnce && !['image', 'video', 'audio'].includes(value.kind))
      ctx.addIssue({ code: 'custom', message: 'Visualização única exige imagem, vídeo ou áudio.' });
  });
export type SendInput = z.infer<typeof sendSchema>;

export class MessagingService {
  private readonly queues = new Map<string, SerialQueue>();
  constructor(
    private readonly db: PrismaClient,
    private readonly whatsapp: WhatsappService,
  ) {}

  async chat(sessionId: string, conversationId: string) {
    const chat = await this.db.conversation.findFirst({
      where: { id: conversationId, sessionId },
      include: { contact: { include: { identities: true } } },
    });
    if (!chat) throw new AppError(404, 'Conversa não encontrada nesta conexão.');
    const jid =
      chat.contact.identities.find((i) => i.jid.endsWith('@lid'))?.jid ??
      chat.contact.whatsappJid ??
      chat.contact.identities[0]?.jid;
    if (!jid) throw new AppError(422, 'Este contato ainda não possui um endereço WhatsApp sincronizado.');
    return { ...chat, jid };
  }

  async presence(sessionId: string, conversationId: string, type: 'composing' | 'recording' | 'paused') {
    const chat = await this.chat(sessionId, conversationId);
    const socket = this.whatsapp.connectedSocket(sessionId);
    await socket.sendPresenceUpdate?.(type, chat.jid);
  }

  async send(sessionId: string, conversationId: string, raw: unknown, beforeSend?: () => Promise<void>) {
    const input = sendSchema.parse(raw);
    let queue = this.queues.get(conversationId);
    if (!queue) {
      queue = new SerialQueue();
      this.queues.set(conversationId, queue);
    }
    return queue.run(async () => {
      const chat = await this.chat(sessionId, conversationId);
      const fingerprint = digest(JSON.stringify({ sessionId, conversationId, ...input }));
      const id = `out:${input.requestId}`;
      const previous = await this.db.chatMessage.findUnique({ where: { id } });
      if (previous) {
        const stored = previous.rawPayload as { requestFingerprint?: string };
        if (stored.requestFingerprint !== fingerprint || previous.conversationId !== conversationId)
          throw new AppError(409, 'Este identificador de envio já foi usado para outra mensagem.');
        if (previous.status === 'FAILED')
          throw new AppError(
            409,
            'O envio anterior não foi confirmado. Confira o WhatsApp antes de iniciar um novo envio.',
          );
        if (previous.status === 'PENDING')
          throw new AppError(409, 'Este envio já está em processamento. Aguarde a confirmação.');
        return previous;
      }
      const socket = this.whatsapp.connectedSocket(sessionId);
      if (!socket.sendMessage) throw new AppError(503, 'O serviço de envio não está disponível.');
      const hour = Number(
        new Intl.DateTimeFormat('en-GB', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          hourCycle: 'h23',
        }).format(new Date()),
      );
      const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
      const personalize = (text: string) =>
        text
          .replaceAll('#nome', chat.contact.name)
          .replace(/\{\{\s*nome\s*\}\}/g, () => chat.contact.name)
          .replace(/\{\{\s*saudacao\s*\}\}/g, greeting);
      const file = input.fileId ? await this.db.storedFile.findUnique({ where: { id: input.fileId } }) : null;
      if (input.kind !== 'text' && !file) throw new AppError(404, 'Arquivo não encontrado.');
      const text = input.text ? personalize(input.text) : undefined;
      const caption = input.caption ? personalize(input.caption) : undefined;
      let content: AnyMessageContent;
      if (input.kind === 'text') content = { text: text! };
      else {
        const data = Buffer.from(file!.data);
        const mime = file!.mimeType;
        if (
          input.kind !== 'document' &&
          !(input.kind === 'sticker'
            ? mime === 'image/webp'
            : mime.startsWith(`${input.kind === 'image' ? 'image' : input.kind}/`))
        )
          throw new AppError(422, 'O tipo do arquivo não corresponde ao envio selecionado.');
        if (
          input.isPtt &&
          (!data.subarray(0, 4).equals(Buffer.from('OggS')) || !data.includes(Buffer.from('OpusHead')))
        )
          throw new AppError(
            422,
            'Áudio PTT precisa ser OGG/Opus. Importe como áudio de voz para converter.',
          );
        if (input.isPtv && !mime.startsWith('video/mp4'))
          throw new AppError(422, 'O recado circular precisa ser um vídeo MP4.');
        content =
          input.kind === 'sticker'
            ? { sticker: data, mimetype: 'image/webp' }
            : input.kind === 'audio'
              ? { audio: data, mimetype: mime, ptt: input.isPtt, viewOnce: input.asViewOnce }
              : input.kind === 'image'
                ? { image: data, caption, viewOnce: input.asViewOnce }
                : input.kind === 'video'
                  ? { video: data, caption, mimetype: mime, ptv: input.isPtv, viewOnce: input.asViewOnce }
                  : { document: data, mimetype: mime, fileName: file!.filename, caption };
      }
      const whatsappMessageId = generateMessageIDV2(socket.user?.id);
      await this.db.chatMessage.create({
        data: {
          id,
          conversationId,
          whatsappMessageId,
          direction: 'OUTBOUND',
          status: 'PENDING',
          type: input.kind,
          text,
          caption,
          fileId: file?.id,
          isPtt: input.isPtt,
          isPtv: input.isPtv,
          asViewOnce: input.asViewOnce,
          rawPayload: { requestFingerprint: fingerprint },
        },
      });
      this.whatsapp.notify(sessionId, 'messages');
      try {
        if (input.composingMs) {
          await socket
            .sendPresenceUpdate?.(input.isPtt ? 'recording' : 'composing', chat.jid)
            .catch(() => undefined);
          await new Promise((resolve) => setTimeout(resolve, input.composingMs));
        }
        await beforeSend?.();
        const result = await socket.sendMessage(chat.jid, content, { messageId: whatsappMessageId });
        if (!result?.key.id) throw new Error('WhatsApp não confirmou o envio.');
        const current = await this.db.chatMessage.findUniqueOrThrow({ where: { id } });
        const message = await this.db.chatMessage.update({
          where: { id },
          data: {
            status: ['READ', 'DELIVERED'].includes(current.status) ? current.status : 'SENT',
            rawPayload: { requestFingerprint: fingerprint, sent: messageJson(result) },
          },
        });
        await this.db.conversation.update({
          where: { id: conversationId },
          data: { lastMessageAt: message.sentAt },
        });
        this.whatsapp.notify(sessionId, 'messages');
        return message;
      } catch {
        await this.db.chatMessage.update({
          where: { id },
          data: {
            status: 'FAILED',
            error: 'Envio sem confirmação. Confira o WhatsApp antes de tentar novamente.',
          },
        });
        this.whatsapp.notify(sessionId, 'messages');
        throw new AppError(
          502,
          'O envio não foi confirmado. Confira a conversa no WhatsApp antes de reenviar para evitar duplicação.',
        );
      } finally {
        await socket.sendPresenceUpdate?.('paused', chat.jid).catch(() => undefined);
      }
    });
  }

  async sendAsset(sessionId: string, conversationId: string, assetId: string, requestId: string) {
    const asset = await this.db.asset.findUnique({
      where: { id: assetId },
      include: { file: { select: { mimeType: true } } },
    });
    if (!asset) throw new AppError(404, 'Resposta rápida não encontrada.');
    const kind =
      asset.kind === 'MESSAGE'
        ? 'text'
        : asset.kind === 'AUDIO'
          ? 'audio'
          : asset.kind === 'DOCUMENT'
            ? 'document'
            : asset.file?.mimeType.startsWith('video/')
              ? 'video'
              : 'image';
    return this.send(sessionId, conversationId, {
      requestId,
      kind,
      text: asset.text ?? undefined,
      caption: asset.caption ?? undefined,
      fileId: asset.fileId ?? undefined,
      isPtt: asset.isPtt,
      isPtv: asset.isPtv,
      asViewOnce: asset.asViewOnce,
    });
  }

  async read(sessionId: string, conversationId: string) {
    const chat = await this.chat(sessionId, conversationId);
    const socket = this.whatsapp.connectedSocket(sessionId);
    const recent = await this.db.chatMessage.findMany({
      where: { conversationId, direction: 'INBOUND', whatsappMessageId: { not: null } },
      orderBy: { sentAt: 'desc' },
      take: 100,
      select: { whatsappMessageId: true },
    });
    await socket.readMessages?.(
      recent.map((m) => ({ remoteJid: chat.jid, id: m.whatsappMessageId!, fromMe: false })),
    );
    await this.db.conversation.update({ where: { id: conversationId }, data: { unreadCount: 0 } });
    this.whatsapp.notify(sessionId, 'chats');
  }

  async media(sessionId: string, conversationId: string, messageId: string) {
    await this.chat(sessionId, conversationId);
    const row = await this.db.chatMessage.findFirst({
      where: { id: messageId, conversationId },
      include: { file: true },
    });
    if (!row) throw new AppError(404, 'Mensagem não encontrada.');
    if (row.asViewOnce)
      throw new AppError(403, 'Mídias de visualização única devem ser abertas no WhatsApp.');
    if (row.file) return row.file;
    const socket = this.whatsapp.connectedSocket(sessionId);
    const payload = row.rawPayload as { sent?: unknown };
    const raw = JSON.parse(JSON.stringify(payload.sent ?? row.rawPayload), BufferJSON.reviver) as WAMessage;
    const content = normalizeMessageContent(raw.message);
    const media =
      content?.imageMessage ??
      content?.videoMessage ??
      content?.audioMessage ??
      content?.documentMessage ??
      content?.stickerMessage;
    if (!media) throw new AppError(422, 'Esta mensagem não contém arquivo disponível.');
    try {
      const stream = await downloadMediaMessage(
        raw,
        'stream',
        {},
        {
          logger: pino({ level: 'silent' }),
          reuploadRequest: async (message) =>
            socket.updateMediaMessage ? socket.updateMediaMessage(message) : message,
        },
      );
      const chunks: Buffer[] = [];
      let length = 0;
      for await (const chunk of stream) {
        const part = Buffer.from(chunk);
        length += part.length;
        if (length > 20 * 1024 * 1024) {
          stream.destroy();
          throw new AppError(413, 'Mídia maior que 20 MiB. Abra no WhatsApp.');
        }
        chunks.push(part);
      }
      const data = Buffer.concat(chunks);
      const sha256 = digest(data);
      const file = await this.db.storedFile.upsert({
        where: { sha256 },
        create: {
          sha256,
          filename: 'fileName' in media && typeof media.fileName === 'string' ? media.fileName : 'arquivo',
          mimeType: media.mimetype ?? 'application/octet-stream',
          data: new Uint8Array(data),
          byteLength: length,
        },
        update: {},
      });
      await this.db.chatMessage.update({ where: { id: row.id }, data: { fileId: file.id } });
      return file;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(502, 'O arquivo expirou ou não pôde ser baixado. Confira no WhatsApp.');
    }
  }
}
