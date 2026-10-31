import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { json } from '../backups/validation.js';
import { AppError } from '../../shared/errors.js';
const command = z.enum([
  'WAIT',
  'ARCHIVE',
  'UNARCHIVE',
  'PIN',
  'UNPIN',
  'MARK_UNREAD',
  'CLEAR_LABELS',
  'TRANSFER',
]);
export function macroRoutes(db: PrismaClient) {
  const router = Router();
  router.get('/:id', async (req, res) => {
    const item = await db.macro.findUnique({
      where: { id: String(req.params.id) },
      include: { actions: { orderBy: { position: 'asc' } } },
    });
    if (!item) throw new AppError(404, 'Macro não encontrada.');
    res.json({
      id: item.id,
      name: item.name,
      actions: item.actions.map((action) => ({
        type:
          (action.payload as { type?: string }).type === 'utility'
            ? 'UTILITY'
            : action.type === 'MEDIA'
              ? 'IMPORTED'
              : action.type,
        actionId: action.id,
        text: action.text ?? '',
        labelId: action.labelId ?? '',
        delayMs: action.waitMs,
        composingMs: action.composingMs,
        ...(action.payload as { editor?: object }).editor,
      })),
    });
  });
  const save = async (raw: unknown, id: string) => {
    const input = z
      .object({
        name: z.string().trim().min(1).max(100),
        actions: z
          .array(
            z.object({
              type: z.enum(['TEXT', 'ASSET', 'ADD_LABEL', 'REMOVE_LABEL', 'UTILITY', 'IMPORTED']),
              actionId: z.string().max(200).default(''),
              text: z.string().max(20000).default(''),
              assetId: z.string().max(200).default(''),
              labelId: z.string().max(200).default(''),
              delayMs: z.number().int().min(0).max(86400000).default(0),
              composingMs: z.number().int().min(0).max(30000).default(0),
              command: command.default('WAIT'),
              target: z.string().max(200).default(''),
              presence: z.enum(['none', 'composing', 'recording']).default('none'),
              asSticker: z.boolean().default(false),
            }),
          )
          .min(1)
          .max(100),
      })
      .parse(raw);
    return db.$transaction(
      async (tx) => {
        const originals = await tx.macroAction.findMany({ where: { macroId: id } });
        await tx.macro.upsert({
          where: { id },
          create: { id, name: input.name },
          update: { name: input.name },
        });
        await tx.macroAction.deleteMany({ where: { macroId: id } });
        for (const [position, action] of input.actions.entries()) {
          if (action.type === 'IMPORTED') {
            const original = originals.find((item) => item.id === action.actionId);
            if (!original) throw new AppError(422, 'Arquivo original da macro indisponível. Reabra a macro.');
            const { id: oldId, macroId: oldMacroId, position: oldPosition, ...copy } = original;
            await tx.macroAction.create({
              data: {
                ...copy,
                macroId: id,
                position,
                waitMs: action.delayMs,
                composingMs: action.composingMs,
                payload: json(original.payload),
              },
            });
            continue;
          }
          let type: 'TEXT' | 'MEDIA' | 'ADD_LABEL' | 'REMOVE_LABEL' = 'TEXT';
          let text = action.text;
          let fileId: string | undefined;
          let labelId: string | undefined;
          let payload: Record<string, unknown> = { type: 'txt', text, editor: action };
          if (action.type === 'TEXT' && !text.trim())
            throw new AppError(422, 'Escreva o texto de cada ação.');
          if (action.type === 'ASSET') {
            const asset = await tx.asset.findUnique({
              where: { id: action.assetId },
              include: { file: true },
            });
            if (!asset) throw new AppError(422, 'Escolha um recurso da biblioteca.');
            if (action.asSticker && (asset.kind !== 'MEDIA' || asset.file?.mimeType !== 'image/webp'))
              throw new AppError(422, 'A figurinha deve ser uma imagem WebP da Biblioteca.');
            text = asset.text ?? asset.caption ?? '';
            fileId = asset.fileId ?? undefined;
            type = asset.kind === 'MESSAGE' ? 'TEXT' : 'MEDIA';
            payload = {
              type: type === 'TEXT' ? 'txt' : 'media',
              text,
              base64: asset.file ? Buffer.from(asset.file.data).toString('base64') : undefined,
              mimeType: asset.file?.mimeType,
              filename: asset.file?.filename,
              editor: action,
              send: {
                kind:
                  action.asSticker
                    ? 'sticker'
                    : asset.kind === 'MESSAGE'
                    ? 'text'
                    : asset.kind === 'AUDIO'
                      ? 'audio'
                      : asset.kind === 'DOCUMENT'
                        ? 'document'
                        : asset.file?.mimeType.startsWith('video/')
                          ? 'video'
                          : 'image',
                text: asset.text ?? undefined,
                caption: asset.caption ?? undefined,
                isPtt: asset.isPtt,
                isPtv: asset.isPtv,
                asViewOnce: asset.asViewOnce,
              },
            };
          }
          if (action.type === 'ADD_LABEL' || action.type === 'REMOVE_LABEL') {
            if (!(await tx.label.findFirst({ where: { id: action.labelId, isDeleted: false } })))
              throw new AppError(422, 'Escolha uma etiqueta válida.');
            type = action.type;
            labelId = action.labelId;
            payload = {
              type: type === 'ADD_LABEL' ? 'addLabel' : 'removeLabel',
              labelID: labelId,
              editor: action,
            };
          }
          if (action.type === 'UTILITY')
            payload = {
              type: 'utility',
              command: action.command,
              target: action.target,
              presence: action.presence,
              editor: action,
            };
          await tx.macroAction.create({
            data: {
              macroId: id,
              position,
              type,
              text: text || null,
              fileId,
              labelId,
              waitMs: action.delayMs,
              composingMs: action.composingMs,
              payload: json(payload),
            },
          });
        }
        return { id, name: input.name };
      },
      { timeout: 30000 },
    );
  };
  router.post('/', async (req, res) => res.status(201).json(await save(req.body, `macro:${randomUUID()}`)));
  router.put('/:id', async (req, res) =>
    res.json(await save(req.body, z.string().max(200).parse(req.params.id))),
  );
  return router;
}
