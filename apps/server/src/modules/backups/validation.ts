import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors.js';

export const recordSchema = z.record(z.string(), z.unknown());
export type RecordData = z.infer<typeof recordSchema>;
const identifier = z.union([z.string().min(1).max(200), z.number().finite()]).transform(String);
export const idSchema = identifier;
const millis = z.number().int().min(0).max(2_147_483_647).default(0);
export const assetSchema = z.object({
  id: identifier,
  name: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  text: z.string().optional(),
  message: z.string().optional(),
  caption: z.string().optional(),
  isFavorite: z.boolean().default(false),
  isPtt: z.boolean().default(false),
  isPtv: z.boolean().default(false),
  asViewOnce: z.boolean().default(false),
  objectId: identifier.optional(),
  fileId: identifier.optional(),
  base64: z.string().optional(),
  mimeType: z.string().optional(),
  filename: z.string().optional(),
}).passthrough();
export const labelSchema = z.object({
  id: identifier,
  name: z.string().min(1),
  color: z.string().regex(/^#[\da-fA-F]{6}$/).default('#8B5CF6'),
  description: z.string().default(''),
  createReason: z.string().default('Importado de backup'),
  phoneNumbers: z.array(z.string()).default([]),
}).passthrough();
export const funnelSchema = z.object({
  id: identifier,
  name: z.string().min(1),
  itemsSequence: z.array(z.object({
    itemId: identifier,
    type: z.enum(['message', 'media', 'audio', 'doc', 'document']),
    delayBeforeSend: millis,
  }).passthrough()),
}).passthrough();
export const actionSchema = z.object({
  type: z.enum(['txt', 'media', 'image', 'video', 'addLabel', 'removeLabel', 'utility']),
  text: z.string().optional(),
  message: z.string().optional(),
  base64: z.string().optional(),
  mimeType: z.string().optional(),
  filename: z.string().optional(),
  labelID: identifier.optional(),
  aguarde: z.number().min(0).max(2_147_483).default(0),
  composing: z.number().min(0).max(2_147_483).default(0),
}).passthrough().superRefine((action, ctx) => {
  if (action.type === 'txt' && !(action.text ?? action.message)) {
    ctx.addIssue({ code: 'custom', message: 'Ação txt exige text ou message.' });
  }
  if (['media', 'image', 'video'].includes(action.type) && !action.base64) {
    ctx.addIssue({ code: 'custom', message: 'Ação de mídia exige base64.' });
  }
  if (['addLabel', 'removeLabel'].includes(action.type) && !action.labelID) {
    ctx.addIssue({ code: 'custom', message: 'Ação de etiqueta exige labelID.' });
  }
});
export const macroSchema = z.object({
  id: identifier,
  name: z.string().min(1),
  text: z.string().optional(),
  isFavorite: z.boolean().default(false),
  acao: z.array(actionSchema).default([]),
}).passthrough();

export function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function digest(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function list(value: unknown, field: string): RecordData[] {
  if (value === undefined) return [];
  const parsed = z.array(recordSchema).safeParse(value);
  if (!parsed.success) throw new AppError(422, `${field} deve ser uma lista de objetos.`, parsed.error.issues);
  return parsed.data;
}

export function decodeBase64(value: string, suppliedMime?: string) {
  const dataUrl = /^data:([\w.+-]+\/[\w.+-]+);base64,([\s\S]*)$/.exec(value);
  if (value.startsWith('data:') && !dataUrl) throw new AppError(422, 'Data URL inválida.');
  const encoded = (dataUrl?.[2] ?? value).replace(/\s/g, '');
  if (!encoded || encoded.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
    throw new AppError(422, 'Arquivo Base64 inválido.');
  }
  const data = Buffer.from(encoded, 'base64');
  if (data.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) {
    throw new AppError(422, 'Arquivo Base64 inválido.');
  }
  if (data.length > 20 * 1024 * 1024) throw new AppError(413, 'Cada mídia deve ter no máximo 20 MiB.');
  const mimeType = dataUrl?.[1] ?? suppliedMime ?? 'application/octet-stream';
  if (!/^[\w.+-]+\/[\w.+-]+$/.test(mimeType)) throw new AppError(422, 'MIME inválido.');
  return { data, mimeType, sha256: digest(data), byteLength: data.length };
}

export function cleanFilename(value: unknown): string {
  const name = typeof value === 'string' ? value.split(/[\\/]/).pop() : undefined;
  return (name ?? 'arquivo.bin').replace(/[\x00-\x1f<>:"|?*]/g, '_').slice(0, 180) || 'arquivo.bin';
}

export function phone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) throw new AppError(422, `Telefone inválido: ${value}`);
  return digits;
}
