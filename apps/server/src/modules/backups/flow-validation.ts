import { z } from 'zod';
import { idSchema, recordSchema } from './validation.js';
import { AppError } from '../../shared/errors.js';

const ms = z.number().int().min(0).max(2_147_483_647).default(0);
const schedule = z
  .object({
    days: z.array(z.number().int().min(0).max(6)),
    minTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    maxTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  })
  .passthrough();
const config = z
  .object({
    itemId: idSchema.optional(),
    simulationDelay: ms,
    delayInMs: ms,
    expirationTimeoutInMs: ms.optional(),
    nextNodeIds: z.array(idSchema).default([]),
    nextNodeIdOnExpiration: idSchema.optional(),
    nextNodeIdOnDifferentAnswer: idSchema.optional(),
    compareRule: z.enum(['anything', 'contains']).optional(),
    expectedMessages: z.array(z.string()).optional(),
    keywordRules: z
      .array(
        z
          .object({
            rule: z.enum(['equals', 'contains', 'starts', 'not-contains']),
            keyword: z.string().min(1),
          })
          .passthrough(),
      )
      .optional(),
    isCaseSensitive: z.boolean().optional(),
    sendToContacts: z.boolean().optional(),
    sendToGroups: z.boolean().optional(),
    schedule: schedule.optional(),
    followUpData: recordSchema.optional(),
  })
  .passthrough();
const node = z
  .object({
    id: idSchema,
    type: z.enum(['start', 'text', 'audio', 'media', 'document', 'delay', 'user-input']),
    position: z.object({ x: z.number().finite(), y: z.number().finite() }).default({ x: 0, y: 0 }),
    data: recordSchema.optional(),
  })
  .passthrough()
  .transform((n) => ({ ...n, config: config.parse({ ...n, ...n.data }) }));
const graphSchema = z
  .object({
    nodes: z.array(node).min(1),
    edges: z.array(z.object({ source: idSchema, target: idSchema }).passthrough()).default([]),
  })
  .passthrough();
export const flowSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    enabled: z.boolean().default(false),
    draft: z.unknown().optional(),
    published: z.unknown().optional(),
    nodes: z.array(recordSchema).optional(),
  })
  .passthrough();

export function parseGraph(value: unknown, allowIncomplete = false) {
  const graph = graphSchema.parse(value);
  const ids = new Set(graph.nodes.map((n) => n.id));
  if (ids.size !== graph.nodes.length) throw new AppError(422, 'Fluxo contém IDs de nós duplicados.');
  if (graph.nodes.filter((n) => n.type === 'start').length !== 1) {
    throw new AppError(422, 'Cada versão do fluxo deve conter exatamente um nó start.');
  }
  const assertTarget = (id: string) => {
    if (!ids.has(id)) throw new AppError(422, `Fluxo referencia nó inexistente: ${id}`);
  };
  for (const n of graph.nodes) {
    for (const id of n.config.nextNodeIds) assertTarget(id);
    if (n.config.nextNodeIdOnExpiration) assertTarget(n.config.nextNodeIdOnExpiration);
    if (n.config.nextNodeIdOnDifferentAnswer) assertTarget(n.config.nextNodeIdOnDifferentAnswer);
    if (!allowIncomplete && ['text', 'audio', 'media', 'document'].includes(n.type) && !n.config.itemId) {
      throw new AppError(422, `Nó ${n.id} exige itemId.`);
    }
    if (n.type === 'user-input') {
      if (!n.config.compareRule) throw new AppError(422, `Nó ${n.id} exige compareRule.`);
      if (n.config.compareRule === 'contains' && !n.config.expectedMessages?.length) {
        throw new AppError(422, `Nó ${n.id} exige expectedMessages.`);
      }
    }
  }
  for (const edge of graph.edges) {
    assertTarget(edge.source);
    assertTarget(edge.target);
  }
  return graph;
}
