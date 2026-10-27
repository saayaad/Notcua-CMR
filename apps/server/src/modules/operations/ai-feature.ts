import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors.js';
import { json } from '../backups/validation.js';
import { record } from './records.js';

export async function aiFeatureEnabled(db: PrismaClient) {
  return (await record(db, 'settings:features', { aiEnabled: false })).aiEnabled === true;
}

export async function requireAiFeature(db: PrismaClient) {
  if (!(await aiFeatureEnabled(db))) throw new AiFeatureDisabled();
}
export class AiFeatureDisabled extends AppError {
  constructor() {
    super(403, 'A I.A. está desabilitada. Habilite em Configurações → Integração de IA.');
  }
}

export async function setAiFeature(db: PrismaClient, aiEnabled: boolean) {
  await db.$transaction(async (tx) => {
    const old = await tx.operationRecord.findUnique({ where: { id: 'settings:features' } });
    const previous = (old?.data ?? {}) as { aiEnabled?: boolean };
    await tx.operationRecord.upsert({
      where: { id: 'settings:features' },
      create: { id: 'settings:features', kind: 'FEATURES', data: { aiEnabled } },
      update: { data: json({ ...previous, aiEnabled }) },
    });
    if (!aiEnabled || !previous.aiEnabled) {
      const config = await tx.operationRecord.findUnique({ where: { id: 'integration:ai' } });
      if (config)
        await tx.operationRecord.update({
          where: { id: config.id },
          data: { data: json({ ...(config.data as object), enabled: false, enabledAt: undefined }) },
        });
    }
  });
}
