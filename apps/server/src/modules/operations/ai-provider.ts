import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { SerialQueue } from '../../shared/serial-queue.js';
import { AppError } from '../../shared/errors.js';
import { CredentialCipher } from '../whatsapp/credential-cipher.js';
import { env } from '../../config/env.js';
import { databasePaths } from '../../database/paths.js';
import { putRecord, record, type AgentSettings } from './records.js';
const budgetQueue = new SerialQueue();
class ProviderRejection extends AppError {}
const rejectedBeforeGeneration = (status: number) => [400, 401, 403, 404, 413, 422, 429].includes(status);
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
      if (usage.status === 'RESERVED' || usage.status === 'UNCONFIRMED') total.unconfirmed++;
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
    if (error instanceof ProviderRejection) {
      await putRecord(db, id, 'AI_USAGE', {
        ...reserved, inputTokens: 0, outputTokens: 0, estimatedCost: 0, status: 'REJECTED',
      });
      throw error;
    }
    // A timeout does not prove that the provider did not charge; retain the reservation.
    await putRecord(db, id, 'AI_USAGE', { ...reserved, status: 'UNCONFIRMED' });
    throw error;
  }
}
export async function providerKey(settings: AgentSettings, encryptedKey = settings.encryptedKey, db?: PrismaClient) {
  if (!encryptedKey) throw new AppError(422, 'Configure a chave da IA.');
  return (await CredentialCipher.load(db ? databasePaths(db).keyFile : env.WHATSAPP_KEY_FILE)).decrypt<string>(
    Buffer.from(encryptedKey, 'base64'),
  );
}
type GeminiKey = { id: string; label: string; encryptedKey: string; enabled: boolean };
export async function listGeminiModels(db: PrismaClient, settings: AgentSettings) {
  const models = new Map<string, { id: string; name: string; description: string }>();
  let pageToken: string | undefined;
  for (let page = 0; page < 20; page++) {
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const data = await geminiResponse(db, settings, url.toString(), {
      method: 'GET', signal: AbortSignal.timeout(30_000),
    });
    for (const model of data.models ?? []) {
      if (typeof model.name !== 'string' || !model.supportedGenerationMethods?.includes('generateContent')) continue;
      const id = model.name.replace(/^models\//, '');
      models.set(id, { id, name: String(model.displayName ?? id), description: String(model.description ?? '').slice(0, 500) });
    }
    pageToken = typeof data.nextPageToken === 'string' ? data.nextPageToken : undefined;
    if (!pageToken) return [...models.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
  throw new AppError(502, 'O catálogo de modelos excedeu o limite de páginas. Tente novamente mais tarde.');
}
function dailyQuotaExhausted(status: number, data: any) {
  if (status !== 429) return false;
  const details = JSON.stringify(data?.error?.details ?? []);
  const message = String(data?.error?.message ?? '');
  return /per.?day|daily|requests_per_day|tokens_per_day/i.test(`${details} ${message}`);
}
export async function geminiResponse(db: PrismaClient, settings: AgentSettings, url: string, init: RequestInit) {
  const candidates: GeminiKey[] = [
    ...(settings.encryptedKey ? [{ id: 'primary', label: 'Chave principal', encryptedKey: settings.encryptedKey, enabled: true }] : []),
    ...(settings.fallbackKeys ?? []).filter((key) => key.enabled),
  ];
  if (!candidates.length) throw new ProviderRejection(422, 'Cadastre uma chave da API Gemini nas configurações de IA.');
  const cipher = await CredentialCipher.load(databasePaths(db).keyFile);
  const now = Date.now();
  const available: GeminiKey[] = [];
  for (const key of candidates) {
    const exhausted = await record<{ until: number } | null>(db, `ai-key-quota:${key.id}`, null);
    if (!exhausted || exhausted.until <= now) available.push(key);
  }
  if (!available.length) throw new ProviderRejection(429, 'A cota diária de todas as chaves Gemini cadastradas foi atingida. Ela será verificada novamente mais tarde.');
  for (let index = 0; index < available.length; index++) {
    const key = available[index]!;
    const secret = cipher.decrypt<string>(Buffer.from(key.encryptedKey, 'base64'));
    const headers = new Headers(init.headers);
    headers.set('x-goog-api-key', secret);
    const response = await fetch(url, { ...init, headers });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      await putRecord(db, 'ai-key-last-used', 'AI_KEY_STATE', { id: key.id, label: key.label, usedAt: new Date().toISOString() });
      return data;
    }
    if (dailyQuotaExhausted(response.status, data)) {
      await putRecord(db, `ai-key-quota:${key.id}`, 'AI_KEY_QUOTA', { until: now + 24 * 60 * 60 * 1000, exhaustedAt: new Date().toISOString() });
      if (index < available.length - 1) continue;
      throw new ProviderRejection(429, 'A cota diária das chaves Gemini disponíveis foi atingida. Adicione uma chave de outro projeto Google Cloud com cota própria.');
    }
    const message = String(data?.error?.message ?? 'Erro desconhecido');
    if (response.status === 429)
      throw new ProviderRejection(429, `Limite temporário da Gemini atingido para “${key.label}”. Aguarde e tente novamente; a próxima chave só será usada quando a cota diária for esgotada.`);
    const ErrorType = rejectedBeforeGeneration(response.status) ? ProviderRejection : AppError;
    throw new ErrorType(502, `Gemini não concluiu a solicitação (HTTP ${response.status}): ${message.slice(0, 400)}`);
  }
  throw new AppError(429, 'Cota diária Gemini esgotada.');
}
export async function providerResponse(response: Response) {
  if (!response.ok) {
    const ErrorType = rejectedBeforeGeneration(response.status) ? ProviderRejection : AppError;
    throw new ErrorType(
      502,
      `O provedor de IA não concluiu a solicitação (HTTP ${response.status}). Confira a chave, o modelo e os limites.`,
    );
  }
  return response.json();
}
export async function textCompletion(
  db: PrismaClient,
  settings: AgentSettings,
  conversationId: string,
  system: string,
  input: string,
  route: 'fast' | 'deep' = 'deep',
) {
  const provider = settings.provider ?? 'openai';
  const key = provider === 'gemini' ? '' : await providerKey(settings, undefined, db);
  const model = route === 'fast' ? settings.fastModel?.trim() || settings.model : settings.reasoningModel?.trim() || settings.model;
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
              model,
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
        const result = await geminiResponse(db, settings,
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            {
              method: 'POST',
              signal: AbortSignal.timeout(60_000),
              headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: system }] },
                contents: [{ role: 'user', parts: [{ text: input }] }],
                generationConfig: { maxOutputTokens: max },
              }),
            });
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
              model,
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
