import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AccessService, type AccessAccount } from './access.service.js';
import { authorizeAccount, verifyRegisteredToken } from '../../http/auth.js';
import { AppError } from '../../shared/errors.js';

export function accessRoutes(
  db: PrismaClient,
  verify = verifyRegisteredToken,
  onChanged: () => Promise<void> = async () => {},
  resolveAccount = (account: AccessAccount) => authorizeAccount(account, db),
) {
  const router = Router();
  const service = new AccessService(db);
  const attempts = new Map<string, { start: number; count: number }>();
  router.use(async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const account = await verify(req.headers.authorization?.replace(/^Bearer /, ''));
    res.locals.account = account;
    if (req.method !== 'GET') {
      const previous = attempts.get(account.uid);
      const entry =
        previous && Date.now() - previous.start < 60000 ? previous : { start: Date.now(), count: 0 };
      if (++entry.count > 20)
        throw new AppError(429, 'Muitas tentativas. Aguarde um minuto para tentar novamente.');
      attempts.set(account.uid, entry);
      if (attempts.size > 5000)
        for (const [id, value] of attempts) if (Date.now() - value.start > 60000) attempts.delete(id);
    }
    next();
  });
  router.get('/me', async (_req, res) => {
    const account: AccessAccount = res.locals.account;
    let allowed = false;
    let workspaceId: string | null = null;
    try {
      const identity = await resolveAccount(account);
      allowed = true;
      workspaceId = identity.workspaceId ?? 'owner';
    } catch (error) {
      if (!(error instanceof AppError && [402, 403].includes(error.status))) throw error;
    }
    res.json({ ...(await service.status(account)), allowed, workspaceId, email: account.email });
  });
  router.post('/activate', async (req, res) => {
    const workspace = await service.activate(res.locals.account, req.body);
    await onChanged();
    res.json({ activated: true, expiresAt: workspace.expiresAt });
  });
  router.get('/keys', async (_req, res) => res.json({ items: await service.list(res.locals.account) }));
  router.post('/keys', async (req, res) =>
    res.status(201).json(await service.create(res.locals.account, req.body)),
  );
  router.post('/keys/:id/revoke', async (req, res) => {
    await service.revoke(res.locals.account, z.string().max(150).parse(req.params.id));
    await onChanged();
    res.json({ revoked: true });
  });
  return router;
}
