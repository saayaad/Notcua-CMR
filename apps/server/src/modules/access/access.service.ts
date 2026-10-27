import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../../shared/errors.js';
import { retryDatabaseOperation } from '../../database/retry.js';

export const PLATFORM_OWNER = 'gustavohenriquee011@gmail.com';
export const keyInput = z
  .object({
    label: z.string().trim().min(1).max(120),
    intendedEmail: z.union([z.email(), z.literal('')]).default(''),
    months: z
      .union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)])
      .nullable()
      .default(null),
    trialDays: z.number().int().min(1).max(30).nullable().default(null),
  })
  .refine(
    (value) => (value.months !== null) !== (value.trialDays !== null),
    'Escolha um plano ou um período de teste.',
  );
export interface AccessAccount {
  uid: string;
  email: string;
}
export interface AccessWorkspace {
  id: string;
  ownerUid: string;
  ownerEmail: string;
  expiresAt: string;
  revokedAt: string | null;
  currentKeyId: string;
  createdAt: string;
}
interface AccessKey {
  label: string;
  intendedEmail: string;
  months: number | null;
  trialDays: number | null;
  suffix: string;
  createdAt: string;
  createdBy: string;
  revokedAt: string | null;
  activatedAt: string | null;
  activatedBy: string | null;
  workspaceId: string | null;
}
export interface AccessBinding {
  uid?: string;
  email: string;
  workspaceId: string;
  role: 'ADMIN' | 'MEMBER';
  active: boolean;
}
const keyId = (value: string) =>
  `access-key:${createHash('sha256')
    .update(
      value
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, ''),
    )
    .digest('hex')}`;
export function addMonths(date: Date, months: number) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const last = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, last));
  return result;
}
export class AccessService {
  constructor(
    private readonly db: PrismaClient,
    private readonly now = () => new Date(),
  ) {}
  assertOwner(account: AccessAccount) {
    if (account.email.toLowerCase() !== PLATFORM_OWNER)
      throw new AppError(403, 'Somente o proprietário da plataforma pode gerenciar chaves.');
  }
  async create(account: AccessAccount, raw: unknown) {
    this.assertOwner(account);
    const input = keyInput.parse(raw);
    const secret = `NOCTUA-${randomBytes(20)
      .toString('hex')
      .toUpperCase()
      .match(/.{1,8}/g)!
      .join('-')}`;
    const data: AccessKey = {
      ...input,
      intendedEmail: input.intendedEmail.toLowerCase(),
      suffix: secret.slice(-6),
      createdAt: this.now().toISOString(),
      createdBy: account.uid,
      activatedAt: null,
      activatedBy: null,
      workspaceId: null,
      revokedAt: null,
    };
    const row = await this.db.operationRecord.create({
      data: { id: keyId(secret), kind: 'ACCESS_KEY', data: { ...data } },
    });
    return { id: row.id, secret, ...data };
  }
  async list(account: AccessAccount) {
    this.assertOwner(account);
    const [keys, spaces] = await Promise.all([
      this.db.operationRecord.findMany({ where: { kind: 'ACCESS_KEY' }, orderBy: { createdAt: 'desc' } }),
      this.db.operationRecord.findMany({ where: { kind: 'ACCESS_WORKSPACE' } }),
    ]);
    const workspaces = new Map(spaces.map((row) => [row.id, row.data as unknown as AccessWorkspace]));
    return keys.map((row) => {
      const data = row.data as unknown as AccessKey;
      const workspace = data.workspaceId ? workspaces.get(`workspace:${data.workspaceId}`) : undefined;
      return {
        id: row.id,
        ...data,
        activatedEmail: workspace?.ownerEmail ?? null,
        expiresAt: workspace?.expiresAt ?? null,
        activeLicense: workspace ? !workspace.revokedAt && new Date(workspace.expiresAt) > this.now() : false,
        status: data.revokedAt ? 'REVOKED' : data.activatedAt ? 'ACTIVATED' : 'AVAILABLE',
      };
    });
  }
  async workspace(id: string) {
    const row = await this.db.operationRecord.findFirst({
      where: { id: `workspace:${id}`, kind: 'ACCESS_WORKSPACE' },
    });
    return row ? (row.data as unknown as AccessWorkspace) : null;
  }
  async assertActive(id: string) {
    if (id === 'owner') return;
    const workspace = await this.workspace(id);
    if (!workspace || workspace.revokedAt || new Date(workspace.expiresAt) <= this.now())
      throw new AppError(402, 'Seu acesso expirou ou foi suspenso. Ative uma nova chave para continuar.', {
        code: 'ACTIVATION_REQUIRED',
      });
  }
  async binding(account: AccessAccount) {
    const row = await this.db.operationRecord.findUnique({ where: { id: `access-user:${account.uid}` } });
    if (row) return row.data as unknown as AccessBinding;
    const invited = await this.db.operationRecord.findUnique({
      where: { id: `access-member:${account.email.toLowerCase()}` },
    });
    return invited ? (invited.data as unknown as AccessBinding) : null;
  }
  async status(account: AccessAccount) {
    if (account.email.toLowerCase() === PLATFORM_OWNER)
      return { allowed: true, platformOwner: true, workspaceId: 'owner', expiresAt: null };
    const binding = await this.binding(account);
    const workspace = binding ? await this.workspace(binding.workspaceId) : null;
    return {
      allowed: Boolean(
        binding?.active && workspace && !workspace.revokedAt && new Date(workspace.expiresAt) > this.now(),
      ),
      platformOwner: false,
      workspaceId: binding?.workspaceId ?? null,
      expiresAt: workspace?.expiresAt ?? null,
      suspended: Boolean(workspace?.revokedAt),
    };
  }
  async activate(account: AccessAccount, raw: unknown) {
    if (account.email.toLowerCase() === PLATFORM_OWNER)
      throw new AppError(409, 'O proprietário não precisa de chave de ativação.');
    const { key } = z.object({ key: z.string().trim().min(20).max(100) }).parse(raw);
    return retryDatabaseOperation(() =>
      this.db.$transaction(
        async (tx) => {
          const row = await tx.operationRecord.findFirst({ where: { id: keyId(key), kind: 'ACCESS_KEY' } });
          if (!row) throw new AppError(422, 'Chave inválida. Confira o código recebido.');
          const code = row.data as unknown as AccessKey;
          if (code.revokedAt)
            throw new AppError(422, 'Esta chave foi revogada. Solicite outra ao administrador.');
          if (code.activatedAt)
            throw new AppError(409, 'Esta chave já foi utilizada. Cada chave ativa uma única conta.');
          if (code.intendedEmail && code.intendedEmail !== account.email.toLowerCase())
            throw new AppError(403, 'Esta chave foi reservada para outro e-mail.');
          const member = await tx.operationRecord.findUnique({
            where: { id: `access-member:${account.email.toLowerCase()}` },
          });
          if (member && (member.data as unknown as AccessBinding).active)
            throw new AppError(
              409,
              'Esta conta já é atendente de outra operação. Use uma conta separada para criar sua empresa.',
            );
          const oldBinding = await tx.operationRecord.findUnique({
            where: { id: `access-user:${account.uid}` },
          });
          const binding = oldBinding?.data as unknown as AccessBinding | undefined;
          const id = binding?.workspaceId ?? randomUUID();
          const old = await tx.operationRecord.findUnique({ where: { id: `workspace:${id}` } });
          const previous = old?.data as unknown as AccessWorkspace | undefined;
          const now = this.now();
          const base =
            previous && !previous.revokedAt && new Date(previous.expiresAt) > now
              ? new Date(previous.expiresAt)
              : now;
          const expiresAt = code.months
            ? addMonths(base, code.months)
            : new Date(base.getTime() + code.trialDays! * 86400000);
          const workspace: AccessWorkspace = {
            id,
            ownerUid: account.uid,
            ownerEmail: account.email.toLowerCase(),
            expiresAt: expiresAt.toISOString(),
            revokedAt: null,
            currentKeyId: row.id,
            createdAt: previous?.createdAt ?? now.toISOString(),
          };
          const changed = await tx.operationRecord.updateMany({
            where: { id: row.id, updatedAt: row.updatedAt },
            data: {
              data: { ...code, activatedAt: now.toISOString(), activatedBy: account.uid, workspaceId: id },
            },
          });
          if (changed.count !== 1)
            throw new AppError(409, 'A chave acabou de ser utilizada. Confira sua ativação.');
          await tx.operationRecord.upsert({
            where: { id: `workspace:${id}` },
            create: { id: `workspace:${id}`, kind: 'ACCESS_WORKSPACE', data: { ...workspace } },
            update: { data: { ...workspace } },
          });
          const data = {
            uid: account.uid,
            email: account.email.toLowerCase(),
            workspaceId: id,
            role: 'ADMIN',
            active: true,
          };
          await tx.operationRecord.upsert({
            where: { id: `access-user:${account.uid}` },
            create: { id: `access-user:${account.uid}`, kind: 'ACCESS_ACCOUNT', data },
            update: { data },
          });
          return workspace;
        },
        { maxWait: 30000, timeout: 30000 },
      ),
    );
  }
  async revoke(account: AccessAccount, id: string) {
    this.assertOwner(account);
    await this.db.$transaction(async (tx) => {
      const row = await tx.operationRecord.findFirst({ where: { id, kind: 'ACCESS_KEY' } });
      if (!row) throw new AppError(404, 'Chave não encontrada.');
      const data = row.data as unknown as AccessKey;
      const revokedAt = this.now().toISOString();
      await tx.operationRecord.update({ where: { id }, data: { data: { ...data, revokedAt } } });
      if (data.workspaceId) {
        const workspaceRow = await tx.operationRecord.findUnique({
          where: { id: `workspace:${data.workspaceId}` },
        });
        const workspace = workspaceRow?.data as unknown as AccessWorkspace | undefined;
        if (workspace?.currentKeyId === id)
          await tx.operationRecord.update({
            where: { id: workspaceRow!.id },
            data: { data: { ...workspace, revokedAt } },
          });
      }
    });
  }
}
