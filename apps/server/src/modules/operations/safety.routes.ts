import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import type { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { AppError } from '../../shared/errors.js';
import { createSystemBackup } from './system-backups.js';
import { putRecord } from './records.js';

export async function assertResetIdle(db: PrismaClient) {
  if (await db.whatsappSession.count({ where: { OR: [{ status: { not: 'DISCONNECTED' } }, { autoConnect: true }] } }))
    throw new AppError(409, 'Pause todas as conexões em Conexões antes de resetar.');
  const running = await Promise.all([
    db.deliveryTask.count({ where: { status: 'RUNNING' } }),
    db.sequenceRun.count({ where: { status: 'RUNNING' } }),
    db.scheduledJob.count({ where: { status: 'RUNNING' } }),
  ]);
  if (running.some(Boolean)) throw new AppError(409, 'Aguarde os envios em andamento terminarem antes de resetar.');
}
export async function clearSystem(db: PrismaClient) {
  await assertResetIdle(db);
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('PRAGMA defer_foreign_keys = ON');
    // Static table names; never accept an identifier supplied by the client.
    for (const table of ['ScheduledJob','FlowInboxEvent','FlowExecution','SequenceRun','DeliveryTask','MacroExecution','FunnelExecution','ChatMessage','CrmOpportunity','Deal','Conversation','ContactLabel','WhatsappIdentity','Contact','SessionSettings','WhatsappAuthEntry','FlowNode','FlowVersion','Flow','FunnelItem','Funnel','MacroAction','Macro','Asset','StoredFile','Label','PixKey','ImportBatch','WhatsappSession'])
      await tx.$executeRawUnsafe(`DELETE FROM "${table}"`);
    await tx.operationRecord.deleteMany({ where: { kind: { notIn: ['SYSTEM_BACKUP', 'ACCESS_KEY', 'ACCESS_WORKSPACE', 'ACCESS_ACCOUNT', 'ACCESS_MEMBER'] } } });
  }, { timeout: 60000 });
}
export function safetyRoutes(db: PrismaClient, whatsapp: WhatsappService) {
  const router = Router();
  router.use((_req, res, next) => {
    if (res.locals.identity.role !== 'ADMIN') throw new AppError(403, 'Somente o administrador pode usar a zona de segurança.');
    next();
  });
  router.post('/backup', async (_req,res) => {
    const backup = await createSystemBackup(db);
    const [database,key] = await Promise.all([readFile(backup.database),readFile(backup.key)]);
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Disposition',`attachment; filename="${backup.filename}.json"`);
    res.json({ format:'noctua-system', version:1, createdAt:backup.createdAt, backupId:backup.id,
      encoding:'base64', database:database.toString('base64'), credentialKey:key.toString('base64') });
  });
  router.post('/reset', async(req,res) => {
    const input = z.object({ confirmation:z.literal('EXCLUIR'), backupChoice:z.enum(['downloaded','skip']), backupId:z.string().optional() }).parse(req.body);
    if(input.backupChoice==='downloaded' && (!input.backupId || !await db.operationRecord.findFirst({where:{id:input.backupId,kind:'SYSTEM_BACKUP'}})))
      throw new AppError(422,'Faça o backup completo antes de continuar.');
    await assertResetIdle(db);
    for(const session of await db.whatsappSession.findMany()) await whatsapp.disconnect(session.id);
    await clearSystem(db);
    await putRecord(db,'system:last-reset','RESET_AUDIT',{at:new Date().toISOString(),by:res.locals.identity.email,backupChoice:input.backupChoice});
    res.json({reset:true});
  });
  return router;
}
