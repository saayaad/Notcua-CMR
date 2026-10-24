import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, readFile, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { BackupService } from './backup.service.js';
import { putRecord } from '../operations/records.js';
import { AppError } from '../../shared/errors.js';
import { SerialQueue } from '../../shared/serial-queue.js';
const imports = new SerialQueue();
export function uploadRoutes(db: PrismaClient) {
  const router = Router();
  const owner = randomUUID();
  const service = new BackupService(db);
  const liveJobs = new Map<string, Record<string, unknown>>();
  const saveJob = async (id: string, data: Record<string, unknown>) => {
    liveJobs.set(id, data);
    if (liveJobs.size > 100)
      for (const [key, value] of liveJobs) {
        if (['COMPLETED', 'FAILED'].includes(String(value.status))) {
          liveJobs.delete(key);
          break;
        }
      }
    await putRecord(db, id, 'BACKUP_JOB', data);
  };
  router.post('/upload', async (req, res) => {
    if (
      !['application/json', 'application/octet-stream'].includes(
        req.headers['content-type']?.split(';')[0] ?? '',
      )
    )
      throw new AppError(415, 'Selecione um arquivo JSON de backup.');
    const sourceHeader = z
      .string()
      .max(1500)
      .parse(req.headers['x-backup-name'] ?? 'backup.json');
    let filename: string;
    try {
      filename = decodeURIComponent(sourceHeader).slice(0, 180);
    } catch {
      throw new AppError(422, 'Nome do arquivo inválido.');
    }
    const sessionId = z.string().max(200).optional().parse(req.query.sessionId);
    if (sessionId && !(await db.whatsappSession.findUnique({ where: { id: sessionId } })))
      throw new AppError(422, 'A conexão selecionada não existe.');
    const directory = await mkdtemp(join(tmpdir(), 'noctua-backup-upload-'));
    const path = join(directory, 'backup.json');
    const id = `backup-job:${randomUUID()}`;
    try {
      await pipeline(req, createWriteStream(path, { flags: 'wx' }));
    } catch (error) {
      await rm(path, { force: true }).catch(() => undefined);
      await rmdir(directory).catch(() => undefined);
      throw error;
    }
    try {
      await saveJob(id, {
        status: 'QUEUED',
        owner,
        filename,
        phase: 'Arquivo recebido. Aguardando importação.',
      });
    } catch (error) {
      liveJobs.delete(id);
      await rm(path, { force: true }).catch(() => undefined);
      await rmdir(directory).catch(() => undefined);
      throw error;
    }
    res.status(202).json({ id });
    void imports
      .run(async () => {
        try {
          await saveJob(id, {
            status: 'RUNNING',
            owner,
            filename,
            phase: 'Lendo e convertendo o backup. Mantenha o servidor ligado.',
          });
          let input: unknown;
          try {
            input = JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
          } catch (error) {
            throw new AppError(
              422,
              error instanceof RangeError
                ? 'O arquivo excede a memória disponível do servidor. Use uma máquina com mais memória ou divida o backup na origem.'
                : 'O arquivo não contém um JSON válido.',
            );
          }
          const report = await service.import(input, filename, { sessionId });
          await saveJob(id, { status: 'COMPLETED', owner, filename, report }).catch(() => undefined);
        } catch (error) {
          await saveJob(id, {
            status: 'FAILED',
            owner,
            filename,
            error:
              error instanceof AppError
                ? error.message
                : 'Não foi possível concluir a importação. O banco anterior foi preservado; confira o formato do arquivo.',
          }).catch(() => undefined);
        } finally {
          await rm(path, { force: true }).catch(() => undefined);
          await rmdir(directory).catch(() => undefined);
        }
      })
      .catch(() => undefined);
  });
  router.get('/jobs/:id', async (req, res) => {
    const live = liveJobs.get(String(req.params.id));
    if (live) {
      const { owner: _owner, ...safe } = live;
      res.json(safe);
      return;
    }
    const row = await db.operationRecord.findFirst({
      where: { id: String(req.params.id), kind: 'BACKUP_JOB' },
    });
    if (!row) throw new AppError(404, 'Importação não encontrada.');
    const data = row.data as { status: string; owner: string; [key: string]: unknown };
    if (data.owner !== owner && ['QUEUED', 'RUNNING'].includes(data.status)) {
      const failed = {
        ...data,
        status: 'FAILED',
        error:
          'O servidor reiniciou durante a importação. Envie novamente o mesmo arquivo para verificar ou concluir sem duplicar os recursos.',
      };
      await putRecord(db, row.id, 'BACKUP_JOB', failed);
      res.json(failed);
      return;
    }
    const { owner: _owner, ...safe } = data;
    res.json(safe);
  });
  return router;
}
