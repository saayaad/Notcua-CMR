import { Router, type Request } from 'express';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../../shared/errors.js';
import { record, putRecord } from './records.js';
import type { WhatsappService } from '../whatsapp/whatsapp.service.js';

export interface NextAction {
  sessionId: string;
  conversationId: string;
  title: string;
  dueAt: string;
  completed: boolean;
  updatedAt: string;
  notifiedAt?: string;
}
export function nextActionRoutes(db: PrismaClient, whatsapp: WhatsappService) {
  const router = Router({ mergeParams: true });
  const parameters = (req: Request) =>
    z
      .object({ sessionId: z.string().min(1).max(200), conversationId: z.string().min(1).max(200) })
      .parse(req.params);
  const scope = async (sessionId: string, conversationId: string) => {
    if (
      !(await db.conversation.findFirst({ where: { id: conversationId, sessionId }, select: { id: true } }))
    )
      throw new AppError(404, 'Conversa não encontrada.');
    return `next-action:${conversationId}`;
  };
  router.get('/', async (req, res) => {
    const { sessionId, conversationId } = parameters(req);
    const key = await scope(sessionId, conversationId);
    res.json(await record<NextAction | null>(db, key, null));
  });
  router.put('/', async (req, res) => {
    const { sessionId, conversationId } = parameters(req);
    const key = await scope(sessionId, conversationId);
    const input = z
      .object({
        title: z.string().trim().min(2).max(300),
        dueAt: z.iso.datetime(),
        completed: z.boolean().default(false),
      })
      .parse(req.body);
    const previous = await record<NextAction | null>(db, key, null);
    const data: NextAction = {
      sessionId,
      conversationId,
      ...input,
      updatedAt: new Date().toISOString(),
      ...(previous?.dueAt === input.dueAt &&
      previous?.title === input.title &&
      previous.notifiedAt &&
      !previous.completed
        ? { notifiedAt: previous.notifiedAt }
        : {}),
    };
    await putRecord(db, key, 'NEXT_ACTION', data);
    whatsapp.notify(sessionId, 'messages');
    res.json(data);
  });
  return router;
}
export async function remindNextActions(
  db: PrismaClient,
  notify: (sessionId: string) => void,
  now = new Date(),
) {
  const rows = await db.operationRecord.findMany({ where: { kind: 'NEXT_ACTION' } });
  for (const row of rows) {
    const data = row.data as unknown as NextAction;
    if (data.completed || data.notifiedAt || new Date(data.dueAt) > now) continue;
    const chat = await db.conversation.findFirst({
      where: { id: data.conversationId, sessionId: data.sessionId },
      include: { contact: { select: { name: true } } },
    });
    if (!chat) continue;
    await db.$transaction(async (tx) => {
      const fresh = await tx.operationRecord.findUnique({ where: { id: row.id } });
      const current = fresh?.data as unknown as NextAction | undefined;
      if (!current || current.updatedAt !== data.updatedAt || current.notifiedAt || current.completed) return;
      const noticeId = `next-action-notice:${row.id}:${data.updatedAt}`;
      await tx.operationRecord.upsert({
        where: { id: noticeId },
        create: {
          id: noticeId,
          kind: 'NOTICE',
          data: {
            title: `Retorno: ${chat.contact.name}`,
            text: data.title,
            createdAt: now.toISOString(),
            read: false,
            conversationId: data.conversationId,
            sessionId: data.sessionId,
          },
        },
        update: {},
      });
      await tx.operationRecord.update({
        where: { id: row.id },
        data: { data: { ...data, notifiedAt: now.toISOString() } },
      });
    });
    notify(data.sessionId);
  }
}
