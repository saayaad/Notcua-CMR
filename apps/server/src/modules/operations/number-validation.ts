import { createHash } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import type { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { SerialQueue } from '../../shared/serial-queue.js';
import { AppError } from '../../shared/errors.js';
import { putRecord, record } from './records.js';

type Result = {
  phoneNumber: string;
  status: 'REGISTERED' | 'NOT_REGISTERED' | 'UNKNOWN';
  canonicalPhone?: string;
  checkedAt: string;
  cached?: boolean;
};
export function numberValidationRoutes(db: PrismaClient, whatsapp: WhatsappService) {
  const router = Router();
  const queue = new SerialQueue();
  let lastQuery = 0;
  router.post('/sessions/:sessionId/validate-numbers', async (req, res) => {
    if (res.locals.identity.role !== 'ADMIN')
      throw new AppError(403, 'Apenas administradores podem validar listas de números.');
    const { phoneNumbers } = z
      .object({
        phoneNumbers: z
          .array(z.string().regex(/^\d{8,15}$/))
          .min(1)
          .max(20),
      })
      .parse(req.body);
    const sessionId = String(req.params.sessionId);
    await whatsapp.snapshot(sessionId);
    const items: Result[] = [];
    await queue.run(async () => {
      for (const phoneNumber of new Set(phoneNumbers)) {
        if (res.destroyed) break;
        const key = `wa-number:${sessionId}:${createHash('sha256').update(phoneNumber).digest('hex')}`;
        const cached = await record<Result | null>(db, key, null);
        const ttl = cached?.status === 'REGISTERED' ? 24 * 60 * 60_000 : 60 * 60_000;
        if (cached && Date.now() - new Date(cached.checkedAt).getTime() < ttl) {
          items.push({ ...cached, cached: true });
          continue;
        }
        const socket = whatsapp.connectedSocket(sessionId);
        if (!socket.onWhatsApp) throw new AppError(503, 'Esta conexão não oferece consulta de números.');
        const delay = 250 - (Date.now() - lastQuery);
        if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
        lastQuery = Date.now();
        let result: Result = { phoneNumber, status: 'UNKNOWN', checkedAt: new Date().toISOString() };
        try {
          const found = await socket.onWhatsApp(phoneNumber);
          if (Array.isArray(found)) {
            const registered = found.find((item) => item.exists);
            result = {
              ...result,
              status: registered ? 'REGISTERED' : 'NOT_REGISTERED',
              ...(registered?.jid?.endsWith('@s.whatsapp.net')
                ? { canonicalPhone: registered.jid.split('@')[0]!.split(':')[0] }
                : {}),
            };
            await putRecord(db, key, 'WHATSAPP_NUMBER_CHECK', result);
          }
        } catch {
          /* An unavailable lookup must never classify a valid contact as absent. */
        }
        items.push(result);
        if (result.status === 'UNKNOWN') break;
      }
    });
    if (!res.destroyed) res.json({ items, inconclusive: items.some((item) => item.status === 'UNKNOWN') });
  });
  return router;
}
