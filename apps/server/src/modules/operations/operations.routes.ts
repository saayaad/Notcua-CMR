import { Router } from 'express';
import { retryDatabaseOperation } from '../../database/retry.js';
import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { z } from 'zod';
import type { PrismaClient, Prisma } from '@prisma/client';
import { ZipArchive } from 'archiver';
import { AppError } from '../../shared/errors.js';
import type { WhatsappService } from '../whatsapp/whatsapp.service.js';
import type { MessagingService } from '../attendance/messaging.service.js';
import { CredentialCipher } from '../whatsapp/credential-cipher.js';
import { env } from '../../config/env.js';
import { json } from '../backups/validation.js';
import { ContactsService, leadSchema } from './contacts.service.js';
import { record, putRecord, type AgentSettings } from './records.js';
import { generateSuggestion } from './ai.service.js';
import { aiControl, setAiControl } from './ai-control.js';
import { aiUsage } from './ai-provider.js';
import { preprocessMedia } from './ai-media.js';
import { exportHistory } from './history-export.js';
import type { Batch, Delivery } from './delivery.worker.js';
import { toolboxRoutes } from './toolbox.routes.js';
import { macroRoutes } from './macros.routes.js';
import { createSystemBackup, type SystemBackup } from './system-backups.js';
import { inactivityRoutes } from './inactivity.js';

const id = z.string().min(1).max(200);
const profile = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().max(200).optional(),
  gender: z.string().max(40).optional(),
  birthday: z.string().max(30).optional(),
  language: z.string().max(40).optional(),
  country: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
  state: z.string().max(80).optional(),
  source: z.string().max(100).optional(),
  enteredAt: z.string().max(30).optional(),
  exitedAt: z.string().max(30).optional(),
  company: z.string().max(150).optional(),
  jobTitle: z.string().max(100).optional(),
  interests: z.string().max(1000).optional(),
  dealValue: z.string().max(24).optional(),
  observation: z.string().max(5000).optional(),
  optIn: z.boolean().optional(),
  optOut: z.boolean().optional(),
  pinned: z.boolean().optional(),
  assignedTo: z.string().max(200).optional(),
  department: z.string().max(100).optional(),
});
export function operationsRoutes(db: PrismaClient, whatsapp: WhatsappService, messaging: MessagingService) {
  const router = Router();
  const contacts = new ContactsService(db);
  router.use('/macros', macroRoutes(db));
  router.use('/toolbox', toolboxRoutes(db));
  router.use('/sessions/:sessionId/inactivity-rules', inactivityRoutes(db, whatsapp));
  const admin = (role: string) => {
    if (role !== 'ADMIN') throw new AppError(403, 'Esta ação exige acesso de administrador.');
  };
  router.put('/sessions/:sessionId/label-order', async (req, res) => {
    admin(res.locals.identity.role);
    const sessionId = id.parse(req.params.sessionId);
    await whatsapp.snapshot(sessionId);
    const { ids } = z.object({ ids: z.array(id).max(5000) }).parse(req.body);
    if (new Set(ids).size !== ids.length)
      throw new AppError(422, 'Cada etiqueta deve aparecer uma única vez.');
    await retryDatabaseOperation(() =>
      db.$transaction(
        async (tx) => {
          const labels = await tx.label.findMany({
            where: { isDeleted: false, OR: [{ sessionId }, { sessionId: null }] },
            orderBy: [{ position: 'asc' }, { name: 'asc' }, { id: 'asc' }],
          });
          if (ids.some((id) => !labels.some((label) => label.id === id)))
            throw new AppError(422, 'Uma etiqueta não está disponível nesta conexão. Atualize a lista.');
          const ordered = [
            ...ids,
            ...labels.filter((label) => !ids.includes(label.id)).map((label) => label.id),
          ];
          for (const [position, id] of ordered.entries())
            await tx.label.update({ where: { id }, data: { position } });
        },
        { timeout: 30000 },
      ),
    );
    whatsapp.notify(sessionId, 'labels');
    res.json({ saved: true });
  });
  router.get('/system-backups', async (_req, res) => {
    admin(res.locals.identity.role);
    const rows = await db.operationRecord.findMany({
      where: { kind: 'SYSTEM_BACKUP' },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    res.json({
      items: rows.map((row) => {
        const data = row.data as unknown as SystemBackup;
        return { id: row.id, filename: data.filename, createdAt: data.createdAt };
      }),
      automatic: (await record<{ automatic?: boolean }>(db, 'settings:backups', {})).automatic ?? false,
      time: (await record<{ time?: string }>(db, 'settings:backups', {})).time ?? '00:00',
    });
  });
  router.post('/system-backups', async (_req, res) => {
    admin(res.locals.identity.role);
    const data = await createSystemBackup(db);
    res.status(201).json({ id: data.id, filename: data.filename, createdAt: data.createdAt });
  });
  router.put('/system-backups/settings', async (req, res) => {
    admin(res.locals.identity.role);
    const data = z
      .object({
        automatic: z.boolean(),
        time: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
          .optional(),
      })
      .parse(req.body);
    await putRecord(db, 'settings:backups', 'SETTINGS', {
      ...(await record(db, 'settings:backups', {})),
      ...data,
    });
    res.json(data);
  });
  router.get('/system-backups/:id/download', async (req, res, next) => {
    admin(res.locals.identity.role);
    const value = await db.operationRecord.findFirst({
      where: { id: id.parse(req.params.id), kind: 'SYSTEM_BACKUP' },
    });
    if (!value) throw new AppError(404, 'Backup não encontrado.');
    const data = value.data as unknown as SystemBackup;
    const files = await Promise.allSettled([stat(data.database), stat(data.key)]);
    if (files.some((file) => file.status === 'rejected' || !file.value.isFile()))
      throw new AppError(404, 'Os arquivos deste backup não estão mais disponíveis. Crie uma nova cópia.');
    const archive = new ZipArchive({ zlib: { level: 5 } });
    archive.on('error', (error) => (res.headersSent ? res.destroy(error) : next(error)));
    archive.on('warning', (error) => res.destroy(error));
    res.attachment(`${data.filename}.zip`);
    archive.pipe(res);
    archive.file(data.database, { name: 'noctua.db' });
    archive.file(data.key, { name: 'whatsapp.key' });
    await archive.finalize();
  });
  router.get('/me', async (_req, res) => {
    const identity = res.locals.identity;
    res.json({ ...identity, profile: await record(db, `profile:${identity.uid}`, {}) });
  });
  router.put('/me', async (req, res) => {
    const data = z
      .object({
        name: z.string().trim().min(1).max(100),
        company: z.string().max(120),
        segment: z.string().max(100),
        employees: z.string().max(50),
        objective: z.string().max(1000),
        social: z.string().max(150),
        phone: z.string().max(30).default(''),
        completed: z.boolean().default(true),
      })
      .parse(req.body);
    await putRecord(db, `profile:${res.locals.identity.uid}`, 'PROFILE', data);
    res.json(data);
  });
  router.get('/settings/:key', async (req, res) => {
    const key = z.enum(['business', 'preferences', 'departments', 'shortcuts']).parse(req.params.key);
    res.json(
      await record(
        db,
        key === 'preferences' ? `preferences:${res.locals.identity.uid}` : `settings:${key}`,
        {},
      ),
    );
  });
  router.put('/settings/:key', async (req, res) => {
    const key = z.enum(['business', 'preferences', 'departments', 'shortcuts']).parse(req.params.key);
    if (key !== 'preferences') admin(res.locals.identity.role);
    const data = z.record(z.string().max(100), z.json()).parse(req.body);
    if (JSON.stringify(data).length > 30000) throw new AppError(413, 'Configuração muito grande.');
    await putRecord(
      db,
      key === 'preferences' ? `preferences:${res.locals.identity.uid}` : `settings:${key}`,
      'SETTINGS',
      data,
    );
    res.json(data);
  });
  router.get('/team', async (_req, res) => {
    admin(res.locals.identity.role);
    const rows = await db.operationRecord.findMany({ where: { kind: 'TEAM' } });
    res.json({ items: rows.map((row) => ({ id: row.id, ...(row.data as object) })) });
  });
  router.put('/team', async (req, res) => {
    admin(res.locals.identity.role);
    const data = z
      .object({
        email: z.email().transform((value) => value.toLowerCase()),
        name: z.string().min(1).max(100),
        role: z.enum(['ADMIN', 'MEMBER']),
        active: z.boolean(),
        department: z.string().max(100).default(''),
      })
      .parse(req.body);
    if (data.email === env.OWNER_EMAIL.toLowerCase())
      throw new AppError(409, 'O administrador principal é definido no servidor.');
    await putRecord(db, `team:${data.email}`, 'TEAM', data);
    res.json({ saved: true });
  });
  router.get('/notices', async (_req, res) => {
    const items = await db.operationRecord.findMany({
      where: { kind: 'NOTICE' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ items });
  });
  router.put('/notices/:id/read', async (req, res) => {
    const row = await db.operationRecord.findFirst({
      where: { id: id.parse(req.params.id), kind: 'NOTICE' },
    });
    if (!row) throw new AppError(404, 'Aviso não encontrado.');
    await putRecord(db, row.id, 'NOTICE', { ...(row.data as object), read: true });
    res.json({ saved: true });
  });
  router.get('/sessions/:sessionId/overview', async (req, res) => {
    const sessionId = id.parse(req.params.sessionId);
    await whatsapp.snapshot(sessionId);
    const [people, messages, batches, waiting] = await Promise.all([
      db.conversation.count({ where: { sessionId } }),
      db.chatMessage.count({ where: { conversation: { sessionId }, direction: 'OUTBOUND' } }),
      db.deliveryTask.groupBy({ by: ['status'], where: { sessionId }, _count: true }),
      db.conversation.count({ where: { sessionId, status: 'OPEN', unreadCount: { gt: 0 } } }),
    ]);
    res.json({ people, messages, batches, waiting, ai: await aiUsage(db) });
  });
  router.get('/sessions/:sessionId/contacts', async (req, res) => {
    const sessionId = id.parse(req.params.sessionId);
    await whatsapp.snapshot(sessionId);
    const search = z
      .string()
      .max(200)
      .parse(req.query.search ?? '');
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .parse(req.query.page ?? 1);
    const where = {
      sessionId,
      ...(req.query.assignedTo ? { assignedTo: z.string().max(200).parse(req.query.assignedTo) } : {}),
      contact: search ? { OR: [{ name: { contains: search } }, { phoneNumber: { contains: search } }] } : {},
    };
    const [items, total] = await Promise.all([
      db.conversation.findMany({
        where,
        orderBy: { contact: { name: 'asc' } },
        skip: (page - 1) * 100,
        take: 100,
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
        },
      }),
      db.conversation.count({ where }),
    ]);
    res.json({ items, total, page });
  });
  router.post('/contacts/import/preview', async (req, res) => {
    admin(res.locals.identity.role);
    res.json(await contacts.preview(req.body));
  });
  router.post('/sessions/:sessionId/contacts/import', async (req, res) => {
    admin(res.locals.identity.role);
    const sessionId = id.parse(req.params.sessionId);
    res.json(await contacts.import(sessionId, req.body));
    whatsapp.notify(sessionId, 'messages');
  });
  router.post('/sessions/:sessionId/contacts', async (req, res) => {
    const lead = leadSchema.parse(req.body);
    const sessionId = id.parse(req.params.sessionId);
    res.json(await contacts.import(sessionId, { items: [lead] }));
    whatsapp.notify(sessionId, 'messages');
  });
  router.put('/sessions/:sessionId/contacts/:conversationId', async (req, res) => {
    const sessionId = id.parse(req.params.sessionId);
    res.json(
      await contacts.updateProfile(sessionId, id.parse(req.params.conversationId), profile.parse(req.body)),
    );
    whatsapp.notify(sessionId, 'messages');
  });
  router.post('/sessions/:sessionId/contacts/:conversationId/notes', async (req, res) => {
    const sessionId = id.parse(req.params.sessionId);
    const { text } = z.object({ text: z.string().trim().min(1).max(5000) }).parse(req.body);
    res.json(
      await contacts.addNote(
        sessionId,
        id.parse(req.params.conversationId),
        text,
        res.locals.identity.email || 'Operador local',
      ),
    );
    whatsapp.notify(sessionId, 'messages');
  });
  const audience = async (sessionId: string, raw: unknown) => {
    const input = z
      .object({
        labelId: z.string().max(200).default(''),
        labelIds: z.array(id).max(200).default([]),
        match: z.enum(['AND', 'OR']).default('AND'),
        listId: z.string().max(200).default(''),
        listIds: z.array(id).max(200).default([]),
        inactiveDays: z.coerce.number().min(0).max(3650).default(0),
        conversationIds: z.array(id).max(5000).default([]),
      })
      .parse(raw);
    await whatsapp.snapshot(sessionId);
    const selectedListIds = [...new Set([...input.listIds, ...(input.listId ? [input.listId] : [])])];
    const lists = await Promise.all(
      selectedListIds.map((listId) =>
        record<{ sessionId: string; conversationIds: string[] } | null>(db, listId, null),
      ),
    );
    if (
      lists.some(
        (list, index) =>
          !list || list.sessionId !== sessionId || !selectedListIds[index]!.startsWith('lead-list:'),
      )
    )
      throw new AppError(404, 'Uma lista não foi encontrada nesta conexão.');
    const criteria: Prisma.ConversationWhereInput[] = [];
    if (input.inactiveDays)
      criteria.push({
        OR: [
          { lastMessageAt: { lte: new Date(Date.now() - input.inactiveDays * 86400000) } },
          { lastMessageAt: null },
        ],
      });
    const selectedLabels = [...new Set([...input.labelIds, ...(input.labelId ? [input.labelId] : [])])];
    if (selectedLabels.length)
      criteria.push({
        contact: {
          labels: {
            some: {
              labelId: { in: selectedLabels },
              label: { isDeleted: false, OR: [{ sessionId }, { sessionId: null }] },
            },
          },
        },
      });
    const where: Prisma.ConversationWhereInput = {
      sessionId,
      ...(input.conversationIds.length ? { id: { in: input.conversationIds } } : {}),
      AND: [
        ...(lists.length
          ? [{ id: { in: [...new Set(lists.flatMap((list) => list!.conversationIds))] } }]
          : []),
        ...(criteria.length ? [{ [input.match]: criteria }] : []),
      ],
      contact: {
        isGroup: false,
      },
    };
    const rows = await db.conversation.findMany({
      where,
      take: 5001,
      include: { contact: true },
      orderBy: { id: 'asc' },
    });
    if (rows.length > 5000) throw new AppError(422, 'Refine o público para até 5.000 contatos.');
    return rows.filter((row) => !(row.contact.metadata as { optOut?: boolean }).optOut);
  };
  router.get('/sessions/:sessionId/lead-lists', async (req, res) => {
    const sessionId = id.parse(req.params.sessionId);
    await whatsapp.snapshot(sessionId);
    const rows = await db.operationRecord.findMany({
      where: { kind: 'LEAD_LIST' },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      items: rows
        .map((row) => ({
          id: row.id,
          ...(row.data as { name: string; sessionId: string; conversationIds: string[] }),
        }))
        .filter((row) => row.sessionId === sessionId)
        .map((row) => ({ id: row.id, name: row.name, count: row.conversationIds.length })),
    });
  });
  router.post('/sessions/:sessionId/audience', async (req, res) => {
    admin(res.locals.identity.role);
    const rows = await audience(id.parse(req.params.sessionId), req.body);
    res.json({
      count: rows.length,
      items: rows.map((row) => ({
        id: row.id,
        name: row.contact.name,
        phoneNumber: row.contact.phoneNumber,
      })),
    });
  });
  router.get('/sessions/:sessionId/batches', async (req, res) => {
    const sessionId = id.parse(req.params.sessionId);
    await whatsapp.snapshot(sessionId);
    const rows = await db.operationRecord.findMany({
      where: { kind: 'BATCH' },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const items = [];
    for (const row of rows) {
      const data = row.data as unknown as Batch;
      if (data.sessionId !== sessionId) continue;
      const counts = await db.deliveryTask.groupBy({
        by: ['status'],
        where: { batchId: row.id },
        _count: true,
      });
      items.push({ id: row.id, ...data, counts });
    }
    res.json({ items });
  });
  router.post('/sessions/:sessionId/batches', async (req, res) => {
    admin(res.locals.identity.role);
    const sessionId = id.parse(req.params.sessionId);
    const input = z
      .object({
        name: z.string().trim().min(1).max(100),
        mode: z.enum(['CAMPAIGN', 'SCHEDULE', 'REMINDER']),
        audience: z.unknown(),
        delivery: z.object({
          kind: z.enum(['text', 'asset', 'funnel', 'flow', 'reminder', 'sequence']),
          steps: z
            .array(
              z.object({
                kind: z.enum(['text', 'asset']),
                text: z.string().max(10000).optional(),
                assetId: id.optional(),
                waitSeconds: z.number().int().min(0).max(86400).default(1),
              }),
            )
            .min(1)
            .max(30)
            .optional(),
          text: z.string().max(10000).optional(),
          assetId: id.optional(),
          funnelId: id.optional(),
          flowId: id.optional(),
        }),
        minSeconds: z.number().int().min(1).max(86400).default(15),
        maxSeconds: z.number().int().min(1).max(86400).default(45),
        pauseEvery: z.number().int().min(0).max(5000).default(0),
        pauseSeconds: z.number().int().min(0).max(86400).default(0),
        runAt: z.iso.datetime().optional(),
      })
      .parse(req.body);
    if (input.maxSeconds < input.minSeconds)
      throw new AppError(422, 'O intervalo máximo deve ser maior ou igual ao mínimo.');
    if ((input.mode === 'REMINDER') !== (input.delivery.kind === 'reminder'))
      throw new AppError(422, 'Use um lembrete somente no modo de lembrete.');
    const people = await audience(sessionId, input.audience);
    if (!people.length) throw new AppError(422, 'Nenhum contato corresponde ao público escolhido.');
    if (input.mode !== 'CAMPAIGN' && people.length !== 1)
      throw new AppError(422, 'Selecione uma conversa para o agendamento individual.');
    const { steps, ...initialDelivery } = input.delivery;
    const delivery: Delivery = { ...initialDelivery };
    if (delivery.kind === 'sequence') {
      if (!steps?.length) throw new AppError(422, 'Adicione mensagens à sequência.');
      delivery.steps = [];
      for (const step of steps) {
        if (step.kind === 'text') {
          if (!step.text?.trim()) throw new AppError(422, 'Preencha todos os textos da sequência.');
          delivery.steps.push({ snapshot: { kind: 'text', text: step.text }, waitSeconds: step.waitSeconds });
        } else {
          if (!step.assetId) throw new AppError(422, 'Selecione o recurso de cada etapa.');
          const asset = await db.asset.findUnique({ where: { id: step.assetId }, include: { file: true } });
          if (!asset) throw new AppError(422, 'Recurso não encontrado.');
          delivery.steps.push({
            snapshot: {
              kind:
                asset.kind === 'MESSAGE'
                  ? 'text'
                  : asset.kind === 'AUDIO'
                    ? 'audio'
                    : asset.kind === 'DOCUMENT'
                      ? 'document'
                      : asset.file?.mimeType.startsWith('video/')
                        ? 'video'
                        : 'image',
              text: asset.text ?? undefined,
              caption: asset.caption ?? undefined,
              fileId: asset.fileId ?? undefined,
              isPtt: asset.isPtt,
              isPtv: asset.isPtv,
              asViewOnce: asset.asViewOnce,
            },
            waitSeconds: step.waitSeconds,
          });
        }
      }
    }
    if (['text', 'reminder'].includes(delivery.kind) && !delivery.text?.trim())
      throw new AppError(422, 'Escreva a mensagem.');
    if (delivery.kind === 'asset') {
      const asset = await db.asset.findUnique({ where: { id: delivery.assetId }, include: { file: true } });
      if (!asset) throw new AppError(422, 'Escolha um recurso da biblioteca.');
      delivery.snapshot = {
        kind:
          asset.kind === 'MESSAGE'
            ? 'text'
            : asset.kind === 'AUDIO'
              ? 'audio'
              : asset.kind === 'DOCUMENT'
                ? 'document'
                : asset.file?.mimeType.startsWith('video/')
                  ? 'video'
                  : 'image',
        text: asset.text ?? undefined,
        caption: asset.caption ?? undefined,
        fileId: asset.fileId ?? undefined,
        isPtt: asset.isPtt,
        isPtv: asset.isPtv,
        asViewOnce: asset.asViewOnce,
      };
    }
    if (delivery.kind === 'funnel' && !(await db.funnel.findUnique({ where: { id: delivery.funnelId } })))
      throw new AppError(422, 'Escolha um funil.');
    if (
      delivery.kind === 'flow' &&
      !(await db.flow.findFirst({
        where: { id: delivery.flowId, sessionId, enabled: true, archived: false, enabledAt: { not: null } },
      }))
    )
      throw new AppError(422, 'Escolha um fluxo publicado e ativo nesta conexão.');
    const batchId = `batch:${randomUUID()}`;
    const data: Batch = {
      name: input.name,
      sessionId,
      status: 'DRAFT',
      mode: input.mode,
      minSeconds: input.minSeconds,
      maxSeconds: input.maxSeconds,
      pauseEvery: input.pauseEvery,
      pauseSeconds: input.pauseSeconds,
      sentCount: 0,
      count: people.length,
      createdAt: new Date().toISOString(),
    };
    await db.$transaction(
      async (tx) => {
        await tx.operationRecord.create({ data: { id: batchId, kind: 'BATCH', data: json(data) } });
        await tx.deliveryTask.createMany({
          data: people.map((chat) => ({
            batchId,
            sessionId,
            conversationId: chat.id,
            payload: json(delivery),
            runAt: new Date(
              (input.runAt ? new Date(input.runAt).getTime() : Date.now()) +
                (delivery.steps?.[0]?.waitSeconds ?? 0) * 1000,
            ),
          })),
        });
      },
      { timeout: 30000 },
    );
    res.status(201).json({ id: batchId, ...data });
  });
  router.put('/sessions/:sessionId/batches/:batchId', async (req, res) => {
    admin(res.locals.identity.role);
    const sessionId = id.parse(req.params.sessionId);
    const batchId = id.parse(req.params.batchId);
    const data = await record<Batch | null>(db, batchId, null);
    if (!data || data.sessionId !== sessionId) throw new AppError(404, 'Campanha não encontrada.');
    const { status } = z.object({ status: z.enum(['ACTIVE', 'PAUSED', 'CANCELLED']) }).parse(req.body);
    if (data.status === 'CANCELLED' || data.status === 'COMPLETED')
      throw new AppError(409, 'Esta execução foi encerrada. Crie uma nova.');
    await putRecord(db, batchId, 'BATCH', { ...data, status });
    if (status === 'CANCELLED')
      await db.deliveryTask.updateMany({
        where: { batchId, status: 'QUEUED' },
        data: { status: 'CANCELLED' },
      });
    res.json({ saved: true });
  });
  router.get('/sessions/:sessionId/batches/:batchId/tasks', async (req, res) => {
    const sessionId = id.parse(req.params.sessionId);
    const items = await db.deliveryTask.findMany({
      where: { sessionId, batchId: id.parse(req.params.batchId) },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    res.json({ items });
  });
  router.get('/ai', async (_req, res) => {
    admin(res.locals.identity.role);
    const settings = await record<AgentSettings>(db, 'integration:ai', {
      model: '',
      instructions: '',
      knowledge: '',
      style: '',
      enabled: false,
    });
    const { encryptedKey, ...safe } = settings;
    res.json({ ...safe, configured: Boolean(encryptedKey), usage: await aiUsage(db) });
  });
  router.put('/ai', async (req, res) => {
    admin(res.locals.identity.role);
    const input = z
      .object({
        apiKey: z.string().max(500).optional(),
        provider: z.enum(['openai', 'anthropic', 'gemini']).default('openai'),
        dailyTokenLimit: z.number().int().min(0).max(100000000).default(0),
        maxOutputTokens: z.number().int().min(100).max(16000).default(1200),
        monthlyBudget: z.number().min(0).max(1000000).default(0),
        inputPrice: z.number().min(0).max(10000).default(0),
        outputPrice: z.number().min(0).max(10000).default(0),
        fallbackText: z.string().max(2000).default(''),
        mediaEnabled: z.boolean().default(false),
        mediaModel: z.string().max(100).default(''),
        transcriptionModel: z.string().max(100).default(''),
        model: z.string().max(100),
        instructions: z.string().max(12000),
        knowledge: z.string().max(100000),
        style: z.string().max(6000),
        enabled: z.boolean().default(false),
        dailyLimit: z.number().int().min(1).max(5000).default(100),
      })
      .parse(req.body);
    const previous = await record<AgentSettings | null>(db, 'integration:ai', null);
    const { apiKey, ...settings } = input;
    let encryptedKey =
      settings.provider === (previous?.provider ?? 'openai') ? previous?.encryptedKey : undefined;
    if (settings.monthlyBudget && (!settings.inputPrice || !settings.outputPrice))
      throw new AppError(
        422,
        'Para limitar o orçamento estimado, informe os preços de entrada e saída do modelo.',
      );
    if (settings.mediaEnabled && !settings.mediaModel)
      throw new AppError(422, 'Informe o modelo de análise antes de ativar mídias.');
    if (apiKey?.trim())
      encryptedKey = (await CredentialCipher.load(env.WHATSAPP_KEY_FILE))
        .encrypt(apiKey.trim())
        .toString('base64');
    if (settings.enabled && !encryptedKey)
      throw new AppError(422, 'Salve uma chave válida antes de ativar a IA automática.');
    await putRecord(db, 'integration:ai', 'INTEGRATION', {
      ...settings,
      encryptedKey,
      enabledAt: settings.enabled
        ? previous?.enabled && previous.enabledAt
          ? previous.enabledAt
          : new Date().toISOString()
        : undefined,
    });
    res.json({ saved: true, configured: Boolean(encryptedKey) });
  });
  router.post('/sessions/:sessionId/contacts/:conversationId/ai', async (req, res) => {
    const { task } = z
      .object({ task: z.string().min(1).max(2000), consent: z.literal(true) })
      .parse(req.body);
    const chat = await messaging.chat(id.parse(req.params.sessionId), id.parse(req.params.conversationId));
    res.json(await generateSuggestion(db, chat.id, task));
  });
  router.get('/sessions/:sessionId/contacts/:conversationId/ai-control', async (req, res) => {
    const chat = await messaging.chat(id.parse(req.params.sessionId), id.parse(req.params.conversationId));
    const settings = await record<AgentSettings | null>(db, 'integration:ai', null);
    res.json({ ...(await aiControl(db, chat.id)), enabled: Boolean(settings?.enabled) });
  });
  router.put('/sessions/:sessionId/contacts/:conversationId/ai-control', async (req, res) => {
    const chat = await messaging.chat(id.parse(req.params.sessionId), id.parse(req.params.conversationId));
    const { paused } = z.object({ paused: z.boolean() }).parse(req.body);
    res.json(
      await setAiControl(
        db,
        chat.id,
        paused,
        paused ? 'Atendimento assumido pelo operador.' : 'IA retomada para novas mensagens.',
      ),
    );
    whatsapp.notify(chat.sessionId, 'messages');
  });
  router.get('/sessions/:sessionId/contacts/:conversationId/media-analysis', async (req, res) => {
    const chat = await messaging.chat(id.parse(req.params.sessionId), id.parse(req.params.conversationId));
    const messages = await db.chatMessage.findMany({
      where: { conversationId: chat.id, text: null, asViewOnce: false },
      orderBy: { sentAt: 'desc' },
      take: 100,
    });
    res.json({
      items: await Promise.all(
        messages
          .filter((item) => /audio|image|video|ptv/.test(item.type))
          .map(async (item) => ({
            id: item.id,
            type: item.type,
            sentAt: item.sentAt,
            analysis: await record(db, `ai-media:${item.id}`, null),
          })),
      ),
    });
  });
  router.post('/sessions/:sessionId/contacts/:conversationId/media-analysis', async (req, res) => {
    const { messageId } = z.object({ messageId: id, consent: z.literal(true) }).parse(req.body);
    res.json(
      await preprocessMedia(
        db,
        messaging,
        id.parse(req.params.sessionId),
        id.parse(req.params.conversationId),
        messageId,
      ),
    );
  });
  router.post('/sessions/:sessionId/contacts/:conversationId/knowledge', async (req, res) => {
    admin(res.locals.identity.role);
    const chat = await messaging.chat(id.parse(req.params.sessionId), id.parse(req.params.conversationId));
    const examples = await db.chatMessage.findMany({
      where: { conversationId: chat.id, asViewOnce: false },
      orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    const turns = [];
    for (const item of examples.reverse()) {
      const media = await record<{ text?: string }>(db, `ai-media:${item.id}`, {});
      const content = [item.text, item.caption, media.text].filter(Boolean).join('\n');
      if (content)
        turns.push({
          role: item.direction === 'INBOUND' ? 'user' : 'assistant',
          content,
          sentAt: item.sentAt.toISOString(),
        });
    }
    await putRecord(db, `knowledge:${chat.id}`, 'AI_KNOWLEDGE', {
      turns,
      conversationId: chat.id,
      approvedAt: new Date().toISOString(),
    });
    res.json({ examples: examples.length, sentToProvider: false });
  });
  router.get('/sessions/:sessionId/contacts/:conversationId/export', async (req, res, next) => {
    await exportHistory(
      db,
      messaging,
      id.parse(req.params.sessionId),
      [id.parse(req.params.conversationId)],
      req.query.media === 'true',
      res,
      next,
    );
  });
  router.get('/sessions/:sessionId/history-export', async (req, res, next) => {
    const sessionId = id.parse(req.params.sessionId);
    const ids = z
      .array(id)
      .min(1)
      .max(100)
      .parse(
        String(req.query.ids ?? '')
          .split(',')
          .filter(Boolean),
      );
    await exportHistory(db, messaging, sessionId, ids, req.query.media === 'true', res, next);
  });
  return router;
}
