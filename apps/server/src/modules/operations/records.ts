import type { PrismaClient } from '@prisma/client';
import { json } from '../backups/validation.js';
export async function record<T>(db: PrismaClient, id: string, fallback: T): Promise<T> {
  const value = await db.operationRecord.findUnique({ where: { id } });
  return value ? (value.data as T) : fallback;
}
export async function putRecord(db: PrismaClient, id: string, kind: string, data: unknown) {
  return db.operationRecord.upsert({
    where: { id },
    create: { id, kind, data: json(data) },
    update: { data: json(data) },
  });
}
export interface AgentSettings {
  provider?: 'openai' | 'anthropic' | 'gemini';
  model: string;
  instructions: string;
  knowledge: string;
  style: string;
  enabled: boolean;
  enabledAt?: string;
  dailyLimit?: number;
  encryptedKey?: string;
  monthlyBudget?: number;
  dailyTokenLimit?: number;
  maxOutputTokens?: number;
  inputPrice?: number;
  outputPrice?: number;
  fallbackText?: string;
  mediaEnabled?: boolean;
  mediaModel?: string;
  transcriptionModel?: string;
}
export interface BusinessSettings {
  company?: string;
  segment?: string;
  employees?: string;
  objective?: string;
  social?: string;
  schedule?: { days: number[]; minTime: string; maxTime: string };
  autoCloseMinutes?: number;
  distribution?: boolean;
}
