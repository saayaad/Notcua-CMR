import type { PrismaClient, Prisma } from '@prisma/client';
import { record } from './records.js';
type Database = PrismaClient | Prisma.TransactionClient;
export interface AiControl {
  paused: boolean;
  reason: string;
  changedAt: string;
}
export function requestsHuman(text: string) {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return /\b(quero|preciso|prefiro|posso|gostaria|desejo)\b.{0,55}\b(humano|pessoa|atendente|vendedor)\b|\b(falar|conversar) com (um |uma |o |a )?(humano|pessoa|atendente|vendedor)\b|^(atendente|humano|pessoa real)[.!? ]*$/.test(
    normalized,
  );
}
export async function setAiControl(db: Database, conversationId: string, paused: boolean, reason: string) {
  const data: AiControl = { paused, reason, changedAt: new Date().toISOString() };
  await db.operationRecord.upsert({
    where: { id: `ai-control:${conversationId}` },
    create: { id: `ai-control:${conversationId}`, kind: 'AI_CONTROL', data: { ...data } },
    update: { data: { ...data } },
  });
  return data;
}
export function aiControl(db: PrismaClient, conversationId: string) {
  return record<AiControl>(db, `ai-control:${conversationId}`, { paused: false, reason: '', changedAt: '' });
}
