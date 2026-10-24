import type { FlowExecution, Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors.js';
import type { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { MessagingService } from '../attendance/messaging.service.js';
import {
  answerMatches,
  flowNodeData,
  normalizeGraph,
  triggerMatches,
  type FlowGraphNode,
  type PublishedGraph,
} from './flow.graph.js';
import { automationLock } from './flow.lock.js';
import { digest, json } from '../backups/validation.js';
import { labelAtStart } from './flow.labels.js';

const active = ['QUEUED', 'RUNNING', 'WAITING_INPUT'] as const;
interface RunContext {
  queue: string[];
  visited: string[];
  steps: number;
  waitingSince?: string;
  lastResponse?: string | null;
}
type LoadedRun = FlowExecution & {
  version: {
    graph: Prisma.JsonValue;
    flow: { enabled: boolean; archived: boolean; enabledAt: Date | null; sessionId: string | null };
  };
  conversation: { sessionId: string } | null;
};
export class FlowEngine {
  private stopped = false;
  private flushing = false;
  private timer?: ReturnType<typeof setTimeout>;
  private work: Promise<void> = Promise.resolve();
  private readonly presenceTimes = new Map<string, number>();
  constructor(
    private readonly db: PrismaClient,
    private readonly whatsapp: WhatsappService,
    private readonly messaging: MessagingService,
  ) {}
  async start() {
    await this.db.flowExecution.updateMany({
      where: { status: 'RUNNING' },
      data: {
        status: 'FAILED',
        error: 'Servidor interrompido durante uma etapa. Confira a conversa antes de iniciar outro fluxo.',
        nextRunAt: null,
      },
    });
    this.schedule();
  }
  private schedule() {
    if (!this.stopped)
      this.timer = setTimeout(() => {
        this.work = this.flush()
          .catch(() => undefined)
          .finally(() => this.schedule());
      }, 500).unref();
  }
  async stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.work;
  }
  private notify(sessionId: string) {
    this.whatsapp.notify(sessionId, 'messages');
  }
  private graph(run: LoadedRun): PublishedGraph {
    const value = run.version.graph as unknown as PublishedGraph;
    if (value.schemaVersion !== 1 || !value.assetSnapshots)
      throw new AppError(422, 'Esta versão importada precisa ser publicada no editor antes de executar.');
    return { ...normalizeGraph(value), schemaVersion: 1, assetSnapshots: value.assetSnapshots };
  }
  private node(graph: PublishedGraph, id: string): FlowGraphNode | undefined {
    if (!id.startsWith('__flow__')) return graph.nodes.find((node) => node.id === id);
    const original = graph.nodes.find((node) => `__flow__${node.id}` === id);
    const follow = original?.data.followUpData;
    if (!follow?.itemId || !graph.assetSnapshots[follow.itemId]) return undefined;
    const asset = graph.assetSnapshots[follow.itemId]!;
    return {
      id,
      type: asset.kind === 'text' ? 'text' : asset.kind === 'audio' ? 'audio' : 'media',
      position: { x: 0, y: 0 },
      data: flowNodeData.parse({ itemId: follow.itemId, simulationDelay: follow.simulationDelay }),
    };
  }
  private async next(
    run: LoadedRun,
    graph: PublishedGraph,
    context: RunContext,
    queue: string[],
    expected: 'RUNNING' | 'WAITING_INPUT' = 'RUNNING',
    event?: { messageId: string; outcome: string },
  ) {
    const pending = [...new Set(queue)].filter((id) => !context.visited.includes(id));
    const next = pending.shift();
    const node = next ? this.node(graph, next) : undefined;
    if (next && !node) throw new AppError(422, 'O fluxo aponta para um bloco indisponível.');
    const delay =
      node?.type === 'delay'
        ? node.data.delayInMs
        : node && ['text', 'audio', 'media', 'document'].includes(node.type)
          ? node.data.simulationDelay
          : 0;
    const changed = await this.db.$transaction(async (tx) => {
      const updated = await tx.flowExecution.updateMany({
        where: { id: run.id, status: expected },
        data: {
          currentNodeId: next ?? null,
          context: json({ ...context, queue: pending, waitingSince: undefined }),
          status: next ? 'QUEUED' : 'COMPLETED',
          nextRunAt: next ? new Date(Date.now() + delay) : null,
          inputExpiresAt: null,
          error: null,
          ...(event ? { lastInputMessageId: event.messageId } : {}),
        },
      });
      if (event)
        await tx.flowInboxEvent.update({
          where: { messageId: event.messageId },
          data: { processedAt: new Date(), outcome: event.outcome },
        });
      return updated;
    });
    if (changed.count && node && ['text', 'audio', 'media', 'document'].includes(node.type) && delay)
      await this.presence(run.id, run.conversation!.sessionId, run.conversationId!, node);
    if (run.conversation) this.notify(run.conversation.sessionId);
  }
  private async presence(runId: string, sessionId: string, conversationId: string, node: FlowGraphNode) {
    if (Date.now() - (this.presenceTimes.get(runId) ?? 0) < 8000) return;
    this.presenceTimes.set(runId, Date.now());
    if (this.presenceTimes.size > 1000) this.presenceTimes.clear();
    await this.messaging
      .presence(sessionId, conversationId, node.type === 'audio' ? 'recording' : 'composing')
      .catch(() => undefined);
  }
  private async consume(messageId: string) {
    return automationLock.run(async () => {
      const event = await this.db.flowInboxEvent.findUnique({ where: { messageId } });
      if (!event || event.processedAt) return;
      const message = await this.db.chatMessage.findUnique({
        where: { id: event.messageId },
        include: { conversation: { include: { contact: true } } },
      });
      const done = (outcome: string) =>
        this.db.flowInboxEvent.update({ where: { messageId }, data: { processedAt: new Date(), outcome } });
      if (!message || message.direction !== 'INBOUND') {
        await done('ignored');
        return;
      }
      const chat = message.conversation;
      let running = await this.db.flowExecution.findFirst({
        where: { conversationId: chat.id, status: { in: [...active] } },
        include: { version: { include: { flow: true } }, conversation: true },
        orderBy: { createdAt: 'asc' },
      });
      if (
        running?.status === 'QUEUED' &&
        running.nextRunAt &&
        running.nextRunAt <= event.receivedAt &&
        this.node(this.graph(running), running.currentNodeId ?? '')?.type === 'user-input'
      ) {
        const claim = await this.db.flowExecution.updateMany({
          where: { id: running.id, status: 'QUEUED' },
          data: { status: 'RUNNING' },
        });
        if (claim.count) await this.execute(running);
        running = await this.db.flowExecution.findUnique({
          where: { id: running.id },
          include: { version: { include: { flow: true } }, conversation: true },
        });
      }
      if (running) {
        if (running.status !== 'WAITING_INPUT') {
          await done('flow-busy');
          return;
        }
        if (
          !running.version.flow.enabled ||
          running.version.flow.archived ||
          !running.version.flow.enabledAt
        ) {
          await this.cancel(chat.sessionId, running.id);
          await done('flow-paused');
          return;
        }
        const context = running.context as unknown as RunContext;
        if (context.waitingSince && event.receivedAt < new Date(context.waitingSince)) {
          await done('before-wait');
          return;
        }
        if (running.inputExpiresAt && event.receivedAt > running.inputExpiresAt) {
          await done('late-answer');
          await this.expire(running);
          return;
        }
        const graph = this.graph(running);
        const node = graph.nodes.find((item) => item.id === running.currentNodeId);
        if (!node) throw new AppError(422, 'Bloco de espera indisponível.');
        const matched = answerMatches(node.data, message.text);
        const targets = matched
          ? node.data.nextNodeIds
          : node.data.nextNodeIdOnDifferentAnswer
            ? [node.data.nextNodeIdOnDifferentAnswer]
            : [];
        await this.next(
          running,
          graph,
          { ...context, lastResponse: message.text },
          [...targets, ...context.queue],
          'WAITING_INPUT',
          { messageId, outcome: matched ? 'answer-matched' : 'answer-different' },
        );
        return;
      }
      if (
        await this.db.sequenceRun.count({
          where: { conversationId: chat.id, status: { in: ['QUEUED', 'RUNNING'] } },
        })
      ) {
        await done('manual-sequence');
        return;
      }
      if (
        Date.now() - event.receivedAt.getTime() > 300_000 ||
        Math.abs(event.receivedAt.getTime() - message.sentAt.getTime()) > 300_000
      ) {
        await done('stale');
        return;
      }
      const flows = await this.db.flow.findMany({
        where: {
          sessionId: chat.sessionId,
          enabled: true,
          archived: false,
          enabledAt: { not: null, lte: event.receivedAt },
        },
        include: { versions: { where: { status: 'PUBLISHED' }, orderBy: { version: 'desc' }, take: 1 } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      for (const flow of flows) {
        const version = flow.versions[0];
        if (!version) continue;
        const graph = version.graph as unknown as PublishedGraph;
        if (graph.schemaVersion !== 1) continue;
        const start = normalizeGraph(graph).nodes.find((node) => node.type === 'start');
        if (!start || !triggerMatches(start.data, message.text ?? '', chat.contact, event.receivedAt))
          continue;
        if (
          start.data.triggerMode === 'first' &&
          (await this.db.chatMessage.count({
            where: {
              conversationId: chat.id,
              direction: 'INBOUND',
              id: { not: message.id },
              sentAt: { lte: message.sentAt },
            },
          }))
        )
          continue;
        if (start.data.triggerMode === 'first-day') {
          const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
            message.sentAt,
          );
          if (
            await this.db.chatMessage.count({
              where: {
                conversationId: chat.id,
                direction: 'INBOUND',
                id: { not: message.id },
                sentAt: { gte: new Date(`${day}T00:00:00-03:00`), lte: message.sentAt },
              },
            })
          )
            continue;
        }
        const links = await this.db.contactLabel.findMany({
          where: { contactId: chat.contactId },
          select: { labelId: true },
        });
        const linked = links.map((link) => link.labelId);
        if (
          (start.data.allowedLabelIds.length &&
            !start.data.allowedLabelIds.some((id) => linked.includes(id))) ||
          start.data.excludedLabelIds.some((id) => linked.includes(id))
        )
          continue;
        const previous = await this.db.flowExecution.findFirst({
          where: {
            conversationId: chat.id,
            version: { flowId: flow.id },
            createdAt: { gt: new Date(event.receivedAt.getTime() - start.data.cooldownMs) },
          },
        });
        if (previous) continue;
        const queue = [...start.data.nextNodeIds];
        const first = queue.shift();
        const node = graph.nodes.find((item) => item.id === first);
        if (!node) continue;
        const delay =
          node.type === 'delay'
            ? node.data.delayInMs
            : ['text', 'audio', 'media', 'document'].includes(node.type)
              ? node.data.simulationDelay
              : 0;
        const run = await this.db.$transaction(async (tx) => {
          const duplicate = await tx.flowExecution.findUnique({
            where: {
              conversationId_triggerMessageId: { conversationId: chat.id, triggerMessageId: message.id },
            },
          });
          if (duplicate) {
            await tx.flowInboxEvent.update({
              where: { messageId },
              data: { processedAt: new Date(), outcome: 'duplicate' },
            });
            return null;
          }
          await labelAtStart(tx, chat.sessionId, chat.contactId, start.data.startLabelId);
          const created = await tx.flowExecution.create({
            data: {
              versionId: version.id,
              contactId: chat.contactId,
              conversationId: chat.id,
              triggerMessageId: message.id,
              lastInputMessageId: message.id,
              currentNodeId: first,
              context: json({ queue, visited: [start.id], steps: 0 }),
              nextRunAt: new Date(Date.now() + delay),
            },
          });
          await tx.flowInboxEvent.update({
            where: { messageId },
            data: { processedAt: new Date(), outcome: 'triggered' },
          });
          return created;
        });
        if (run && delay && ['text', 'audio', 'media', 'document'].includes(node.type))
          await this.presence(run.id, chat.sessionId, chat.id, node);
        this.notify(chat.sessionId);
        return;
      }
      await done('no-trigger');
    });
  }

  private async expire(run: LoadedRun) {
    const graph = this.graph(run);
    const node = graph.nodes.find((item) => item.id === run.currentNodeId);
    if (!node) throw new AppError(422, 'Bloco de espera não encontrado.');
    const data = node.data;
    const follow = data.followUpData?.enabled !== false ? data.followUpData : undefined;
    const route = data.nextNodeIdOnExpiration ?? follow?.nextNodeIdOnExpiration;
    const queue = [
      ...(follow?.itemId ? [`__flow__${node.id}`] : []),
      ...(route ? [route] : []),
      ...(run.context as unknown as RunContext).queue,
    ];
    await this.next(run, graph, run.context as unknown as RunContext, queue, 'WAITING_INPUT');
  }
  private async execute(run: LoadedRun) {
    const sessionId = run.conversation!.sessionId;
    try {
      const graph = this.graph(run);
      const node = this.node(graph, run.currentNodeId ?? '');
      if (!node) throw new AppError(422, 'Bloco atual não encontrado.');
      const context = run.context as unknown as RunContext;
      if (context.steps >= 250) throw new AppError(422, 'Limite de etapas desta execução atingido.');
      const nextContext = {
        ...context,
        steps: context.steps + 1,
        visited: [...new Set([...context.visited, node.id])],
      };
      if (node.type === 'user-input') {
        const timeout = node.data.expirationTimeoutInMs ?? node.data.followUpData?.expirationTimeoutInMs;
        await this.db.flowExecution.updateMany({
          where: { id: run.id, status: 'RUNNING' },
          data: {
            status: 'WAITING_INPUT',
            context: json({ ...nextContext, waitingSince: (run.nextRunAt ?? new Date()).toISOString() }),
            nextRunAt: null,
            inputExpiresAt: timeout ? new Date((run.nextRunAt ?? new Date()).getTime() + timeout) : null,
          },
        });
        this.notify(sessionId);
        return;
      }
      if (['text', 'audio', 'media', 'document'].includes(node.type)) {
        const asset = graph.assetSnapshots[node.data.itemId ?? ''];
        if (!asset) throw new AppError(422, 'Recurso publicado não encontrado.');
        await this.messaging.send(sessionId, run.conversationId!, {
          ...asset,
          requestId: `flow:${run.id}:${digest(node.id).slice(0, 24)}`,
        });
      }
      await this.next(run, graph, nextContext, [...node.data.nextNodeIds, ...context.queue]);
    } catch (error) {
      await this.db.flowExecution.updateMany({
        where: { id: run.id, status: 'RUNNING' },
        data: {
          status: 'FAILED',
          nextRunAt: null,
          error:
            error instanceof AppError
              ? error.message
              : 'A etapa não foi confirmada. Confira a conversa antes de repetir o fluxo.',
        },
      });
      this.notify(sessionId);
    }
  }
  async flush() {
    if (this.stopped || this.flushing) return;
    this.flushing = true;
    try {
      const events = await this.db.flowInboxEvent.findMany({
        where: { processedAt: null },
        orderBy: [{ receivedAt: 'asc' }, { messageId: 'asc' }],
        take: 50,
      });
      for (const event of events) {
        try {
          await this.consume(event.messageId);
        } catch (error) {
          if (error instanceof AppError)
            await this.db.flowInboxEvent.update({
              where: { messageId: event.messageId },
              data: { processedAt: new Date(), outcome: error.message.slice(0, 200) },
            });
          else throw error;
        }
      }
      const runs = await this.db.flowExecution.findMany({
        where: {
          OR: [
            { status: 'QUEUED', nextRunAt: { lte: new Date(Date.now() + 30_000) } },
            { status: 'WAITING_INPUT', inputExpiresAt: { lte: new Date() } },
          ],
        },
        include: { version: { include: { flow: true } }, conversation: true },
        orderBy: { nextRunAt: 'asc' },
        take: 200,
      });
      for (const run of runs) {
        if (this.stopped) break;
        if (
          !run.conversation ||
          !run.version.flow.enabled ||
          run.version.flow.archived ||
          !run.version.flow.enabledAt ||
          run.version.flow.sessionId !== run.conversation.sessionId
        ) {
          await this.db.flowExecution.updateMany({
            where: { id: run.id, status: { in: [...active] } },
            data: { status: 'CANCELLED', nextRunAt: null, inputExpiresAt: null },
          });
          if (run.conversation) this.notify(run.conversation.sessionId);
          continue;
        }
        try {
          this.whatsapp.connectedSocket(run.conversation.sessionId);
        } catch {
          continue;
        }
        if (run.status === 'WAITING_INPUT') {
          if (run.inputExpiresAt && run.inputExpiresAt <= new Date())
            await automationLock.run(() => this.expire(run));
          continue;
        }
        if (run.nextRunAt && run.nextRunAt > new Date()) {
          const node = this.node(this.graph(run), run.currentNodeId ?? '');
          if (node && ['text', 'audio', 'media', 'document'].includes(node.type))
            await this.presence(run.id, run.conversation.sessionId, run.conversationId!, node);
          continue;
        }
        const claimed = await this.db.flowExecution.updateMany({
          where: { id: run.id, status: 'QUEUED' },
          data: { status: 'RUNNING' },
        });
        if (claimed.count) await this.execute(run);
      }
    } finally {
      this.flushing = false;
    }
  }
  async cancel(sessionId: string, id: string) {
    const run = await this.db.flowExecution.findFirst({ where: { id, conversation: { sessionId } } });
    if (!run) throw new AppError(404, 'Execução não encontrada nesta conexão.');
    await this.db.flowExecution.updateMany({
      where: { id, status: { in: [...active] } },
      data: { status: 'CANCELLED', nextRunAt: null, inputExpiresAt: null },
    });
    if (run.conversationId)
      await this.messaging.presence(sessionId, run.conversationId, 'paused').catch(() => undefined);
    this.notify(sessionId);
    return { cancelled: true };
  }

  async launch(sessionId: string, flowId: string, conversationId: string) {
    return automationLock.run(async () => {
      const chat = await this.db.conversation.findFirst({
        where: { id: conversationId, sessionId },
        include: { contact: true },
      });
      const flow = await this.db.flow.findFirst({
        where: { id: flowId, sessionId, enabled: true, archived: false, enabledAt: { not: null } },
        include: { versions: { where: { status: 'PUBLISHED' }, orderBy: { version: 'desc' }, take: 1 } },
      });
      const version = flow?.versions[0];
      if (!chat || !version)
        throw new AppError(422, 'Escolha uma conversa e um fluxo publicado e ativo nesta conexão.');
      if (
        (await this.db.flowExecution.count({ where: { conversationId, status: { in: [...active] } } })) ||
        (await this.db.sequenceRun.count({
          where: { conversationId, status: { in: ['QUEUED', 'RUNNING'] } },
        }))
      )
        throw new AppError(409, 'Esta conversa já tem uma automação em andamento.');
      const graph = version.graph as unknown as PublishedGraph;
      if (graph.schemaVersion !== 1) throw new AppError(422, 'Publique novamente este fluxo no editor.');
      const start = normalizeGraph(graph).nodes.find((node) => node.type === 'start')!;
      const queue = [...start.data.nextNodeIds];
      const first = queue.shift();
      const node = graph.nodes.find((item) => item.id === first);
      if (!node) throw new AppError(422, 'O início está desconectado.');
      if (
        (chat.contact.isGroup && !start.data.sendToGroups) ||
        (!chat.contact.isGroup && chat.contact.isSavedContact && !start.data.sendToContacts)
      )
        throw new AppError(422, 'As regras publicadas não permitem este tipo de contato.');
      const delay =
        node.type === 'delay'
          ? node.data.delayInMs
          : ['text', 'audio', 'media', 'document'].includes(node.type)
            ? node.data.simulationDelay
            : 0;
      const run = await this.db.$transaction(async (tx) => {
        await labelAtStart(tx, sessionId, chat.contactId, start.data.startLabelId);
        return tx.flowExecution.create({
          data: {
            versionId: version.id,
            contactId: chat.contactId,
            conversationId,
            currentNodeId: first,
            context: json({ queue, visited: [start.id], steps: 0 }),
            nextRunAt: new Date(Date.now() + delay),
          },
        });
      });
      this.notify(sessionId);
      return run;
    });
  }
}
