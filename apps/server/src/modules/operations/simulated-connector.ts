import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { json } from '../backups/validation.js';

// Deliberately has no socket, credential or network dependency.
export const simulationEnabled = () =>
  env.NODE_ENV !== 'production' && env.AUTH_MODE === 'local' && process.env.AUDIT_SIMULATED_CONNECTOR === '1';
const text = z.string().trim().min(1).max(200);
export const simulatedAction = z.discriminatedUnion('format', [
  z.object({
    format: z.literal('GROUP_INVITE'),
    groupId: z.string().regex(/^audit-group-[a-z0-9-]+$/),
    title: text,
    invitation: z.string().regex(/^audit-invite-[a-z0-9-]+$/),
  }),
  z.object({ format: z.literal('VCARD'), name: text, phone: z.string().regex(/^55110000\d{5}$/) }),
  z
    .object({
      format: z.literal('INTERACTIVE_LIST'),
      title: text,
      button: text,
      rows: z
        .array(z.object({ id: text, title: text }))
        .min(1)
        .max(10),
    })
    .refine(
      (action) => new Set(action.rows.map((row) => row.id)).size === action.rows.length,
      'IDs das opções devem ser únicos.',
    ),
]);

export function validateSimulation(raw: unknown) {
  if (!simulationEnabled())
    throw new AppError(403, 'Conector simulado disponível somente na auditoria local autorizada.');
  return simulatedAction.parse(raw);
}

export function simulatedPayload(raw: unknown) {
  const action = validateSimulation(raw);
  if (action.format === 'GROUP_INVITE')
    return {
      groupInviteMessage: {
        groupJid: `${action.groupId}@g.us`,
        groupName: action.title,
        inviteCode: action.invitation,
      },
    };
  if (action.format === 'VCARD') {
    const name = action.name
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n/g, '\\n')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,');
    return {
      contacts: {
        displayName: action.name,
        contacts: [
          {
            vcard: `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:${name}\r\nTEL;TYPE=CELL;waid=${action.phone}:+${action.phone}\r\nEND:VCARD`,
          },
        ],
      },
    };
  }
  return {
    listMessage: {
      title: action.title,
      buttonText: action.button,
      listType: 1,
      sections: [
        { title: 'Opções fictícias', rows: action.rows.map((row) => ({ rowId: row.id, title: row.title })) },
      ],
    },
  };
}

export function simulatedConnectorRoutes(db: PrismaClient) {
  const router = Router();
  router.get('/capabilities', (_req, res) =>
    res.json({
      simulated: simulationEnabled(),
      formats: simulationEnabled() ? ['GROUP_INVITE', 'VCARD', 'INTERACTIVE_LIST'] : [],
    }),
  );
  router.post('/sessions/:sessionId/macros/:macroId', async (req, res) => {
    if (!simulationEnabled()) throw new AppError(403, 'Conector simulado desativado.');
    if (res.locals.identity?.role !== 'ADMIN')
      throw new AppError(403, 'Esta ação exige acesso de administrador.');
    const sessionId = z.string().startsWith('audit-').max(200).parse(req.params.sessionId);
    const requestId = z
      .string()
      .regex(/^audit-[a-zA-Z0-9-]+$/)
      .max(100)
      .parse(req.body.requestId);
    const session = await db.whatsappSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new AppError(404, 'Sessão fictícia não encontrada.');
    const macroId = String(req.params.macroId);
    const macro = await db.macro.findUnique({
      where: { id: macroId },
      include: { actions: { orderBy: { position: 'asc' } } },
    });
    if (!macro?.actions.length) throw new AppError(404, 'Macro fictícia não encontrada.');
    const actions = macro.actions.map((action) => {
      const payload = action.payload as { type?: string; simulation?: unknown };
      if (payload.type !== 'simulated')
        throw new AppError(422, 'A simulação aceita apenas ações do conector fictício.');
      return validateSimulation(payload.simulation);
    });
    const id = `audit-connector:${sessionId}:${requestId}`;
    const receipt = await db.$transaction(async (tx) => {
      const existing = await tx.operationRecord.findUnique({ where: { id } });
      if (existing) {
        const data = existing.data as { macroId?: string; actions?: unknown };
        if (data.macroId !== macroId || JSON.stringify(data.actions) !== JSON.stringify(actions))
          throw new AppError(409, 'Identificador de simulação já utilizado com outro conteúdo.');
        return existing.data;
      }
      const data = json({
        id: randomUUID(),
        sessionId,
        macroId,
        actions,
        payloads: actions.map(simulatedPayload),
        result: 'SIMULATED',
        externalMessages: 0,
        createdAt: new Date().toISOString(),
      });
      await tx.operationRecord.create({ data: { id, kind: 'AUDIT_CONNECTOR_RECEIPT', data } });
      return data;
    });
    res.json(receipt);
  });
  return router;
}
