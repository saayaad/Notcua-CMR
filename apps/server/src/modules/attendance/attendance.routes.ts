import { randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import { setAiControl } from '../operations/ai-control.js';
import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import QRCode from 'qrcode';
import type { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { resolveContact } from '../whatsapp/contact.repository.js';
import { AppError } from '../../shared/errors.js';
import { json } from '../backups/validation.js';
import { MediaService } from './media.service.js';
import { MessagingService } from './messaging.service.js';
import { SequenceService } from './sequence.service.js';
import { pixKeySchema, pixPayload } from './pix.js';
import { queueLabelChange } from '../whatsapp/label-changes.js';

const stringId = z.string().min(1).max(200);
const pageSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
const ids = (req: Request) => ({
  sessionId: stringId.parse(req.params.sessionId),
  conversationId: stringId.parse(req.params.conversationId),
});
const assetSchema = z.object({
  name: z.string().trim().min(1).max(100),
  kind: z.enum(['MESSAGE', 'AUDIO', 'MEDIA', 'DOCUMENT']),
  text: z.string().max(20_000).nullable().optional(),
  caption: z.string().max(2000).nullable().optional(),
  fileId: stringId.nullable().optional(),
  isFavorite: z.boolean().default(false),
  isPtt: z.boolean().default(false),
  isPtv: z.boolean().default(false),
  asViewOnce: z.boolean().default(false),
});
const funnelSchema = z.object({
  name: z.string().trim().min(1).max(100),
  itemsSequence: z
    .array(z.object({ itemId: stringId, delayBeforeSend: z.number().int().min(0).max(86_400_000) }))
    .min(1)
    .max(100),
});

export function attendanceRoutes(
  db: PrismaClient,
  whatsapp: WhatsappService,
  sequences: SequenceService,
  messaging: MessagingService,
) {
  const router = Router();
  const media = new MediaService(db);
  router.get('/library', async (_req, res) => {
    const [assets, funnels, macros, pixKeys] = await Promise.all([
      db.asset.findMany({
        orderBy: [{ isFavorite: 'desc' }, { name: 'asc' }],
        select: {
          id: true,
          kind: true,
          name: true,
          text: true,
          caption: true,
          fileId: true,
          isFavorite: true,
          isPtt: true,
          isPtv: true,
          asViewOnce: true,
          file: { select: { id: true, mimeType: true, filename: true, byteLength: true } },
        },
      }),
      db.funnel.findMany({
        include: {
          items: { include: { asset: { select: { name: true, kind: true } } }, orderBy: { position: 'asc' } },
        },
        orderBy: { name: 'asc' },
      }),
      db.macro.findMany({
        select: { id: true, name: true, text: true, isFavorite: true, _count: { select: { actions: true } } },
        orderBy: { name: 'asc' },
      }),
      db.pixKey.findMany({ orderBy: [{ isFavorite: 'desc' }, { name: 'asc' }] }),
    ]);
    res.json({ assets, funnels, macros, pixKeys });
  });
  router.get('/assets/:id/file', async (req, res) => {
    const asset = await db.asset.findUnique({
      where: { id: stringId.parse(req.params.id) },
      include: { file: true },
    });
    if (!asset?.file) throw new AppError(404, 'Arquivo indisponível.');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.attachment(asset.file.filename).type(asset.file.mimeType).send(Buffer.from(asset.file.data));
  });
  router.post('/assets/:id/duplicate', async (req, res) => {
    const source = await db.asset.findUnique({ where: { id: stringId.parse(req.params.id) } });
    if (!source) throw new AppError(404, 'Resposta não encontrada.');
    const copy = await db.asset.create({
      data: {
        id: `asset:${randomUUID()}`,
        kind: source.kind,
        name: `${source.name} · cópia`,
        text: source.text,
        caption: source.caption,
        fileId: source.fileId,
        isFavorite: false,
        isPtt: source.isPtt,
        isPtv: source.isPtv,
        asViewOnce: source.asViewOnce,
        metadata: source.metadata ?? {},
      },
    });
    res.status(201).json({ id: copy.id, name: copy.name });
  });
  router.post('/files', async (req, res) => {
    const input = z
      .object({
        base64: z.string().min(1),
        filename: z.string().max(200).optional(),
        mimeType: z.string().optional(),
        voice: z.boolean().optional(),
      })
      .parse(req.body);
    res.status(201).json(await media.upload(input));
  });
  const saveAsset = async (req: Request, id: string) => {
    const input = assetSchema.parse(req.body);
    if (input.kind === 'MESSAGE' ? !input.text?.trim() : !input.fileId)
      throw new AppError(422, 'Informe o texto ou o arquivo do ativo.');
    if (input.fileId && !(await db.storedFile.findUnique({ where: { id: input.fileId } })))
      throw new AppError(404, 'Arquivo não encontrado.');
    return db.asset.upsert({ where: { id }, create: { id, ...input }, update: input });
  };
  router.post('/assets', async (req, res) => {
    res.status(201).json(await saveAsset(req, `asset:${randomUUID()}`));
  });
  router.put('/assets/:id', async (req, res) => {
    res.json(await saveAsset(req, stringId.parse(req.params.id)));
  });
  router.delete('/assets/:id', async (req, res) => {
    const id = stringId.parse(req.params.id);
    if (
      (await db.funnelItem.count({ where: { assetId: id } })) ||
      (await db.flowNode.count({ where: { assetId: id } }))
    )
      throw new AppError(
        409,
        'Este ativo está sendo usado em um funil ou fluxo. Remova o vínculo antes de excluir.',
      );
    await db.asset.deleteMany({ where: { id } });
    res.json({ deleted: true });
  });
  const saveFunnel = async (req: Request, id: string) => {
    const body = funnelSchema.parse(req.body);
    return db.$transaction(
      async (tx) => {
        for (const item of body.itemsSequence)
          if (!(await tx.asset.findUnique({ where: { id: item.itemId } })))
            throw new AppError(422, 'O funil contém um ativo inexistente.');
        await tx.funnel.upsert({
          where: { id },
          create: { id, name: body.name },
          update: { name: body.name },
        });
        await tx.funnelItem.deleteMany({ where: { funnelId: id } });
        await tx.funnelItem.createMany({
          data: body.itemsSequence.map((item, position) => ({
            funnelId: id,
            assetId: item.itemId,
            position,
            delayBeforeSendMs: item.delayBeforeSend,
          })),
        });
        return tx.funnel.findUniqueOrThrow({
          where: { id },
          include: { items: { orderBy: { position: 'asc' } } },
        });
      },
      { timeout: 30_000 },
    );
  };
  router.post('/funnels', async (req, res) => {
    res.status(201).json(await saveFunnel(req, `funnel:${randomUUID()}`));
  });
  router.put('/funnels/:id', async (req, res) => {
    res.json(await saveFunnel(req, stringId.parse(req.params.id)));
  });
  router.post('/pix-keys', async (req, res) => {
    res.status(201).json(await db.pixKey.create({ data: pixKeySchema.parse(req.body) }));
  });
  router.delete('/pix-keys/:id', async (req, res) => {
    await db.pixKey.deleteMany({ where: { id: stringId.parse(req.params.id) } });
    res.json({ deleted: true });
  });
  router.post('/pix-preview', async (req, res) => {
    const input = z
      .object({
        keyId: stringId,
        amountInCents: z.number().int().positive().max(999_999_999).optional(),
        transactionId: z.string().max(25).optional(),
      })
      .parse(req.body);
    const key = await db.pixKey.findUnique({ where: { id: input.keyId } });
    if (!key) throw new AppError(404, 'Chave PIX não encontrada.');
    const payload = pixPayload(key, input.amountInCents, input.transactionId);
    res.json({ payload, qrDataUrl: await QRCode.toDataURL(payload), key: key.value });
  });
  router.use('/sessions/:sessionId', async (req, _res, next) => {
    await whatsapp.snapshot(stringId.parse(req.params.sessionId));
    next();
  });
  router.get('/sessions/:sessionId/conversations', async (req, res) => {
    const { page, pageSize } = pageSchema.parse(req.query);
    const input = z
      .object({
        search: z.string().max(100).default(''),
        labelId: z.string().optional(),
        filter: z.enum(['all', 'unread', 'closed', 'archived', 'mine']).default('all'),
      })
      .parse(req.query);
    const where: Prisma.ConversationWhereInput = {
      sessionId: stringId.parse(req.params.sessionId),
      ...(input.filter === 'mine'
        ? { assignedTo: res.locals.identity?.email || res.locals.identity?.uid || 'local' }
        : {}),
      ...(input.filter === 'unread' ? { unreadCount: { gt: 0 } } : {}),
      status: input.filter === 'closed' || input.filter === 'archived' ? 'CLOSED' : 'OPEN',
      contact: {
        ...(input.search
          ? { OR: [{ name: { contains: input.search } }, { phoneNumber: { contains: input.search } }] }
          : {}),
        ...(input.labelId ? { labels: { some: { labelId: input.labelId } } } : {}),
      },
    };
    const [items, total] = await Promise.all([
      db.conversation.findMany({
        where,
        orderBy: [{ pinned: 'desc' }, { lastMessageAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          contact: {
            include: {
              labels: {
                where: { label: { isDeleted: false } },
                include: { label: true },
                orderBy: [{ label: { position: 'asc' } }, { label: { name: 'asc' } }],
              },
            },
          },
          messages: {
            orderBy: { sentAt: 'desc' },
            take: 1,
            select: { text: true, caption: true, type: true, direction: true, status: true },
          },
        },
      }),
      db.conversation.count({ where }),
    ]);
    res.json({ items, total, page, pageSize });
  });
  router.post('/sessions/:sessionId/conversations', async (req, res) => {
    const sessionId = stringId.parse(req.params.sessionId);
    const body = z
      .object({ phoneNumber: z.string().regex(/^\d{8,15}$/), name: z.string().trim().min(1).max(100) })
      .parse(req.body);
    const chat = await db.$transaction(async (tx) => {
      const contact = await resolveContact(tx, {
        jid: `${body.phoneNumber}@s.whatsapp.net`,
        name: body.name,
      });
      if (!contact) throw new AppError(422, 'Telefone inválido.');
      const key = { sessionId, contactId: contact.id };
      return tx.conversation.upsert({
        where: { sessionId_contactId: key },
        create: key,
        update: { status: 'OPEN' },
      });
    });
    whatsapp.notify(sessionId, 'chats');
    res.status(201).json(chat);
  });
  router.get('/sessions/:sessionId/conversations/:conversationId', async (req, res) => {
    const { sessionId, conversationId } = ids(req);
    const chat = await db.conversation.findFirst({
      where: { id: conversationId, sessionId },
      include: {
        contact: {
          include: {
            labels: {
              where: { label: { isDeleted: false, OR: [{ sessionId }, { sessionId: null }] } },
              include: { label: true },
              orderBy: [{ label: { position: 'asc' } }, { label: { name: 'asc' } }],
            },
          },
        },
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 1,
          select: { text: true, caption: true, type: true, direction: true, status: true },
        },
      },
    });
    if (!chat) throw new AppError(404, 'Conversa não encontrada nesta conexão.');
    res.json(chat);
  });
  router.get('/sessions/:sessionId/conversations/:conversationId/messages', async (req, res) => {
    const { sessionId, conversationId } = ids(req);
    await messaging.chat(sessionId, conversationId);
    const { page, pageSize } = pageSchema.parse(req.query);
    const [items, total] = await Promise.all([
      db.chatMessage.findMany({
        where: { conversationId },
        orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          text: true,
          caption: true,
          direction: true,
          status: true,
          type: true,
          sentAt: true,
          isPtt: true,
          isPtv: true,
          asViewOnce: true,
          fileId: true,
          error: true,
        },
      }),
      db.chatMessage.count({ where: { conversationId } }),
    ]);
    res.json({ items, total, page, pageSize });
  });
  router.post('/sessions/:sessionId/conversations/:conversationId/send', async (req, res) => {
    const { sessionId, conversationId } = ids(req);
    await messaging.chat(sessionId, conversationId);
    await setAiControl(db, conversationId, true, 'Atendimento assumido por mensagem manual.');
    res.status(201).json(await messaging.send(sessionId, conversationId, req.body));
  });
  router.post('/sessions/:sessionId/conversations/:conversationId/send-asset', async (req, res) => {
    const { sessionId, conversationId } = ids(req);
    const body = z.object({ assetId: stringId, requestId: stringId }).parse(req.body);
    await messaging.chat(sessionId, conversationId);
    await setAiControl(db, conversationId, true, 'Atendimento assumido por envio manual.');
    res.status(201).json(await messaging.sendAsset(sessionId, conversationId, body.assetId, body.requestId));
  });
  router.post('/sessions/:sessionId/conversations/:conversationId/unread', async (req, res) => {
    const { sessionId, conversationId } = ids(req);
    await messaging.chat(sessionId, conversationId);
    await db.conversation.update({ where: { id: conversationId }, data: { unreadCount: 1 } });
    whatsapp.notify(sessionId, 'chats');
    res.json({ saved: true });
  });
  router.post('/sessions/:sessionId/conversations/:conversationId/block', async (req, res) => {
    const { sessionId, conversationId } = ids(req);
    const chat = await messaging.chat(sessionId, conversationId);
    if (chat.contact.isGroup)
      throw new AppError(422, 'Bloqueio disponível apenas para contatos individuais.');
    const { blocked } = z.object({ blocked: z.boolean() }).parse(req.body);
    const socket = whatsapp.connectedSocket(sessionId);
    if (!socket.updateBlockStatus) throw new AppError(503, 'Bloqueio indisponível nesta conexão.');
    await socket.updateBlockStatus(chat.jid, blocked ? 'block' : 'unblock');
    await db.contact.update({
      where: { id: chat.contactId },
      data: { metadata: json({ ...(chat.contact.metadata as object), blocked }) },
    });
    whatsapp.notify(sessionId, 'chats');
    res.json({ saved: true });
  });
  router.post('/sessions/:sessionId/conversations/:conversationId/read', async (req, res) => {
    const { sessionId, conversationId } = ids(req);
    await messaging.read(sessionId, conversationId);
    res.json({ read: true });
  });
  router.put('/sessions/:sessionId/conversations/:conversationId', async (req, res) => {
    const { sessionId, conversationId } = ids(req);
    const chat = await messaging.chat(sessionId, conversationId);
    const body = z
      .object({
        status: z.enum(['OPEN', 'CLOSED']).optional(),
        name: z.string().trim().min(1).max(100).optional(),
        note: z.string().max(5000).optional(),
      })
      .parse(req.body);
    await db.$transaction(async (tx) => {
      if (body.status)
        await tx.conversation.update({ where: { id: conversationId }, data: { status: body.status } });
      if (body.name || body.note !== undefined)
        await tx.contact.update({
          where: { id: chat.contactId },
          data: {
            name: body.name,
            ...(body.note === undefined
              ? {}
              : {
                  metadata: json({ ...(chat.contact.metadata as Record<string, unknown>), note: body.note }),
                }),
          },
        });
    });
    whatsapp.notify(sessionId, 'chats');
    res.json({ saved: true });
  });
  router.put('/sessions/:sessionId/conversations/:conversationId/labels/:labelId', async (req, res) => {
    const { sessionId, conversationId } = ids(req);
    const chat = await messaging.chat(sessionId, conversationId);
    const labelId = stringId.parse(req.params.labelId);
    const { active } = z.object({ active: z.boolean() }).parse(req.body);
    const label = await db.label.findUnique({ where: { id: labelId } });
    if (!label || label.isDeleted || (label.sessionId && label.sessionId !== sessionId))
      throw new AppError(422, 'Etiqueta indisponível nesta conexão.');
    const link = { contactId: chat.contactId, labelId };
    await db.$transaction(async (tx) => {
      if (active)
        await tx.contactLabel.upsert({ where: { contactId_labelId: link }, create: link, update: {} });
      else await tx.contactLabel.deleteMany({ where: link });
      if (label.whatsappId)
        await queueLabelChange(tx, {
          ...link,
          sessionId,
          jid: chat.jid,
          whatsappId: label.whatsappId,
          active,
        });
    });
    whatsapp.notify(sessionId, 'labels');
    res.json({ saved: true });
  });
  router.get(
    '/sessions/:sessionId/conversations/:conversationId/messages/:messageId/media',
    async (req, res) => {
      const { sessionId, conversationId } = ids(req);
      const file = await messaging.media(sessionId, conversationId, stringId.parse(req.params.messageId));
      res.attachment(file.filename).type(file.mimeType).send(Buffer.from(file.data));
    },
  );
  router.get('/sessions/:sessionId/conversations/:conversationId/sequences', async (req, res) => {
    const { sessionId, conversationId } = ids(req);
    await messaging.chat(sessionId, conversationId);
    res.json({
      items: await db.sequenceRun.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          kind: true,
          position: true,
          status: true,
          nextRunAt: true,
          error: true,
          steps: true,
        },
      }),
    });
  });
  router.post('/sessions/:sessionId/conversations/:conversationId/sequences', async (req, res) => {
    const { sessionId, conversationId } = ids(req);
    const body = z
      .object({ kind: z.enum(['FUNNEL', 'MACRO']), sourceId: stringId, requestId: stringId })
      .parse(req.body);
    await messaging.chat(sessionId, conversationId);
    await setAiControl(db, conversationId, true, 'Atendimento assumido com sequência manual.');
    res
      .status(202)
      .json(await sequences.enqueue(sessionId, conversationId, body.kind, body.sourceId, body.requestId));
  });
  router.post(
    '/sessions/:sessionId/conversations/:conversationId/sequences/:runId/cancel',
    async (req, res) => {
      const { sessionId, conversationId } = ids(req);
      res.json(await sequences.cancel(sessionId, conversationId, stringId.parse(req.params.runId)));
    },
  );
  return router;
}
