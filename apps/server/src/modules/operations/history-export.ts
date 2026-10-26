import type { Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { ZipArchive } from 'archiver';
import type { MessagingService } from '../attendance/messaging.service.js';
import { record } from './records.js';
import { AppError } from '../../shared/errors.js';
export async function exportHistory(
  db: PrismaClient,
  messaging: MessagingService,
  sessionId: string,
  ids: string[],
  includeMedia: boolean,
  res: Response,
  next: NextFunction,
) {
  const chats = await db.conversation.findMany({
    where: { sessionId, id: { in: ids } },
    include: { contact: true },
  });
  if (chats.length !== new Set(ids).size)
    throw new AppError(404, 'Uma das conversas não está disponível nesta conexão.');
  const archive = new ZipArchive({ zlib: { level: 5 } });
  archive.on('error', (error) => (res.headersSent ? res.destroy(error) : next(error)));
  res.on('close', () => {
    if (!res.writableFinished) archive.abort();
  });
  res.attachment('noctua-historicos.zip');
  archive.pipe(res);
  for (const chat of chats) {
    if (res.destroyed) break;
    const prefix = chats.length === 1 ? '' : `${chat.id.replace(/[^a-zA-Z0-9]/g, '')}/`;
    const manifest: {
      id: string;
      direction: string;
      role: string;
      text: string | null;
      caption: string | null;
      analysis?: string;
      analysisStatus: string;
      type: string;
      sentAt: Date;
      media?: string;
      mediaStatus: string;
    }[] = [];
    let cursor: string | undefined;
    while (!res.destroyed) {
      const rows = await db.chatMessage.findMany({
        where: { conversationId: chat.id },
        orderBy: [{ sentAt: 'asc' }, { id: 'asc' }],
        take: 200,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const message of rows) {
        let media: string | undefined;
        let mediaStatus = message.asViewOnce
          ? 'Visualização única: conteúdo não exportável.'
          : 'Não solicitado ou sem mídia.';
        if (
          includeMedia &&
          !message.asViewOnce &&
          /audio|image|video|document|sticker|ptv/.test(message.type)
        ) {
          try {
            const file = await messaging.media(sessionId, chat.id, message.id);
            media = `midias/${message.id.replace(/[^a-zA-Z0-9]/g, '')}-${file.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            archive.append(Buffer.from(file.data), { name: prefix + media });
            mediaStatus = 'Exportado';
          } catch {
            mediaStatus = 'Mídia indisponível no histórico/WhatsApp.';
          }
        }
        const analysis = message.asViewOnce
          ? {}
          : await record<{ text?: string }>(db, `ai-media:${message.id}`, {});
        manifest.push({
          id: message.id,
          direction: message.direction,
          role: message.direction === 'INBOUND' ? 'user' : 'assistant',
          text: message.asViewOnce ? null : message.text,
          caption: message.asViewOnce ? null : message.caption,
          analysis: analysis.text,
          analysisStatus: message.asViewOnce ? 'Visualização única: análise não permitida.' : analysis.text ? 'Análise salva incluída.' : 'Sem análise salva; consulte o pré-processamento de mídias.',
          type: message.type,
          sentAt: message.sentAt,
          media,
          mediaStatus,
        });
      }
      if (rows.length < 200) break;
      cursor = rows.at(-1)!.id;
    }
    const turns = manifest.map((message) => ({
      role: message.role,
      content:
        [message.text, message.caption, message.analysis].filter(Boolean).join('\n') ||
        '[Mídia sem transcrição]',
      sentAt: message.sentAt,
      media: message.media,
    }));
    archive.append(
      JSON.stringify(
        {
          contact: { name: chat.contact.name, phoneNumber: chat.contact.phoneNumber },
          assignedTo: chat.assignedTo,
          exportedAt: new Date(),
          messages: manifest,
        },
        null,
        2,
      ),
      { name: prefix + 'historico.json' },
    );
    archive.append(turns.map((turn) => JSON.stringify(turn)).join('\n'), { name: prefix + 'dialogo.jsonl' });
    archive.append(
      turns
        .map(
          (turn) =>
            `${turn.sentAt.toISOString()} | ${turn.role === 'user' ? 'Cliente' : 'Atendente'}: ${turn.content}`,
        )
        .join('\n'),
      { name: prefix + 'dialogo.txt' },
    );
    const csv = (value: unknown) => {
      const text = String(value ?? '');
      return '"' + (/^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replaceAll('"', '""') + '"';
    };
    archive.append(
      'role,content,sentAt,media\n' +
        turns
          .map((turn) => [turn.role, turn.content, turn.sentAt.toISOString(), turn.media].map(csv).join(','))
          .join('\n'),
      { name: prefix + 'dialogo.csv' },
    );
    // One conversation per record, preserving roles and chronological order for downstream ingestion.
    archive.append(
      JSON.stringify({ messages: turns.map(({ role, content }) => ({ role, content })) }) + '\n',
      { name: prefix + 'conversa.jsonl' },
    );
  }
  await archive.finalize();
}
