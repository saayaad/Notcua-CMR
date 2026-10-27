import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../shared/errors.js';
import type { PrismaClient } from '@prisma/client';
import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { AccessService, PLATFORM_OWNER, type AccessAccount } from '../modules/access/access.service.js';

let authDb: PrismaClient | undefined;
let accessRegistry: PrismaClient | undefined;
export function configureAuthorization(db: PrismaClient, registry = db) {
  authDb = db;
  accessRegistry = registry;
}
export interface Identity {
  uid: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  workspaceId?: string;
  workspaceOwner?: boolean;
}
export async function verifyRegisteredToken(value: unknown): Promise<AccessAccount> {
  if (env.AUTH_MODE !== 'firebase')
    throw new AppError(403, 'Chaves comerciais exigem autenticação Firebase.');
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
  return { uid: decoded.uid, email };
}
export async function authorizeAccount(
  account: AccessAccount,
  db: PrismaClient,
  registry = db,
): Promise<Identity> {
  const { uid, email } = account;
  if (email === env.OWNER_EMAIL.toLowerCase()) return { uid, email, role: 'ADMIN', workspaceId: 'owner' };
  const access = new AccessService(registry);
  const binding = await access.binding(account);
  if (binding) {
    if (!binding.active) throw new AppError(403, 'Seu acesso à equipe foi desativado.');
    await access.assertActive(binding.workspaceId);
    return {
      uid,
      email,
      role: binding.role,
      workspaceId: binding.workspaceId,
      workspaceOwner: binding.uid === uid,
    };
  }
  const member = await db.operationRecord.findUnique({ where: { id: `team:${email}` } });
  const data = member?.data as { active?: boolean; role?: string } | undefined;
  if (data?.active)
    return { uid, email, role: data.role === 'ADMIN' ? 'ADMIN' : 'MEMBER', workspaceId: 'owner' };
  throw new AppError(402, 'Ative sua chave de acesso para começar a usar o Noctua.', {
    code: 'ACTIVATION_REQUIRED',
  });
}
export async function authorizeToken(value: unknown): Promise<Identity> {
  if (env.AUTH_MODE === 'local') {
    if (!validToken(value)) throw new AppError(401, 'Token de acesso inválido.');
    return { uid: 'local', email: '', role: 'ADMIN' };
  }
  const account = await verifyRegisteredToken(value);
  if (!authDb) throw new AppError(503, 'Autorização ainda não está disponível.');
  return authorizeAccount(account, authDb, accessRegistry);
}
export async function synchronizeTeamAccess(
  workspaceId: string | undefined,
  data: { email: string; role: string; active: boolean },
) {
  if (!workspaceId || workspaceId === 'owner' || !accessRegistry) return;
  if (data.email.toLowerCase() === PLATFORM_OWNER)
    throw new AppError(409, 'A conta do proprietário não pode ser adicionada a outra operação.');
  const spaces = await accessRegistry.operationRecord.findMany({ where: { kind: 'ACCESS_WORKSPACE' } });
  if (spaces.some((row) => (row.data as { ownerEmail?: string }).ownerEmail === data.email.toLowerCase()))
    throw new AppError(409, 'Este e-mail já possui uma operação própria.');
  const id = `access-member:${data.email.toLowerCase()}`;
  const previous = await accessRegistry.operationRecord.findUnique({ where: { id } });
  if (previous && (previous.data as { workspaceId?: string }).workspaceId !== workspaceId)
    throw new AppError(409, 'Este e-mail já pertence a outra operação.');
  const value = {
    email: data.email.toLowerCase(),
    workspaceId,
    role: data.role === 'ADMIN' ? 'ADMIN' : 'MEMBER',
    active: data.active,
  };
  await accessRegistry.operationRecord.upsert({
    where: { id },
    create: { id, kind: 'ACCESS_MEMBER', data: value },
    update: { data: value },
  });
}

export function validToken(value: unknown): boolean {
  if (!env.API_TOKEN) return true;
  if (typeof value !== 'string') return false;
  const actual = Buffer.from(value);
  const expected = Buffer.from(env.API_TOKEN);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const authenticate: RequestHandler = async (req, res, next) => {
  res.locals.identity =
    res.locals.verifiedIdentity ?? (await authorizeToken(req.headers.authorization?.replace(/^Bearer /, '')));
  delete res.locals.verifiedIdentity;
  if ((res.locals.identity.workspaceId ?? 'owner') !== (res.locals.workspaceId ?? 'owner'))
    throw new AppError(403, 'Esta operação não pertence à sua conta.');
  if (
    res.locals.identity.role !== 'ADMIN' &&
    (req.path.startsWith('/backups') ||
      req.path.startsWith('/files/') ||
      (req.method !== 'GET' && ['/whatsapp', '/automation'].some((prefix) => req.path.startsWith(prefix))))
  )
    throw new AppError(403, 'Esta ação exige acesso de administrador.');
  next();
};
