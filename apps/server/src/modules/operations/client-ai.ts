import { createHash, randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import type { MessagingService } from '../attendance/messaging.service.js';
import { AppError } from '../../shared/errors.js';
import { geminiResponse, providerResponse, textCompletion } from './ai-provider.js';
import { hasConfiguredKey, record, putRecord, type AgentSettings } from './records.js';

type ClientAiEntry = {
  id: string;
  role: 'user' | 'assistant';
  kind: 'text' | 'image';
  text: string;
  fileId?: string;
  createdAt: string;
};

type ClientAiThread = { conversationId: string; entries: ClientAiEntry[]; updatedAt: string };

const threadRecord = (conversationId: string) => `client-ai-thread:${conversationId}`;

export function clientAiRoutes(db: PrismaClient, messaging: MessagingService) {
  const router = Router();
  const getThread = async (conversationId: string): Promise<ClientAiThread> =>
    record(db, threadRecord(conversationId), { conversationId, entries: [], updatedAt: new Date(0).toISOString() });
  const saveEntries = async (conversationId: string, entries: ClientAiEntry[]) => {
    const value = { conversationId, entries: entries.slice(-200), updatedAt: new Date().toISOString() };
    await putRecord(db, threadRecord(conversationId), 'CLIENT_AI_THREAD', value);
    return value;
  };
  const settings = async () => {
    const value = await record<AgentSettings | null>(db, 'integration:ai', null);
    if (!hasConfiguredKey(value) || !value?.model) throw new AppError(422, 'Configure a integração de IA antes de usar o estúdio.');
    return value;
  };

  router.get('/sessions/:sessionId/contacts/:conversationId/ai-thread', async (req, res) => {
    const chat = await messaging.chat(req.params.sessionId, req.params.conversationId);
    const thread = await getThread(chat.id);
    res.json({ conversationId: chat.id, entries: thread.entries, updatedAt: thread.updatedAt });
  });

  router.post('/sessions/:sessionId/contacts/:conversationId/ai-thread/messages', async (req, res) => {
    const input = z.object({ text: z.string().trim().min(1).max(6000) }).parse(req.body);
    const chat = await messaging.chat(req.params.sessionId, req.params.conversationId);
    const config = await settings();
    const thread = await getThread(chat.id);
    const userEntry: ClientAiEntry = { id: randomUUID(), role: 'user', kind: 'text', text: input.text, createdAt: new Date().toISOString() };
    const context = thread.entries.slice(-20).map((entry) => `${entry.role === 'user' ? 'Operador' : 'Assistente'}: ${entry.text}`).join('\n');
    const result = await textCompletion(
      db,
      config,
      `client-ai:${chat.id}`,
      `Você é um assistente criativo para o operador que atende este cliente. Mantenha separado o contexto deste cliente. Não envie mensagens ao WhatsApp nem afirme que fez ações. Regras do administrador: ${(config.instructions ?? '').slice(0, 12000)}\nEstilo: ${(config.style ?? '').slice(0, 6000)}\nConhecimento aprovado: ${(config.knowledge ?? '').slice(0, 12000)}`,
      `Histórico deste estúdio para este cliente:\n${context}\n\nSolicitação atual do operador:\n${input.text}`,
    );
    const assistantEntry: ClientAiEntry = { id: randomUUID(), role: 'assistant', kind: 'text', text: result.text, createdAt: new Date().toISOString() };
    const saved = await saveEntries(chat.id, [...thread.entries, userEntry, assistantEntry]);
    res.json({ entries: saved.entries.slice(-2), updatedAt: saved.updatedAt });
  });

  router.post('/sessions/:sessionId/contacts/:conversationId/ai-thread/images', async (req, res) => {
    const input = z.object({
      prompt: z.string().trim().min(3).max(5000),
      aspectRatio: z.enum(['1:1', '9:16']),
      template: z.enum(['mascot-3d', 'mascot-realistic', 'product']).default('mascot-3d'),
      reference: z.object({ data: z.string().min(1).max(12500000).regex(/^[A-Za-z0-9+/=]+$/), mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']) }).optional(),
    }).parse(req.body);
    const chat = await messaging.chat(req.params.sessionId, req.params.conversationId);
    const config = await settings();
    if (config.provider !== 'gemini') throw new AppError(422, 'A geração de imagens requer Google Gemini. Selecione Google · Gemini nas configurações de IA.');
    const model = config.imageModel?.trim();
    if (!model) throw new AppError(422, 'Informe o modelo de geração de imagens nas configurações de IA.');
    const referenceBytes = input.reference ? Buffer.from(input.reference.data, 'base64') : undefined;
    if (referenceBytes && referenceBytes.byteLength > 8 * 1024 * 1024) throw new AppError(413, 'A imagem de referência deve ter até 8 MiB.');
    const templatePrompt = {
      'mascot-3d': 'Crie uma arte comercial de mascote em 3D, com acabamento profissional e visual amigável.',
      'mascot-realistic': 'Crie uma imagem comercial realista, com iluminação profissional e aparência natural.',
      product: 'Crie uma fotografia comercial do produto, com composição de estúdio e acabamento profissional.',
    }[input.template];
    const providerInput = [
      { type: 'text', text: `${templatePrompt}\n${input.prompt}\nUse a proporção ${input.aspectRatio}.` },
      ...(input.reference && referenceBytes ? [{ type: 'image', data: input.reference.data, mime_type: input.reference.mimeType }] : []),
    ];
    const response = await geminiResponse(db, config, 'https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(180000),
      body: JSON.stringify({
        model,
        input: providerInput,
        response_format: { type: 'image', mime_type: 'image/png', aspect_ratio: input.aspectRatio },
      }),
    });
    const imageData = response.output_image?.data ?? response.steps?.flatMap((step: { content?: { type?: string; data?: string }[] }) => step.content ?? []).find((item: { type?: string }) => item.type === 'image')?.data;
    if (typeof imageData !== 'string' || !imageData) throw new AppError(502, 'O Gemini não retornou uma imagem. Confira o modelo de imagem configurado e os limites da conta.');
    const imageBytes = Buffer.from(imageData, 'base64');
    if (!imageBytes.byteLength || imageBytes.byteLength > 15 * 1024 * 1024) throw new AppError(502, 'O arquivo gerado está vazio ou excede 15 MiB.');
    const hash = createHash('sha256').update(imageBytes).digest('hex');
    const file = await db.storedFile.upsert({
      where: { sha256: hash },
      create: { id: `file:${randomUUID()}`, sha256: hash, filename: `noctua-${chat.id}-${Date.now()}.png`, mimeType: 'image/png', byteLength: imageBytes.byteLength, data: imageBytes },
      update: {},
      select: { id: true },
    });
    const thread = await getThread(chat.id);
    const now = new Date().toISOString();
    const userEntry: ClientAiEntry = { id: randomUUID(), role: 'user', kind: 'text', text: `Imagem ${input.template} · ${input.aspectRatio}\n${input.prompt}`, createdAt: now };
    const assistantEntry: ClientAiEntry = { id: randomUUID(), role: 'assistant', kind: 'image', text: 'Imagem gerada. Ela ficou salva no histórico privado deste cliente.', fileId: file.id, createdAt: now };
    const saved = await saveEntries(chat.id, [...thread.entries, userEntry, assistantEntry]);
    res.status(201).json({ entries: saved.entries.slice(-2), updatedAt: saved.updatedAt, model });
  });

  return router;
}
