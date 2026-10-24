import type { RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { BackupService } from './backup.service.js';
import { AppError } from '../../shared/errors.js';

export function backupController(db: PrismaClient) {
  const service = new BackupService(db);
  const importBackup: RequestHandler = async (req, res) => {
    const source = z.string().max(180).optional().parse(req.headers['x-backup-name']);
    const report = await service.import(req.body, source);
    res.status(report.duplicate ? 200 : 201).json(report);
  };
  const exportBackup: RequestHandler = async (_req, res) => {
    res.attachment(`noctua-ZV_backup-${new Date().toISOString().slice(0, 10)}.json`).json(await service.export());
  };
  const listImports: RequestHandler = async (_req, res) => {
    const batches = await db.importBatch.findMany({
      take: 100, orderBy: { createdAt: 'desc' },
      select: { id: true, format: true, sourceName: true, createdAt: true, report: true },
    });
    res.json({ items: batches });
  };
  const original: RequestHandler = async (req, res) => {
    const id = z.string().min(1).parse(req.params.id);
    const batch = await db.importBatch.findUnique({ where: { id } });
    if (!batch) throw new AppError(404, 'Importação não encontrada.');
    res.attachment(`original-${batch.id}.json`).json(batch.payload);
  };
  return { importBackup, exportBackup, listImports, original };
}
