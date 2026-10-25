import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { record, putRecord } from './records.js';
export interface TeamMember {
  email: string;
  name: string;
  department: string;
  role: string;
  active: boolean;
  avatar?: string;
  online?: boolean;
}
export async function teamDirectory(db: PrismaClient) {
  const [rows, presence] = await Promise.all([
    db.operationRecord.findMany({ where: { kind: 'TEAM' } }),
    db.operationRecord.findMany({ where: { kind: 'TEAM_PRESENCE' } }),
  ]);
  const online = new Map(
    presence.map((row) => {
      const data = row.data as { email?: string; seenAt?: string };
      return [data.email, Boolean(data.seenAt && Date.now() - new Date(data.seenAt).getTime() < 90000)];
    }),
  );
  return rows
    .map((row) => row.data as unknown as TeamMember)
    .map((item) => ({
      ...item,
      avatar: item.avatar ?? '',
      online: item.active && Boolean(online.get(item.email)),
    }));
}
export function directoryRoutes(db: PrismaClient) {
  const router = Router();
  router.get('/', async (_req, res) => {
    const items = (await teamDirectory(db)).filter((item) => item.active);
    const identity = res.locals.identity;
    if (identity.email && !items.some((item) => item.email === identity.email))
      items.unshift({
        email: identity.email,
        name: identity.name || identity.email,
        department: '',
        role: identity.role,
        active: true,
        online: true,
        avatar: '',
      });
    const departments = await record<{ items: { name: string }[] }>(db, 'settings:departments', {
      items: [],
    });
    res.json({ items, departments: Array.isArray(departments.items) ? departments.items : [] });
  });
  router.post('/presence', async (_req, res) => {
    const identity = res.locals.identity;
    if (identity.email)
      await putRecord(db, `presence:${identity.email}`, 'TEAM_PRESENCE', {
        email: identity.email,
        seenAt: new Date().toISOString(),
      });
    res.json({ saved: true });
  });
  return router;
}
