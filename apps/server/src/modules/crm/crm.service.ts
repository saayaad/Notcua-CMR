import { randomUUID } from 'node:crypto';
import { labelActionInput } from '../operations/label-actions.js';
import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../../shared/errors.js';
import { SerialQueue } from '../../shared/serial-queue.js';
import type { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { type LabelChange } from '../whatsapp/label-changes.js';
import { json } from '../backups/validation.js';

const id = z.string().min(1).max(200);
export const boardQuery = z.object({
  search: z.string().trim().max(100).default(''),
  status: z.enum(['ALL', 'OPEN', 'WON', 'LOST']).default('ALL'),
  limit: z.coerce.number().int().min(50).max(5000).default(500),
});
export const moveInput = z.object({
  ...labelActionInput,
  conversationId: id,
  sourceLabelId: id.nullable(),
  targetLabelId: id.nullable(),
  beforeConversationId: id.nullable().default(null),
  version: z.number().int().nonnegative(),
});
export const opportunityInput = z.object({
  title: z.string().trim().max(120),
  valueInCents: z.number().int().min(0).max(2_000_000_000),
  status: z.enum(['OPEN', 'WON', 'LOST']),
  version: z.number().int().nonnegative(),
});
export const labelInput = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.string().regex(/^#[\da-fA-F]{6}$/),
  description: z.string().max(500).default(''),
});
const scope = (sessionId: string): Prisma.LabelWhereInput => ({
  isDeleted: false,
  OR: [{ sessionId }, { sessionId: null }],
});
const positions = (value: Prisma.JsonValue | undefined): Record<string, number> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, number>) : {};
const columnKey = (value: string | null) => value ?? 'unlabelled';
const includeChat = (sessionId: string) =>
  ({
    opportunity: true,
    contact: {
      include: { identities: true, labels: { where: { label: scope(sessionId) }, include: { label: true } } },
    },
  }) satisfies Prisma.ConversationInclude;
type Chat = Prisma.ConversationGetPayload<{ include: ReturnType<typeof includeChat> }>;
const membershipKey = (stageId: string) => `stage:${stageId}`;
const belongs = (chat: Chat, stageId: string | null) => {
  const placement = positions(chat.opportunity?.placements);
  return stageId
    ? placement[membershipKey(stageId)] === 1
    : !Object.keys(placement).some((key) => key.startsWith('stage:') && placement[key] === 1);
};
const stageSchema = labelInput.extend({
  id: z.string(),
  position: z.number(),
  isDeleted: z.boolean().default(false),
});
const stageKind = (sessionId: string) => `CRM_STAGE:${sessionId}`;
const stageKey = (sessionId: string, stageId: string) => `crm-stage:${sessionId}:${stageId}`;
const rank = (chat: Chat, labelId: string | null) =>
  positions(chat.opportunity?.placements)[columnKey(labelId)] ??
  -(chat.lastMessageAt ?? chat.createdAt).getTime();
const sortCards = (a: Chat, b: Chat, labelId: string | null) =>
  rank(a, labelId) - rank(b, labelId) || a.id.localeCompare(b.id);

export class CrmService {
  private readonly mutations = new SerialQueue();
  constructor(
    private readonly db: PrismaClient,
    private readonly whatsapp: WhatsappService,
  ) {}

  // Snapshot the legacy board once; later label changes never enter stage storage.
  private async ensureStages(sessionId: string) {
    const marker = `crm-stages-initialized:${sessionId}`;
    if (await this.db.operationRecord.findUnique({ where: { id: marker } })) return;
    await this.db.$transaction(
      async (tx) => {
        if (await tx.operationRecord.findUnique({ where: { id: marker } })) return;
        const labels = await tx.label.findMany({ where: scope(sessionId) });
        for (const label of labels) {
          await tx.operationRecord.create({
            data: {
              id: stageKey(sessionId, label.id),
              kind: stageKind(sessionId),
              data: json({
                id: label.id,
                name: label.name,
                color: label.color,
                description: label.description,
                position: label.position,
                isDeleted: false,
              }),
            },
          });
        }
        const chats = await tx.conversation.findMany({
          where: { sessionId, contact: { isGroup: false } },
          include: includeChat(sessionId),
        });
        for (const chat of chats) {
          const placements = { ...positions(chat.opportunity?.placements) };
          for (const link of chat.contact.labels) placements[membershipKey(link.labelId)] = 1;
          if (chat.contact.labels.length)
            await tx.crmOpportunity.upsert({
              where: { conversationId: chat.id },
              create: { conversationId: chat.id, placements },
              update: { placements },
            });
        }
        await tx.operationRecord.create({
          data: { id: marker, kind: 'CRM_STAGE_MIGRATION', data: json({ sessionId, version: 1 }) },
        });
      },
      { timeout: 30_000 },
    );
  }

  private async stages(sessionId: string) {
    const records = await this.db.operationRecord.findMany({ where: { kind: stageKind(sessionId) } });
    return records
      .map((row) => stageSchema.parse(row.data))
      .filter((stage) => !stage.isDeleted)
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  }

  async board(sessionId: string, raw: unknown) {
    await this.whatsapp.snapshot(sessionId);
    await this.ensureStages(sessionId);
    const query = boardQuery.parse(raw);
    const where: Prisma.ConversationWhereInput = {
      sessionId,
      contact: {
        isGroup: false,
        ...(query.search
          ? { OR: [{ name: { contains: query.search } }, { phoneNumber: { contains: query.search } }] }
          : {}),
      },
      ...(query.status === 'ALL'
        ? {}
        : query.status === 'OPEN'
          ? { OR: [{ opportunity: null }, { opportunity: { status: 'OPEN' } }] }
          : { opportunity: { status: query.status } }),
    };
    const [labels, chats, total, jobs] = await Promise.all([
      this.stages(sessionId),
      this.db.conversation.findMany({
        where,
        include: includeChat(sessionId),
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'asc' }],
        take: query.limit,
      }),
      this.db.conversation.count({ where }),
      this.pendingJobs(sessionId),
    ]);
    const cards = chats.map((chat) => ({
      conversationId: chat.id,
      contact: {
        id: chat.contact.id,
        name: chat.contact.name,
        phoneNumber: chat.contact.phoneNumber,
        profilePicture: chat.contact.profilePicture,
        labels: chat.contact.labels.map(({ labelId, label }) => ({ labelId, label })),
      },
      title: chat.opportunity?.title || '',
      valueInCents: chat.opportunity?.valueInCents ?? 0,
      status: chat.opportunity?.status ?? 'OPEN',
      version: chat.opportunity?.version ?? 0,
      unreadCount: chat.unreadCount,
      attendanceStatus: chat.status,
      lastMessageAt: chat.lastMessageAt,
      sync: jobs.some((job) => job.contactId === chat.contactId && job.status === 'FAILED')
        ? 'FAILED'
        : jobs.some((job) => job.contactId === chat.contactId)
          ? 'PENDING'
          : 'SYNCED',
    }));
    const columns = [
      {
        id: 'unlabelled',
        labelId: null as string | null,
        name: 'Sem etapa',
        color: '#9294a4',
        description: 'Negociações sem etapa definida.',
        whatsappId: null as string | null,
      },
      ...labels.map((label) => ({
        id: label.id,
        labelId: label.id,
        name: label.name,
        color: label.color,
        description: label.description,
        whatsappId: null,
      })),
    ].map((column) => {
      const members = chats
        .filter((chat) => belongs(chat, column.labelId))
        .sort((a, b) => sortCards(a, b, column.labelId));
      return {
        ...column,
        conversationIds: members.map((chat) => chat.id),
        totalValueInCents: members.reduce((sum, chat) => sum + (chat.opportunity?.valueInCents ?? 0), 0),
      };
    });
    return {
      cards,
      columns,
      total,
      loaded: chats.length,
      limit: query.limit,
      pendingSync: jobs.filter((job) => job.status !== 'FAILED').length,
      failedSync: jobs.filter((job) => job.status === 'FAILED').length,
    };
  }

  private async pendingJobs(sessionId: string) {
    const jobs = await this.db.scheduledJob.findMany({
      where: {
        type: { in: ['WHATSAPP_SET_LABEL', 'WHATSAPP_ADD_LABEL'] },
        status: { in: ['QUEUED', 'RUNNING', 'FAILED'] },
      },
      select: { id: true, payload: true, status: true },
    });
    return jobs.flatMap((job) => {
      const payload = job.payload as unknown as LabelChange;
      return payload.sessionId === sessionId ? [{ ...payload, id: job.id, status: job.status }] : [];
    });
  }

  async move(sessionId: string, raw: unknown) {
    const body = moveInput.parse(raw);
    await this.whatsapp.snapshot(sessionId);
    await this.ensureStages(sessionId);
    return this.mutations.run(async () => {
      await this.whatsapp.snapshot(sessionId);
      await this.db.$transaction(
        async (tx) => {
          const chat = await tx.conversation.findFirst({
            where: { id: body.conversationId, sessionId, contact: { isGroup: false } },
            include: includeChat(sessionId),
          });
          if (!chat) throw new AppError(404, 'Contato não encontrado nesta conexão.');
          if ((chat.opportunity?.version ?? 0) !== body.version || !belongs(chat, body.sourceLabelId))
            throw new AppError(
              409,
              'O cartão mudou em outra atualização. Atualize o quadro e tente novamente.',
            );
          const target = body.targetLabelId
            ? await tx.operationRecord.findUnique({
                where: { id: stageKey(sessionId, body.targetLabelId) },
              })
            : null;
          if (body.targetLabelId && (!target || stageSchema.parse(target.data).isDeleted))
            throw new AppError(422, 'Etapa indisponível nesta conexão.');
          const membership = { ...positions(chat.opportunity?.placements) };
          if (body.sourceLabelId) delete membership[membershipKey(body.sourceLabelId)];
          if (body.targetLabelId) membership[membershipKey(body.targetLabelId)] = 1;
          else
            for (const key of Object.keys(membership)) if (key.startsWith('stage:')) delete membership[key];
          const candidates = await tx.conversation.findMany({
            where: { sessionId, id: { not: chat.id }, contact: { isGroup: false } },
            include: includeChat(sessionId),
          });
          const ordered = candidates
            .filter((item) => belongs(item, body.targetLabelId))
            .sort((a, b) => sortCards(a, b, body.targetLabelId));
          const index = body.beforeConversationId
            ? ordered.findIndex((item) => item.id === body.beforeConversationId)
            : ordered.length;
          if (index < 0) throw new AppError(409, 'A posição de destino mudou. Atualize o quadro.');
          let before = index ? rank(ordered[index - 1]!, body.targetLabelId) : null;
          let after = ordered[index] ? rank(ordered[index]!, body.targetLabelId) : null;
          if (before !== null && after !== null && after - before < 0.01) {
            for (const [position, item] of ordered.entries()) {
              const placements = {
                ...positions(item.opportunity?.placements),
                [columnKey(body.targetLabelId)]: position * 1024,
              };
              await tx.crmOpportunity.upsert({
                where: { conversationId: item.id },
                create: { conversationId: item.id, placements },
                update: { placements },
              });
            }
            before = index ? (index - 1) * 1024 : null;
            after = index < ordered.length ? index * 1024 : null;
          }
          const position =
            before === null ? (after ?? 1024) - 1024 : after === null ? before + 1024 : (before + after) / 2;
          const placements = {
            ...membership,
            [columnKey(body.targetLabelId)]: position,
          };
          await tx.crmOpportunity.upsert({
            where: { conversationId: chat.id },
            create: { conversationId: chat.id, placements, version: 1 },
            update: { placements, version: { increment: 1 } },
          });
        },
        { timeout: 30_000 },
      );
      this.whatsapp.notify(sessionId, 'labels');
      return { saved: true };
    });
  }

  async saveOpportunity(sessionId: string, conversationId: string, raw: unknown) {
    const input = opportunityInput.parse(raw);
    return this.mutations.run(async () => {
      const result = await this.db.$transaction(async (tx) => {
        const chat = await tx.conversation.findFirst({
          where: { id: conversationId, sessionId, contact: { isGroup: false } },
          include: { opportunity: true, contact: true },
        });
        if (!chat) throw new AppError(404, 'Negociação não encontrada nesta conexão.');
        const previous = chat.opportunity;
        if ((previous?.version ?? 0) !== input.version)
          throw new AppError(409, 'A negociação foi atualizada. Abra o cartão novamente.');
        const data = {
          title: input.title,
          valueInCents: input.valueInCents,
          status: input.status,
          wonAt: input.status === 'WON' ? (previous?.status === 'WON' ? previous.wonAt : new Date()) : null,
          lostAt:
            input.status === 'LOST' ? (previous?.status === 'LOST' ? previous.lostAt : new Date()) : null,
        };
        const opportunity = await tx.crmOpportunity.upsert({
          where: { conversationId },
          create: { conversationId, ...data, version: 1 },
          update: { ...data, version: { increment: 1 } },
        });
        const metadata = {
          ...(chat.contact.metadata as Record<string, unknown>),
          dealValue: `${(input.valueInCents / 100).toFixed(2).replace('.', ',')}`,
        };
        await tx.contact.update({ where: { id: chat.contactId }, data: { metadata: json(metadata) } });
        return opportunity;
      });
      this.whatsapp.notify(sessionId, 'chats');
      return result;
    });
  }

  // /labels is retained as a CRM API alias for stages, independent of contact labels.
  async label(sessionId: string, stageId: string | null, raw: unknown) {
    const input = labelInput.parse(raw);
    await this.whatsapp.snapshot(sessionId);
    await this.ensureStages(sessionId);
    const stages = await this.stages(sessionId);
    const existing = stages.find((stage) => stage.id === stageId);
    if (stageId && !existing) throw new AppError(404, 'Etapa não encontrada.');
    const stage = {
      ...input,
      id: stageId ?? `local:${randomUUID()}`,
      position: existing?.position ?? Math.max(0, ...stages.map((item) => item.position)) + 1,
      isDeleted: false,
    };
    await this.db.operationRecord.upsert({
      where: { id: stageKey(sessionId, stage.id) },
      create: { id: stageKey(sessionId, stage.id), kind: stageKind(sessionId), data: json(stage) },
      update: { data: json(stage) },
    });
    this.whatsapp.notify(sessionId, 'labels');
    return stage;
  }

  async deleteLabel(sessionId: string, stageId: string) {
    await this.whatsapp.snapshot(sessionId);
    await this.ensureStages(sessionId);
    await this.db.$transaction(async (tx) => {
      const stage = await tx.operationRecord.findUnique({ where: { id: stageKey(sessionId, stageId) } });
      if (!stage || stageSchema.parse(stage.data).isDeleted) throw new AppError(404, 'Etapa não encontrada.');
      const chats = await tx.conversation.findMany({ where: { sessionId }, include: includeChat(sessionId) });
      if (chats.some((chat) => belongs(chat, stageId)))
        throw new AppError(409, 'Mova os cartões antes de excluir a etapa.');
      await tx.operationRecord.update({
        where: { id: stage.id },
        data: { data: json({ ...stageSchema.parse(stage.data), isDeleted: true }) },
      });
    });
    this.whatsapp.notify(sessionId, 'labels');
    return { deleted: true };
  }

  async retrySync(sessionId: string) {
    const jobs = (await this.pendingJobs(sessionId)).filter((job) => job.status === 'FAILED');
    if (jobs.length)
      await this.db.scheduledJob.updateMany({
        where: { id: { in: jobs.map((job) => job.id) }, status: 'FAILED' },
        data: { status: 'QUEUED', attempts: 0, runAt: new Date(), error: null },
      });
    this.whatsapp.notify(sessionId, 'labels');
    return { queued: jobs.length };
  }

  async metrics(sessionId: string, days: number) {
    await this.whatsapp.snapshot(sessionId);
    const now = new Date();
    const since = new Date(now);
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - days + 1);
    const chat: Prisma.ConversationWhereInput = { sessionId, contact: { isGroup: false } };
    const opportunity: Prisma.CrmOpportunityWhereInput = { conversation: chat };
    const [contacts, attendances, unread, active, openValue, won, lost, inbound, outbound] =
      await Promise.all([
        this.db.conversation.count({ where: chat }),
        this.db.conversation.count({ where: { ...chat, status: 'OPEN' } }),
        this.db.conversation.count({ where: { ...chat, unreadCount: { gt: 0 } } }),
        this.db.conversation.count({ where: { ...chat, lastMessageAt: { gte: since } } }),
        this.db.crmOpportunity.aggregate({
          where: { ...opportunity, status: 'OPEN' },
          _sum: { valueInCents: true },
        }),
        this.db.crmOpportunity.aggregate({
          where: { ...opportunity, status: 'WON', wonAt: { gte: since } },
          _count: true,
          _sum: { valueInCents: true },
        }),
        this.db.crmOpportunity.count({ where: { ...opportunity, status: 'LOST', lostAt: { gte: since } } }),
        this.db.chatMessage.count({
          where: { conversation: chat, direction: 'INBOUND', sentAt: { gte: since } },
        }),
        this.db.chatMessage.count({
          where: {
            conversation: chat,
            direction: 'OUTBOUND',
            status: { in: ['SENT', 'DELIVERED', 'READ'] },
            sentAt: { gte: since },
          },
        }),
      ]);
    const activity = await Promise.all(
      Array.from({ length: 7 }, async (_, index) => {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - 6 + index);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        const where = { conversation: chat, sentAt: { gte: start, lt: end } };
        const [received, sent] = await Promise.all([
          this.db.chatMessage.count({ where: { ...where, direction: 'INBOUND' } }),
          this.db.chatMessage.count({
            where: { ...where, direction: 'OUTBOUND', status: { in: ['SENT', 'DELIVERED', 'READ'] } },
          }),
        ]);
        return { date: start.toISOString(), received, sent };
      }),
    );
    return {
      days,
      since,
      contacts,
      attendances,
      unread,
      active,
      openValueInCents: openValue._sum.valueInCents ?? 0,
      wonValueInCents: won._sum.valueInCents ?? 0,
      won: won._count,
      lost,
      conversion: won._count + lost ? (won._count / (won._count + lost)) * 100 : 0,
      inbound,
      outbound,
      activity,
    };
  }
}
