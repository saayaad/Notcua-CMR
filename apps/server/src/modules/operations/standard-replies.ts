import { createHash, randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../../shared/errors.js';
import { SerialQueue } from '../../shared/serial-queue.js';
import { record, putRecord } from './records.js';
import type { MessagingService } from '../attendance/messaging.service.js';
import type { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { setAiControl } from './ai-control.js';

export interface StandardReply {
  id: string;
  sessionId: string;
  question: string;
  variants: string[];
  text: string;
  assetIds: string[];
  category: string;
  active: boolean;
  archived: boolean;
  position: number;
  uses: number;
  updatedAt: string;
}
const stopWords = new Set(
  'a o as os e de da do das dos um uma para pra por em no na nos nas que qual quais quanto quantos quando meu minha seu sua voces voce eu ele ela isso esse essa porfavor favor bom boa dia tarde noite oi ola gostaria saber me pode poderia sera fica tem se ate com ao ne ja ai'.split(
    ' ',
  ),
);
const synonyms: Record<string, string> = {
  demora: 'prazo',
  demorar: 'prazo',
  tempo: 'prazo',
  levam: 'prazo',
  leva: 'prazo',
  dias: 'prazo',
  aplicativo: 'app',
  aplicativos: 'app',
  aplicacao: 'app',
  videos: 'video',
  finalizar: 'entrega',
  finalizado: 'entrega',
  finalizacao: 'entrega',
  pronto: 'entrega',
  pronta: 'entrega',
  concluir: 'entrega',
  entregar: 'entrega',
  custa: 'preco',
  custo: 'preco',
  valor: 'preco',
  valores: 'preco',
  pagamento: 'pagar',
  pagamentos: 'pagar',
};
export function questionTokens(value: string): string[] {
  return [
    ...new Set(
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/por\s+favor/g, 'porfavor')
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length > 1 && !stopWords.has(word))
        .map((word) => synonyms[word] ?? word),
    ),
  ];
}
export function questionSimilarity(left: string, right: string): number {
  const a = new Set(questionTokens(left));
  const b = new Set(questionTokens(right));
  if (!a.size || !b.size) return 0;
  const subjects = ['app', 'video', 'mascote'];
  const aSubjects = subjects.filter((word) => a.has(word));
  const bSubjects = subjects.filter((word) => b.has(word));
  if (aSubjects.length && bSubjects.length && !aSubjects.some((word) => bSubjects.includes(word))) return 0;
  const shared = [...a].filter((word) => b.has(word)).length;
  return shared < 2 ? 0 : (2 * shared) / (a.size + b.size);
}
export interface QuestionExample {
  text: string;
  conversationId: string;
  sentAt: string;
  suggestedText?: string;
}
export function groupRepeatedQuestions(examples: QuestionExample[]) {
  const groups: { question: string; examples: QuestionExample[]; clients: Set<string> }[] = [];
  for (const example of examples) {
    const tokens = questionTokens(example.text);
    if (
      tokens.length < 2 ||
      example.text.length > 500 ||
      !(
        /[?]/.test(example.text) ||
        /\b(qual|como|prazo|demora|tempo|valor|preco|entrega|pix)\b/.test(
          example.text
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase(),
        )
      )
    )
      continue;
    const group = groups.find((item) => questionSimilarity(item.question, example.text) >= 0.67);
    if (group) {
      group.examples.push(example);
      group.clients.add(example.conversationId);
    } else
      groups.push({
        question: example.text,
        examples: [example],
        clients: new Set([example.conversationId]),
      });
  }
  return groups
    .filter((group) => group.clients.size >= 2)
    .map((group) => ({
      id: createHash('sha256')
        .update(questionTokens(group.question).sort().join(' '))
        .digest('hex')
        .slice(0, 24),
      question: group.question,
      clients: group.clients.size,
      occurrences: group.examples.length,
      variants: [...new Set(group.examples.map((item) => item.text))].slice(0, 8),
      suggestedText: group.examples.find((item) => item.suggestedText)?.suggestedText ?? '',
      lastSeen: group.examples
        .map((item) => item.sentAt)
        .sort()
        .at(-1),
    }))
    .sort((a, b) => b.clients - a.clients || b.occurrences - a.occurrences);
}
const idSchema = z.string().min(1).max(200);
const sessionIdFrom = (req: Request) => idSchema.parse((req.params as Record<string, string>).sessionId);
const inputSchema = z
  .object({
    question: z.string().trim().min(5).max(400),
    variants: z.array(z.string().trim().min(2).max(400)).max(30).default([]),
    text: z.string().max(20000).default(''),
    assetIds: z.array(idSchema).max(10).default([]),
    category: z.string().trim().max(80).default(''),
    active: z.boolean().default(true),
  })
  .refine(
    (value) => value.text.trim() || value.assetIds.length,
    'Cadastre um texto ou escolha pelo menos um recurso.',
  );

export function standardReplyRoutes(
  db: PrismaClient,
  whatsapp: WhatsappService,
  messaging: MessagingService,
) {
  const router = Router({ mergeParams: true });
  const sends = new SerialQueue();
  router.use(async (req, _res, next) => {
    await whatsapp.snapshot(sessionIdFrom(req));
    next();
  });
  const list = async (sessionId: string) =>
    (
      await db.operationRecord.findMany({
        where: { kind: 'STANDARD_REPLY', data: { path: '$.sessionId', equals: sessionId } },
      })
    )
      .map((row) => row.data as unknown as StandardReply)
      .filter((item) => !item.archived)
      .sort((a, b) => a.position - b.position || a.question.localeCompare(b.question));
  router.get('/', async (req, res) => {
    const sessionId = sessionIdFrom(req);
    const query = z.string().max(500).default('').parse(req.query.question);
    res.json({
      items: (await list(sessionId)).map((item) => ({
        ...item,
        match: query
          ? Math.max(
              ...[item.question, ...item.variants].map((question) => questionSimilarity(question, query)),
            )
          : 0,
      })),
    });
  });
  router.get('/suggestions', async (req, res) => {
    const sessionId = sessionIdFrom(req);
    const [messages, approved, dismissed] = await Promise.all([
      db.chatMessage.findMany({
        where: {
          conversation: { sessionId, contact: { isGroup: false } },
          sentAt: { gte: new Date(Date.now() - 60 * 86400000) },
          type: { in: ['text', 'conversation', 'extendedTextMessage'] },
          text: { not: null },
        },
        orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
        take: 3000,
        select: { text: true, direction: true, conversationId: true, sentAt: true },
      }),
      list(sessionId),
      record<string[]>(db, `standard-dismissed:${sessionId}`, []),
    ]);
    const nextReply = new Map<string, { text: string; sentAt: Date }>();
    const examples: QuestionExample[] = [];
    for (const message of messages) {
      if (message.direction === 'OUTBOUND')
        nextReply.set(message.conversationId, { text: message.text ?? '', sentAt: message.sentAt });
      else if (message.text) {
        const reply = nextReply.get(message.conversationId);
        examples.push({
          text: message.text,
          conversationId: message.conversationId,
          sentAt: message.sentAt.toISOString(),
          suggestedText:
            reply && reply.sentAt.getTime() - message.sentAt.getTime() < 2 * 86400000
              ? reply.text.slice(0, 2000)
              : undefined,
        });
        nextReply.delete(message.conversationId);
      }
    }
    const items = groupRepeatedQuestions(examples)
      .filter(
        (item) =>
          !dismissed.includes(item.id) &&
          !approved.some((reply) =>
            [reply.question, ...reply.variants].some(
              (question) => questionSimilarity(question, item.question) >= 0.67,
            ),
          ),
      )
      .slice(0, 40);
    res.json({ items, scanned: messages.length, days: 60 });
  });
  router.post('/suggestions/:suggestionId/dismiss', async (req, res) => {
    const key = `standard-dismissed:${sessionIdFrom(req)}`;
    const current = await record<string[]>(db, key, []);
    await putRecord(
      db,
      key,
      'STANDARD_REPLY_DISMISSED',
      [...new Set([...current, idSchema.parse(req.params.suggestionId)])].slice(-2000),
    );
    res.json({ saved: true });
  });
  router.post('/suggestions/reset', async (req, res) => {
    await putRecord(db, `standard-dismissed:${sessionIdFrom(req)}`, 'STANDARD_REPLY_DISMISSED', []);
    res.json({ saved: true });
  });
  router.put('/order', async (req, res) => {
    const sessionId = sessionIdFrom(req);
    const { ids } = z.object({ ids: z.array(idSchema).max(1000) }).parse(req.body);
    const items = await list(sessionId);
    if (new Set(ids).size !== ids.length || ids.some((id) => !items.some((item) => item.id === id)))
      throw new AppError(422, 'Atualize a lista de respostas antes de reorganizar.');
    await db.$transaction(async (tx) => {
      for (const [position, itemId] of [
        ...ids,
        ...items.filter((item) => !ids.includes(item.id)).map((item) => item.id),
      ].entries()) {
        const item = items.find((entry) => entry.id === itemId)!;
        await tx.operationRecord.update({ where: { id: itemId }, data: { data: { ...item, position } } });
      }
    });
    res.json({ saved: true });
  });
  const save = async (sessionId: string, itemId: string | null, raw: unknown) => {
    const input = inputSchema.parse(raw);
    const previous = itemId ? await record<StandardReply | null>(db, itemId, null) : null;
    if (itemId && (!previous || previous.sessionId !== sessionId || previous.archived))
      throw new AppError(404, 'Resposta padrão não encontrada.');
    if (new Set(input.assetIds).size !== input.assetIds.length)
      throw new AppError(422, 'Escolha cada recurso uma única vez.');
    if ((await db.asset.count({ where: { id: { in: input.assetIds } } })) !== input.assetIds.length)
      throw new AppError(422, 'Um dos recursos selecionados não está mais disponível.');
    const items = await list(sessionId);
    if (!previous && items.length >= 1000)
      throw new AppError(
        422,
        'Esta conexão já possui 1000 respostas padrão. Organize ou arquive as que não usa.',
      );
    const item: StandardReply = {
      id: itemId ?? `standard:${randomUUID()}`,
      sessionId,
      ...input,
      archived: false,
      uses: previous?.uses ?? 0,
      position: previous?.position ?? items.length,
      updatedAt: new Date().toISOString(),
    };
    await putRecord(db, item.id, 'STANDARD_REPLY', item);
    return item;
  };
  router.post('/', async (req, res) => res.status(201).json(await save(sessionIdFrom(req), null, req.body)));
  router.put('/:replyId', async (req, res) =>
    res.json(await save(sessionIdFrom(req), idSchema.parse(req.params.replyId), req.body)),
  );
  router.delete('/:replyId', async (req, res) => {
    const item = await record<StandardReply | null>(db, idSchema.parse(req.params.replyId), null);
    if (!item || item.sessionId !== sessionIdFrom(req)) throw new AppError(404, 'Resposta não encontrada.');
    await putRecord(db, item.id, 'STANDARD_REPLY', { ...item, archived: true, active: false });
    res.json({ archived: true });
  });
  router.post('/:replyId/send', async (req, res) => {
    const sessionId = sessionIdFrom(req);
    const { conversationId, requestId } = z
      .object({ conversationId: idSchema, requestId: z.string().uuid(), confirmed: z.literal(true) })
      .parse(req.body);
    const replyId = idSchema.parse(req.params.replyId);
    const result = await sends.run(async () => {
      const reply = await record<StandardReply | null>(db, replyId, null);
      if (!reply || reply.sessionId !== sessionId || !reply.active || reply.archived)
        throw new AppError(404, 'Resposta padrão indisponível.');
      await messaging.chat(sessionId, conversationId);
      type Part = {
        kind: string;
        text?: string;
        caption?: string;
        fileId?: string;
        isPtt?: boolean;
        isPtv?: boolean;
        asViewOnce?: boolean;
      };
      const key = `standard-send:${requestId}`;
      let state = await record<{
        replyId: string;
        sessionId: string;
        conversationId: string;
        parts: Part[];
        completed: number;
      } | null>(db, key, null);
      if (
        state &&
        (state.conversationId !== conversationId ||
          state.replyId !== replyId ||
          state.sessionId !== sessionId)
      )
        throw new AppError(409, 'Este envio já está associado a outra resposta.');
      if (!state) {
        const parts: Part[] = reply.text.trim() ? [{ kind: 'text', text: reply.text }] : [];
        const assets = await db.asset.findMany({
          where: { id: { in: reply.assetIds } },
          include: { file: { select: { mimeType: true } } },
        });
        for (const assetId of reply.assetIds) {
          const asset = assets.find((item) => item.id === assetId);
          if (!asset) throw new AppError(422, 'Atualize os arquivos desta resposta antes de enviar.');
          parts.push({
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
          });
        }
        state = { replyId, sessionId, conversationId, parts, completed: 0 };
        await putRecord(db, key, 'STANDARD_REPLY_SEND', state);
      }
      await setAiControl(db, conversationId, true, 'Atendimento assumido com resposta padrão.');
      for (let index = state.completed; index < state.parts.length; index++) {
        await messaging.send(sessionId, conversationId, {
          ...state.parts[index],
          requestId: `${requestId}:standard:${index}`,
        });
        state.completed = index + 1;
        await putRecord(db, key, 'STANDARD_REPLY_SEND', state);
      }
      return { sent: state.completed, requestId };
    });
    res.json(result);
  });
  return router;
}
