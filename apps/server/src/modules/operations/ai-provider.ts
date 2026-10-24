import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { SerialQueue } from '../../shared/serial-queue.js';
import { AppError } from '../../shared/errors.js';
import { CredentialCipher } from '../whatsapp/credential-cipher.js';
import { env } from '../../config/env.js';
import { putRecord, type AgentSettings } from './records.js';
const budgetQueue = new SerialQueue();
interface Usage {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  status: string;
  provider: string;
  conversationId: string;
  purpose: string;
}
export async function aiUsage(db: PrismaClient) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const start = new Date(`${day.slice(0, 7)}-01T00:00:00-03:00`);
  const today = new Date(`${day}T00:00:00-03:00`);
  const rows = await db.operationRecord.findMany({ where: { kind: 'AI_USAGE', createdAt: { gte: start } } });
  return rows.reduce(
    (total, row) => {
      const usage = row.data as unknown as Usage;
      total.monthCost += usage.estimatedCost;
      if (row.createdAt >= today) {
        total.todayTokens += usage.inputTokens + usage.outputTokens;
        total.todayRequests++;
      }
      if (usage.status !== 'COMPLETED') total.unconfirmed++;
      return total;
    },
    { todayTokens: 0, todayRequests: 0, monthCost: 0, unconfirmed: 0 },
  );
}
export async function meteredCall<T>(
  db: PrismaClient,
  settings: AgentSettings,
  conversationId: string,
  purpose: string,
  inputEstimate: number,
  call: () => Promise<{ result: T; inputTokens?: number; outputTokens?: number }>,
) {
  const maxOutput = settings.maxOutputTokens ?? 1200;
  const cost =
    (inputEstimate * (settings.inputPrice ?? 0) + maxOutput * (settings.outputPrice ?? 0)) / 1_000_000;
  const id = `ai-usage:${randomUUID()}`;
  const reserved: Usage = {
    inputTokens: inputEstimate,
    outputTokens: maxOutput,
    estimatedCost: cost,
    status: 'RESERVED',
    provider: settings.provider ?? 'openai',
    conversationId,
    purpose,
  };
  await budgetQueue.run(async () => {
    const usage = await aiUsage(db);
    if (settings.dailyTokenLimit && usage.todayTokens + inputEstimate + maxOutput > settings.dailyTokenLimit)
      throw new AppError(429, 'Limite diário de tokens atingido. Revise o consumo nas configurações.');
    if (settings.monthlyBudget && usage.monthCost + cost > settings.monthlyBudget)
      throw new AppError(429, 'Orçamento mensal estimado atingido. Revise os limites da IA.');
    await putRecord(db, id, 'AI_USAGE', reserved);
  });
  try {
    const response = await call();
    const inputTokens = response.inputTokens ?? inputEstimate;
    const outputTokens = response.outputTokens ?? maxOutput;
    await putRecord(db, id, 'AI_USAGE', {
      ...reserved,
      inputTokens,
      outputTokens,
      estimatedCost:
        (inputTokens * (settings.inputPrice ?? 0) + outputTokens * (settings.outputPrice ?? 0)) / 1_000_000,
      status: 'COMPLETED',
      estimated: response.inputTokens === undefined || response.outputTokens === undefined,
    });
    return response.result;
  } catch (error) {
    // A timeout does not prove that the provider did not charge; retain the reservation.
    await putRecord(db, id, 'AI_USAGE', { ...reserved, status: 'UNCONFIRMED' });
    throw error;
  }
}
export async function providerKey(settings: AgentSettings) {
  if (!settings.encryptedKey) throw new AppError(422, 'Configure a chave da IA.');
  return (await CredentialCipher.load(env.WHATSAPP_KEY_FILE)).decrypt<string>(
    Buffer.from(settings.encryptedKey, 'base64'),
  );
}
export async function providerResponse(response: Response) {
  if (!response.ok)
    throw new AppError(
      502,
      `O provedor de IA não concluiu a solicitação (HTTP ${response.status}). Confira a chave, o modelo e os limites.`,
    );
  return response.json();
}
export async function textCompletion(
  db: PrismaClient,
  settings: AgentSettings,
  conversationId: string,
  system: string,
  input: string,
) {
  const key = await providerKey(settings);
  const provider = settings.provider ?? 'openai';
  const max = settings.maxOutputTokens ?? 1200;
  return meteredCall(
    db,
    settings,
    conversationId,
    'reply',
    Buffer.byteLength(system + input) + 200,
    async () => {
      let text = '';
      let inputTokens: number | undefined;
      let outputTokens: number | undefined;
      if (provider === 'anthropic') {
        const result = await providerResponse(
          await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            signal: AbortSignal.timeout(60_000),
            headers: {
              'x-api-key': key,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: settings.model,
              max_tokens: max,
              system,
              messages: [{ role: 'user', content: input }],
            }),
          }),
        );
        text = (result.content ?? [])
          .filter((item: { type: string }) => item.type === 'text')
          .map((item: { text: string }) => item.text)
          .join('\n');
        inputTokens = result.usage?.input_tokens;
        outputTokens = result.usage?.output_tokens;
      } else if (provider === 'gemini') {
        const result = await providerResponse(
          await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.model)}:generateContent`,
            {
              method: 'POST',
              signal: AbortSignal.timeout(60_000),
              headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: system }] },
                contents: [{ role: 'user', parts: [{ text: input }] }],
                generationConfig: { maxOutputTokens: max },
              }),
            },
          ),
        );
        text = (result.candidates?.[0]?.content?.parts ?? [])
          .filter((item: { thought?: boolean }) => !item.thought)
          .map((item: { text?: string }) => item.text ?? '')
          .join('\n');
        inputTokens = result.usageMetadata?.promptTokenCount;
        outputTokens = result.usageMetadata
          ? (result.usageMetadata.candidatesTokenCount ?? 0) + (result.usageMetadata.thoughtsTokenCount ?? 0)
          : undefined;
      } else {
        const result = await providerResponse(
          await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            signal: AbortSignal.timeout(60_000),
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: settings.model,
              store: false,
              max_output_tokens: max,
              instructions: system,
              input,
            }),
          }),
        );
        text = (result.output ?? [])
          .flatMap((item: { content?: unknown[] }) => item.content ?? [])
          .filter((item: { type: string }) => item.type === 'output_text')
          .map((item: { text?: string }) => item.text ?? '')
          .join('\n');
        inputTokens = result.usage?.input_tokens;
        outputTokens = result.usage?.output_tokens;
      }
      if (!text.trim()) throw new AppError(502, 'O modelo não retornou uma resposta de texto.');
      return {
        result: { text, usage: { inputTokens, outputTokens }, sent: false },
        inputTokens,
        outputTokens,
      };
    },
  );
}
