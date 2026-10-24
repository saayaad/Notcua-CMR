import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { backupController } from './backup.controller.js';

export function backupRoutes(db: PrismaClient) {
  const router = Router();
  const controller = backupController(db);
  router.post('/import', controller.importBackup);
  router.get('/export', controller.exportBackup);
  router.get('/imports', controller.listImports);
  router.get('/imports/:id/original', controller.original);
  return router;
}
