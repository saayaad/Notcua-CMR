import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../../shared/errors.js';
import { json } from '../backups/validation.js';
import { record, putRecord } from './records.js';

const id = z.string().min(1).max(200);
const organizationSchema = z.object({
  categories: z.array(z.string().trim().min(1).max(80)).max(200),
  assignments: z.record(id, z.string().max(80)),
});
export function toolboxRoutes(db: PrismaClient) {
  const router = Router();
  router.get('/organization', async (_req, res) =>
    res.json(await record(db, 'library:organization', { categories: [], assignments: {} })),
  );
  router.put('/organization', async (req, res) => {
    const input = organizationSchema.parse(req.body);
    if (
      new Set(input.categories).size !== input.categories.length ||
      Object.values(input.assignments).some((value) => value && !input.categories.includes(value))
    )
      throw new AppError(422, 'Revise as categorias e os vínculos dos recursos.');
    await putRecord(db, 'library:organization', 'LIBRARY_ORGANIZATION', input);
    res.json(input);
  });
  router.get('/usage', async (_req, res) => {
    const rows = await db.operationRecord.findMany({ where: { kind: 'RESOURCE_USAGE' } });
    res.json(
      Object.fromEntries(
        rows.map((row) => [row.id.slice(6), Number((row.data as { count?: number }).count ?? 0)]),
      ),
    );
  });
  router.post('/usage', async (req, res) => {
    const resourceId = id.parse(z.object({ id }).parse(req.body).id);
    if (
      !(await db.asset.findUnique({ where: { id: resourceId }, select: { id: true } })) &&
      !(await db.macro.findUnique({ where: { id: resourceId }, select: { id: true } })) &&
      !(await db.funnel.findUnique({ where: { id: resourceId }, select: { id: true } }))
    )
      throw new AppError(404, 'Recurso não encontrado.');
    const count = await db.$transaction(async (tx) => {
      const key = `usage:${resourceId}`;
      const existing = await tx.operationRecord.findUnique({ where: { id: key } });
      const next = Number((existing?.data as { count?: number } | undefined)?.count ?? 0) + 1;
      await tx.operationRecord.upsert({
        where: { id: key },
        create: { id: key, kind: 'RESOURCE_USAGE', data: json({ count: next }) },
        update: { data: json({ count: next }) },
      });
      return next;
    });
    res.json({ count });
  });
  router.get('/sessions/:sessionId/transfers', async (req, res) => {
    const sessionId = id.parse(req.params.sessionId);
    const identity = res.locals.identity;
    const member = await record<{ department?: string; active?: boolean } | null>(
      db,
      `team:${identity.email}`,
      null,
    );
    const rows = await db.operationRecord.findMany({
      where: { kind: 'TRANSFER', data: { path: '$.sessionId', equals: sessionId } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({
      items: rows
        .map((row) => ({ id: row.id, ...(row.data as object) }))
        .filter((row) => {
          const transfer = row as {
            target?: string;
            from?: string;
            department?: string;
            targetType?: string;
          };
          return (
            identity.role === 'ADMIN' ||
            transfer.target === identity.email ||
            transfer.from === identity.email ||
            (member?.active &&
              transfer.targetType === 'DEPARTMENT' &&
              transfer.department === member.department)
          );
        }),
    });
  });
  router.post('/sessions/:sessionId/transfers', async (req, res) => {
    const sessionId = id.parse(req.params.sessionId);
    const input = z
      .object({
        conversationId: id,
        target: z.string().min(1).max(200),
        targetType: z.enum(['MEMBER', 'DEPARTMENT']).default('MEMBER'),
        note: z.string().max(2000).default(''),
      })
      .parse(req.body);
    const result = await db.$transaction(async (tx) => {
      const chat = await tx.conversation.findFirst({
        where: { id: input.conversationId, sessionId },
        include: { contact: true },
      });
      if (!chat) throw new AppError(404, 'Conversa não encontrada nesta conexão.');
      if (input.targetType === 'MEMBER') {
        input.target = z.email().parse(input.target).toLowerCase();
        const team = await tx.operationRecord.findUnique({ where: { id: `team:${input.target}` } });
        if (
          !(team?.data as { active?: boolean } | undefined)?.active &&
          input.target !== res.locals.identity.email
        )
          throw new AppError(422, 'O destinatário precisa estar ativo na equipe.');
      } else {
        const groups = await tx.operationRecord.findUnique({ where: { id: 'settings:departments' } });
        if (
          !(groups?.data as { items?: { name: string }[] } | undefined)?.items?.some(
            (item) => item.name === input.target,
          )
        )
          throw new AppError(422, 'Escolha um setor cadastrado.');
      }
      const pending = await tx.operationRecord.findFirst({
        where: {
          kind: 'TRANSFER',
          AND: [
            { data: { path: '$.conversationId', equals: chat.id } },
            { data: { path: '$.status', equals: 'PENDING' } },
          ],
        },
      });
      if (pending) throw new AppError(409, 'Esta conversa já possui uma transferência pendente.');
      const data = {
        ...input,
        department: input.targetType === 'DEPARTMENT' ? input.target : '',
        target: input.targetType === 'DEPARTMENT' ? `department:${input.target}` : input.target,
        sessionId,
        name: chat.contact.name,
        from: res.locals.identity.email,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };
      const row = await tx.operationRecord.create({
        data: { id: `transfer:${randomUUID()}`, kind: 'TRANSFER', data: json(data) },
      });
      return { id: row.id, ...data };
    });
    res.status(201).json(result);
  });
  router.put('/sessions/:sessionId/transfers/:transferId', async (req, res) => {
    const sessionId = id.parse(req.params.sessionId);
    const status = z.enum(['ACCEPTED', 'DECLINED']).parse(req.body.status);
    await db.$transaction(async (tx) => {
      const row = await tx.operationRecord.findFirst({
        where: { id: id.parse(req.params.transferId), kind: 'TRANSFER' },
      });
      const data = row?.data as
        | {
            sessionId: string;
            status: string;
            target: string;
            conversationId: string;
            targetType?: string;
            department?: string;
          }
        | undefined;
      if (!row || !data || data.sessionId !== sessionId)
        throw new AppError(404, 'Transferência não encontrada.');
      const member = await tx.operationRecord.findUnique({
        where: { id: `team:${res.locals.identity.email}` },
      });
      const memberData = member?.data as { department?: string; active?: boolean } | undefined;
      const inDepartment =
        data.targetType === 'DEPARTMENT' && memberData?.active && memberData.department === data.department;
      if (res.locals.identity.role !== 'ADMIN' && data.target !== res.locals.identity.email && !inDepartment)
        throw new AppError(403, 'Somente o destinatário pode responder à transferência.');
      if (data.status !== 'PENDING') throw new AppError(409, 'Esta transferência já foi respondida.');
      if (status === 'ACCEPTED')
        await tx.conversation.update({
          where: { id: data.conversationId },
          data: { assignedTo: data.targetType === 'DEPARTMENT' ? res.locals.identity.email : data.target },
        });
      await tx.operationRecord.update({
        where: { id: row.id },
        data: { data: json({ ...data, status, finishedAt: new Date().toISOString() }) },
      });
    });
    res.json({ saved: true });
  });
  return router;
}
