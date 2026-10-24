import { Router, json } from 'express';
import { uploadRoutes } from './upload.js';
import type { PrismaClient } from '@prisma/client';
import { backupController } from './backup.controller.js';

export function backupRoutes(db: PrismaClient) {
  const router = Router();
  const controller = backupController(db);
  router.use(uploadRoutes(db));
  router.post('/import', json({ limit: Number.MAX_SAFE_INTEGER }), controller.importBackup);
  router.get('/export', controller.exportBackup);
  router.get('/imports', controller.listImports);
  router.get('/imports/:id/original', controller.original);
  return router;
}
