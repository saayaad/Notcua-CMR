import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../../shared/errors.js';
import { sendSchema } from '../attendance/messaging.service.js';

const ident = z.string().min(1).max(160);
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const ms = z.number().int().min(0).max(2_147_483_647);
export const flowNodeData = z.object({
  title: z.string().max(100).optional(),
  itemId: z.string().max(200).optional(),
  nextNodeIds: z.array(ident).max(20).default([]),
  triggerMode: z.enum(['keyword', 'any', 'first', 'first-day', 'manual']).default('keyword'),
  startLabelId: z.string().max(200).optional(),
  allowedLabelIds: z.array(z.string().max(200)).max(100).default([]),
  excludedLabelIds: z.array(z.string().max(200)).max(100).default([]),
  simulationDelay: ms.default(1000),
  delayInMs: ms.default(1000),
  keywordRules: z
    .array(
      z.object({
        rule: z.enum(['equals', 'contains', 'starts', 'not-contains']),
        keyword: z.string().trim().min(1).max(100),
      }),
    )
    .max(30)
    .default([]),
  isCaseSensitive: z.boolean().default(false),
  sendToContacts: z.boolean().default(true),
  sendToGroups: z.boolean().default(false),
  cooldownMs: ms.default(60_000),
  schedule: z
    .object({ days: z.array(z.number().int().min(0).max(6)).max(7), minTime: time, maxTime: time })
    .optional(),
  compareRule: z.enum(['anything', 'contains']).default('anything'),
  expectedMessages: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
  expirationTimeoutInMs: ms.optional(),
  nextNodeIdOnExpiration: ident.optional(),
  nextNodeIdOnDifferentAnswer: ident.optional(),
  followUpData: z
    .object({
      enabled: z.boolean().default(true),
      itemId: z.string().max(200).optional(),
      simulationDelay: ms.default(1000),
      expirationTimeoutInMs: ms.optional(),
      nextNodeIdOnExpiration: ident.optional(),
    })
    .optional(),
});
export const graphSchema = z.object({
  nodes: z
    .array(
      z.object({
        id: ident.refine((id) => !id.startsWith('__flow__'), 'ID de nó reservado.'),
        type: z.enum(['start', 'text', 'audio', 'media', 'document', 'delay', 'user-input']),
        position: z.object({ x: z.number().finite(), y: z.number().finite() }),
        data: flowNodeData,
      }),
    )
    .max(200),
});
export type FlowGraph = z.infer<typeof graphSchema>;
export type FlowGraphNode = FlowGraph['nodes'][number];
export type FlowData = z.infer<typeof flowNodeData>;
export type AssetSnapshot = {
  kind: 'text' | 'audio' | 'image' | 'video' | 'document';
  text?: string;
  caption?: string;
  fileId?: string;
  isPtt: boolean;
  isPtv: boolean;
  asViewOnce: boolean;
  name: string;
};
export interface PublishedGraph extends FlowGraph {
  schemaVersion: 1;
  assetSnapshots: Record<string, AssetSnapshot>;
}

export function normalizeGraph(raw: unknown): FlowGraph {
  const value = z
    .object({
      nodes: z.array(z.record(z.string(), z.unknown())).max(200),
      edges: z
        .array(z.object({ source: ident, target: ident, sourceHandle: z.string().nullable().optional() }))
        .max(1000)
        .optional(),
    })
    .parse(raw);
  return graphSchema.parse({
    nodes: value.nodes.map((node) => {
      const data = {
        ...node,
        ...((node.config as object) ?? {}),
        ...((node.data as object) ?? {}),
      } as Record<string, unknown>;
      const edges = value.edges?.filter((edge) => edge.source === node.id) ?? [];
      if (!Array.isArray(data.nextNodeIds) || !data.nextNodeIds.length)
        data.nextNodeIds = edges
          .filter((edge) => !edge.sourceHandle || edge.sourceHandle === 'next')
          .map((edge) => edge.target);
      if (!data.nextNodeIdOnExpiration)
        data.nextNodeIdOnExpiration = edges.find((edge) => edge.sourceHandle === 'timeout')?.target;
      if (!data.nextNodeIdOnDifferentAnswer)
        data.nextNodeIdOnDifferentAnswer = edges.find((edge) => edge.sourceHandle === 'different')?.target;
      return { id: String(node.id ?? ''), type: node.type, position: node.position ?? { x: 0, y: 0 }, data };
    }),
  });
}

export function validateGraph(graph: FlowGraph) {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  if (nodes.size !== graph.nodes.length) throw new AppError(422, 'Há nós com o mesmo identificador.');
  const starts = graph.nodes.filter((node) => node.type === 'start');
  if (starts.length !== 1) throw new AppError(422, 'O fluxo precisa de exatamente um bloco Início.');
  if (starts[0]!.data.triggerMode === 'keyword' && !starts[0]!.data.keywordRules.length)
    throw new AppError(422, 'Configure pelo menos uma palavra-chave no bloco Início.');
  if (!starts[0]!.data.nextNodeIds.length) throw new AppError(422, 'Conecte o Início ao próximo bloco.');
  if (starts[0]!.data.schedule && !starts[0]!.data.schedule.days.length)
    throw new AppError(422, 'Escolha os dias de funcionamento do fluxo.');
  const targets = (node: FlowGraphNode) => [
    ...node.data.nextNodeIds,
    ...[
      node.data.nextNodeIdOnExpiration,
      node.data.nextNodeIdOnDifferentAnswer,
      node.data.followUpData?.nextNodeIdOnExpiration,
    ].filter((id): id is string => Boolean(id)),
  ];
  for (const node of graph.nodes) {
    if (['text', 'audio', 'media', 'document'].includes(node.type) && !node.data.itemId)
      throw new AppError(422, `Escolha um recurso para o bloco ${node.data.title || node.id}.`);
    if (
      node.type === 'user-input' &&
      node.data.compareRule === 'contains' &&
      !node.data.expectedMessages.length
    )
      throw new AppError(422, `Informe as respostas esperadas no bloco ${node.data.title || node.id}.`);
    const timeout = node.data.expirationTimeoutInMs ?? node.data.followUpData?.expirationTimeoutInMs;
    if (timeout !== undefined && timeout > 0 && timeout < 1000)
      throw new AppError(422, 'O tempo de resposta deve ser de pelo menos 1 segundo.');
    for (const target of targets(node))
      if (!nodes.has(target) || nodes.get(target)!.type === 'start')
        throw new AppError(422, `O bloco ${node.data.title || node.id} aponta para uma conexão inválida.`);
  }
  const visited = new Set<string>();
  const pending = new Set<string>();
  const visit = (id: string) => {
    if (pending.has(id))
      throw new AppError(422, 'O fluxo contém um ciclo. Remova a conexão que retorna a um bloco anterior.');
    if (visited.has(id)) return;
    pending.add(id);
    for (const target of targets(nodes.get(id)!)) visit(target);
    pending.delete(id);
    visited.add(id);
  };
  visit(starts[0]!.id);
  if (visited.size !== nodes.size)
    throw new AppError(422, 'Há blocos sem conexão com o Início. Conecte-os ou remova-os antes de publicar.');
}

export async function publishGraph(
  db: PrismaClient | Prisma.TransactionClient,
  raw: unknown,
): Promise<PublishedGraph> {
  const graph = normalizeGraph(raw);
  validateGraph(graph);
  const snapshots: Record<string, AssetSnapshot> = {};
  for (const node of graph.nodes) {
    const ids = [
      node.data.itemId,
      node.data.followUpData?.enabled !== false ? node.data.followUpData?.itemId : undefined,
    ].filter((id): id is string => Boolean(id));
    for (const id of ids) {
      const asset = await db.asset.findUnique({
        where: { id },
        include: { file: { select: { mimeType: true, data: true } } },
      });
      if (!asset)
        throw new AppError(422, `O recurso do bloco ${node.data.title || node.id} está indisponível.`);
      if (
        id === node.data.itemId &&
        ((node.type === 'text' && asset.kind !== 'MESSAGE') ||
          (node.type === 'audio' && asset.kind !== 'AUDIO') ||
          (node.type === 'media' && asset.kind !== 'MEDIA') ||
          (node.type === 'document' && asset.kind !== 'DOCUMENT'))
      )
        throw new AppError(422, `O tipo do recurso não corresponde ao bloco ${node.data.title || node.id}.`);
      if (asset.kind !== 'MESSAGE' && !asset.file)
        throw new AppError(422, `O recurso ${asset.name} está sem arquivo.`);
      if (
        asset.isPtt &&
        (!Buffer.from(asset.file?.data ?? [])
          .subarray(0, 4)
          .equals(Buffer.from('OggS')) ||
          !Buffer.from(asset.file?.data ?? []).includes(Buffer.from('OpusHead')))
      )
        throw new AppError(422, `Converta o áudio ${asset.name} para OGG/Opus antes de publicar.`);
      if (asset.isPtv && asset.file?.mimeType !== 'video/mp4')
        throw new AppError(422, `O vídeo circular ${asset.name} precisa ser MP4.`);
      const kind =
        asset.kind === 'MESSAGE'
          ? 'text'
          : asset.kind === 'AUDIO'
            ? 'audio'
            : asset.kind === 'DOCUMENT'
              ? 'document'
              : asset.file!.mimeType.startsWith('video/')
                ? 'video'
                : 'image';
      if (kind !== 'text' && kind !== 'document' && !asset.file!.mimeType.startsWith(`${kind}/`))
        throw new AppError(422, `O arquivo de ${asset.name} não corresponde ao formato de envio.`);
      const snapshot: AssetSnapshot = {
        kind,
        name: asset.name,
        text: asset.text ?? undefined,
        caption: asset.caption ?? undefined,
        fileId: asset.fileId ?? undefined,
        isPtt: asset.isPtt,
        isPtv: asset.isPtv,
        asViewOnce: asset.asViewOnce,
      };
      sendSchema.parse({ ...snapshot, requestId: 'publish' });
      snapshots[id] = snapshot;
    }
  }
  return { ...graph, schemaVersion: 1, assetSnapshots: snapshots };
}

export function scheduleMatches(data: FlowData, date: Date) {
  if (!data.schedule) return true;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: string) => parts.find((value) => value.type === type)?.value ?? '';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(part('weekday'));
  const clock = `${part('hour')}:${part('minute')}`;
  const { days, minTime, maxTime } = data.schedule;
  if (minTime === maxTime) return days.includes(day);
  if (minTime < maxTime) return days.includes(day) && clock >= minTime && clock < maxTime;
  return clock >= minTime ? days.includes(day) : clock < maxTime && days.includes((day + 6) % 7);
}
export function triggerMatches(
  data: FlowData,
  text: string,
  contact: { isGroup: boolean; isSavedContact: boolean },
  at: Date,
) {
  if (
    (contact.isGroup && !data.sendToGroups) ||
    (!contact.isGroup && contact.isSavedContact && !data.sendToContacts) ||
    !scheduleMatches(data, at)
  )
    return false;
  const normalize = (value: string) =>
    data.isCaseSensitive ? value.trim() : value.trim().toLocaleLowerCase('pt-BR');
  if (data.triggerMode === 'manual') return false;
  if (data.triggerMode !== 'keyword') return true;
  return data.keywordRules.some((rule) =>
    rule.rule === 'equals'
      ? normalize(text) === normalize(rule.keyword)
      : rule.rule === 'starts'
        ? normalize(text).startsWith(normalize(rule.keyword))
        : rule.rule === 'not-contains'
          ? !normalize(text).includes(normalize(rule.keyword))
          : normalize(text).includes(normalize(rule.keyword)),
  );
}
export const answerMatches = (data: FlowData, text: string | null) =>
  data.compareRule === 'anything' ||
  data.expectedMessages.some((answer) =>
    data.isCaseSensitive
      ? (text ?? '').includes(answer)
      : (text ?? '').toLocaleLowerCase('pt-BR').includes(answer.toLocaleLowerCase('pt-BR')),
  );
export function initialGraph(): FlowGraph {
  return {
    nodes: [
      {
        id: 'start',
        type: 'start',
        position: { x: 100, y: 140 },
        data: flowNodeData.parse({ title: 'Início', keywordRules: [{ rule: 'equals', keyword: 'oi' }] }),
      },
    ],
  };
}
