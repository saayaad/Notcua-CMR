import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../shared/errors.js';
import type { PrismaClient } from '@prisma/client';
import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let authDb: PrismaClient | undefined;
export function configureAuthorization(db: PrismaClient) {
  authDb = db;
}
export interface Identity {
  uid: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
}
export async function authorizeToken(value: unknown): Promise<Identity> {
  if (env.AUTH_MODE === 'local') {
    if (!validToken(value)) throw new AppError(401, 'Token de acesso inválido.');
    return { uid: 'local', email: '', role: 'ADMIN' };
  }
  if (typeof value !== 'string' || value.length > 8192)
    throw new AppError(401, 'Entre na sua conta para continuar.');
  if (!getApps().length)
    initializeApp({ credential: applicationDefault(), projectId: env.FIREBASE_PROJECT_ID });
  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(value, true);
  } catch {
    throw new AppError(401, 'Sua sessão expirou. Entre novamente.');
  }
  if (!decoded.email_verified || !decoded.email)
    throw new AppError(403, 'Confirme seu e-mail antes de acessar a operação.');
  const email = decoded.email.toLowerCase();
  if (email === env.OWNER_EMAIL.toLowerCase()) return { uid: decoded.uid, email, role: 'ADMIN' };
  const member = await authDb?.operationRecord.findUnique({ where: { id: `team:${email}` } });
  const data = member?.data as { active?: boolean; role?: string } | undefined;
  if (!data?.active)
    throw new AppError(
      403,
      'Sua conta foi criada, mas precisa de um convite do administrador desta operação.',
    );
  return { uid: decoded.uid, email, role: data.role === 'ADMIN' ? 'ADMIN' : 'MEMBER' };
}

export function validToken(value: unknown): boolean {
  if (!env.API_TOKEN) return true;
  if (typeof value !== 'string') return false;
  const actual = Buffer.from(value);
  const expected = Buffer.from(env.API_TOKEN);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const authenticate: RequestHandler = async (req, res, next) => {
  res.locals.identity = await authorizeToken(req.headers.authorization?.replace(/^Bearer /, ''));
  if (
    res.locals.identity.role !== 'ADMIN' &&
    (req.path.startsWith('/backups') ||
      req.path.startsWith('/files/') ||
      (req.method !== 'GET' && ['/whatsapp', '/automation'].some((prefix) => req.path.startsWith(prefix))))
  )
    throw new AppError(403, 'Esta ação exige acesso de administrador.');
  next();
};
