import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../../shared/errors.js';
import type { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { json } from '../backups/validation.js';
import {
  answerMatches,
  initialGraph,
  normalizeGraph,
  publishGraph,
  triggerMatches,
  type PublishedGraph,
} from './flow.graph.js';
import { automationLock } from './flow.lock.js';

const nodeTypes = {
  start: 'START',
  text: 'TEXT',
  audio: 'AUDIO',
  media: 'MEDIA',
  document: 'MEDIA',
  delay: 'DELAY',
  'user-input': 'USER_INPUT',
} as const;
const revisionSchema = z.number().int().nonnegative();
export class FlowService {
  constructor(
    private readonly db: PrismaClient,
    private readonly whatsapp: WhatsappService,
  ) {}
  private async owned(
    tx: Prisma.TransactionClient | PrismaClient,
    sessionId: string,
    id: string,
    revision?: number,
  ) {
    const flow = await tx.flow.findFirst({ where: { id, OR: [{ sessionId }, { sessionId: null }] } });
    if (!flow) throw new AppError(404, 'Fluxo não encontrado nesta conexão.');
    if (revision !== undefined && flow.revision !== revision)
      throw new AppError(409, 'Este fluxo foi alterado em outra janela. Reabra-o antes de salvar.');
    return flow;
  }
  async list(sessionId: string, archived = false) {
    await this.whatsapp.snapshot(sessionId);
    const flows = await this.db.flow.findMany({
      where: { archived, OR: [{ sessionId }, { sessionId: null }] },
      orderBy: { updatedAt: 'desc' },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          select: {
            id: true,
            version: true,
            status: true,
            publishedAt: true,
            _count: { select: { nodes: true } },
          },
        },
      },
    });
    return {
      items: flows.map((flow) => ({
        id: flow.id,
        name: flow.name,
        enabled: Boolean(flow.enabled && flow.enabledAt && flow.sessionId),
        revision: flow.revision,
        imported: !flow.sessionId,
        archived: flow.archived,
        updatedAt: flow.updatedAt,
        latest: flow.versions[0] ?? null,
        published: flow.versions.find((version) => version.status === 'PUBLISHED') ?? null,
      })),
    };
  }
  async get(sessionId: string, id: string) {
    const flow = await this.owned(this.db, sessionId, id);
    const versions = await this.db.flowVersion.findMany({
      where: { flowId: id },
      orderBy: { version: 'desc' },
      take: 100,
    });
    const latest = versions[0];
    return {
      id: flow.id,
      name: flow.name,
      enabled: Boolean(flow.enabled && flow.enabledAt && flow.sessionId),
      revision: flow.revision,
      archived: flow.archived,
      imported: !flow.sessionId,
      graph: latest ? normalizeGraph(latest.graph) : initialGraph(),
      versions: versions.map(({ id, version, status, publishedAt, createdAt }) => ({
        id,
        version,
        status,
        publishedAt,
        createdAt,
      })),
      publishedVersion: versions.find((item) => item.status === 'PUBLISHED')?.version ?? null,
    };
  }
  async create(sessionId: string, raw: unknown) {
    const { name } = z.object({ name: z.string().trim().min(1).max(100) }).parse(raw);
    await this.whatsapp.snapshot(sessionId);
    const id = `flow:${randomUUID()}`;
    await this.db.flow.create({
      data: {
        id,
        sessionId,
        name,
        versions: { create: { version: 1, status: 'DRAFT', graph: json(initialGraph()) } },
      },
    });
    return this.get(sessionId, id);
  }
  private async version(tx: Prisma.TransactionClient, flowId: string, graph: unknown, published: boolean) {
    const last = await tx.flowVersion.aggregate({ where: { flowId }, _max: { version: true } });
    const created = await tx.flowVersion.create({
      data: {
        flowId,
        version: (last._max.version ?? 0) + 1,
        status: published ? 'PUBLISHED' : 'DRAFT',
        graph: json(graph),
        publishedAt: published ? new Date() : null,
      },
    });
    if (published) {
      const normalized = normalizeGraph(graph);
      for (const node of normalized.nodes) {
        await tx.flowNode.create({
          data: {
            versionId: created.id,
            sourceId: node.id,
            type: nodeTypes[node.type],
            x: node.position.x,
            y: node.position.y,
            assetId: node.data.itemId || null,
            simulationDelayMs: node.data.simulationDelay,
            delayInMs: node.data.delayInMs,
            expirationTimeoutMs: node.data.expirationTimeoutInMs ?? null,
            config: json(node.data),
          },
        });
        if (node.data.followUpData?.itemId)
          await tx.flowNode.create({
            data: {
              versionId: created.id,
              sourceId: `__followup__${node.id}`,
              type: 'TEXT',
              assetId: node.data.followUpData.itemId,
              config: json(node.data.followUpData),
            },
          });
      }
    }
    return created;
  }
  async save(sessionId: string, id: string, raw: unknown) {
    const body = z
      .object({ name: z.string().trim().min(1).max(100), revision: revisionSchema, graph: z.unknown() })
      .parse(raw);
    const graph = normalizeGraph(body.graph);
    await this.db.$transaction(
      async (tx) => {
        const flow = await this.owned(tx, sessionId, id, body.revision);
        if (flow.archived) throw new AppError(409, 'Restaure o fluxo antes de editar.');
        await tx.flow.update({
          where: { id },
          data: {
            name: body.name,
            sessionId,
            revision: { increment: 1 },
            ...(!flow.sessionId ? { enabled: false, enabledAt: null } : {}),
          },
        });
        await this.version(tx, id, graph, false);
      },
      { timeout: 30_000 },
    );
    this.whatsapp.notify(sessionId, 'messages');
    return this.get(sessionId, id);
  }
  async publish(sessionId: string, id: string, raw: unknown) {
    const { revision } = z.object({ revision: revisionSchema }).parse(raw);
    await this.db.$transaction(
      async (tx) => {
        const flow = await this.owned(tx, sessionId, id, revision);
        if (flow.archived) throw new AppError(409, 'Restaure o fluxo antes de publicar.');
        const latest = await tx.flowVersion.findFirst({
          where: { flowId: id },
          orderBy: { version: 'desc' },
        });
        if (!latest) throw new AppError(422, 'Salve um rascunho antes de publicar.');
        const graph = await publishGraph(tx, latest.graph);
        const start = graph.nodes.find((node) => node.type === 'start')!;
        const ids = [
          ...new Set(
            [start.data.startLabelId, ...start.data.allowedLabelIds, ...start.data.excludedLabelIds].filter(
              (value): value is string => Boolean(value),
            ),
          ),
        ];
        if (
          (await tx.label.count({
            where: { id: { in: ids }, isDeleted: false, OR: [{ sessionId }, { sessionId: null }] },
          })) !== ids.length
        )
          throw new AppError(422, 'O início contém uma etiqueta indisponível nesta conexão.');
        await this.version(tx, id, graph, true);
        await tx.flow.update({
          where: { id },
          data: {
            sessionId,
            revision: { increment: 1 },
            ...(!flow.sessionId ? { enabled: false, enabledAt: null } : {}),
          },
        });
      },
      { timeout: 30_000 },
    );
    this.whatsapp.notify(sessionId, 'messages');
    return this.get(sessionId, id);
  }
  async configure(sessionId: string, id: string, raw: unknown) {
    const body = z
      .object({ revision: revisionSchema, enabled: z.boolean().optional(), archived: z.boolean().optional() })
      .parse(raw);
    await automationLock.run(() =>
      this.db.$transaction(
        async (tx) => {
          const flow = await this.owned(tx, sessionId, id, body.revision);
          const enabled = body.archived === true ? false : (body.enabled ?? false);
          if (enabled) {
            if (flow.archived && body.archived !== false)
              throw new AppError(409, 'Restaure o fluxo antes de ativar.');
            const published = await tx.flowVersion.findFirst({
              where: { flowId: id, status: 'PUBLISHED' },
              orderBy: { version: 'desc' },
            });
            if (!published || (published.graph as { schemaVersion?: number }).schemaVersion !== 1)
              throw new AppError(422, 'Publique o fluxo neste editor antes de ativá-lo.');
          }
          await tx.flow.update({
            where: { id },
            data: {
              sessionId,
              enabled,
              enabledAt: enabled ? new Date() : null,
              archived: body.archived ?? flow.archived,
              revision: { increment: 1 },
            },
          });
          if (!enabled)
            await tx.flowExecution.updateMany({
              where: { version: { flowId: id }, status: { in: ['QUEUED', 'RUNNING', 'WAITING_INPUT'] } },
              data: { status: 'CANCELLED', nextRunAt: null, inputExpiresAt: null },
            });
        },
        { timeout: 30_000 },
      ),
    );
    this.whatsapp.notify(sessionId, 'messages');
    return this.get(sessionId, id);
  }
  async runs(sessionId: string, conversationId?: string, flowId?: string) {
    const rows = await this.db.flowExecution.findMany({
      where: {
        conversation: { sessionId },
        ...(conversationId ? { conversationId } : {}),
        ...(flowId ? { version: { flowId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        conversationId: true,
        status: true,
        currentNodeId: true,
        nextRunAt: true,
        inputExpiresAt: true,
        error: true,
        createdAt: true,
        updatedAt: true,
        contact: { select: { name: true } },
        version: { select: { version: true, flow: { select: { id: true, name: true } } } },
      },
    });
    return { items: rows };
  }
  async simulate(sessionId: string, id: string, raw: unknown) {
    await this.owned(this.db, sessionId, id);
    const input = z
      .object({
        graph: z.unknown(),
        text: z.string().max(1000),
        replies: z.array(z.string().max(2000)).max(30).default([]),
        expire: z.boolean().default(false),
        isGroup: z.boolean().default(false),
        isSavedContact: z.boolean().default(false),
        labelIds: z.array(z.string().max(200)).max(100).default([]),
        at: z.string().datetime().optional(),
      })
      .parse(raw);
    const graph = await publishGraph(this.db, input.graph);
    const start = graph.nodes.find((node) => node.type === 'start')!;
    const matches =
      triggerMatches(
        start.data.triggerMode === 'manual' ? { ...start.data, triggerMode: 'any' } : start.data,
        input.text,
        input,
        input.at ? new Date(input.at) : new Date(),
      ) &&
      (!start.data.allowedLabelIds.length ||
        start.data.allowedLabelIds.some((id) => input.labelIds.includes(id))) &&
      !start.data.excludedLabelIds.some((id) => input.labelIds.includes(id));
    const trace: { nodeId: string; title: string; action: string; text?: string }[] = [
      {
        nodeId: start.id,
        title: 'Início',
        action: matches
          ? 'Gatilho compatível'
          : 'Gatilho não corresponde à mensagem, ao contato ou ao horário',
      },
    ];
    if (!matches) return { matches, trace, sends: 0, simulated: true };
    const queue = [...start.data.nextNodeIds];
    const visited = new Set<string>();
    const replies = [...input.replies];
    let sends = 0;
    while (queue.length && trace.length < 250) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const node = graph.nodes.find((node) => node.id === id)!;
      let next = node.data.nextNodeIds;
      if (['text', 'audio', 'media', 'document'].includes(node.type)) {
        const asset = graph.assetSnapshots[node.data.itemId!]!;
        sends++;
        trace.push({
          nodeId: id,
          title: node.data.title || asset.name,
          action: `Enviaria ${node.type === 'text' ? 'texto' : node.type === 'audio' ? 'áudio' : 'mídia'} após ${node.data.simulationDelay / 1000}s`,
          text: asset.text?.replaceAll('#nome', 'Contato de teste') ?? asset.caption,
        });
      } else if (node.type === 'delay')
        trace.push({
          nodeId: id,
          title: node.data.title || 'Espera',
          action: `Aguardaria ${node.data.delayInMs / 1000}s`,
        });
      else if (node.type === 'user-input') {
        const answer = replies.shift();
        if (answer !== undefined) {
          const valid = answerMatches(node.data, answer);
          trace.push({
            nodeId: id,
            title: node.data.title || 'Resposta',
            action: valid ? 'Resposta compatível' : 'Resposta diferente',
            text: answer,
          });
          next = valid
            ? node.data.nextNodeIds
            : node.data.nextNodeIdOnDifferentAnswer
              ? [node.data.nextNodeIdOnDifferentAnswer]
              : [];
        } else if (
          input.expire &&
          (node.data.expirationTimeoutInMs || node.data.followUpData?.expirationTimeoutInMs)
        ) {
          trace.push({
            nodeId: id,
            title: node.data.title || 'Resposta',
            action: 'Tempo de resposta esgotado',
          });
          const follow = node.data.followUpData?.enabled !== false ? node.data.followUpData : undefined;
          if (follow?.itemId) {
            const asset = graph.assetSnapshots[follow.itemId]!;
            sends++;
            trace.push({
              nodeId: id,
              title: 'Follow-up',
              action: `Enviaria ${asset.name}`,
              text: asset.text?.replaceAll('#nome', 'Contato de teste') ?? asset.caption,
            });
          }
          const target = node.data.nextNodeIdOnExpiration ?? follow?.nextNodeIdOnExpiration;
          next = target ? [target] : [];
        } else {
          trace.push({
            nodeId: id,
            title: node.data.title || 'Resposta',
            action: 'Aguardaria uma nova resposta do cliente',
          });
          break;
        }
      }
      queue.unshift(...next);
    }
    return { matches, trace, sends, simulated: true };
  }
}
