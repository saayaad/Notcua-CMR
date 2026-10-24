import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';

export interface LabelChange {
  sessionId: string;
  contactId: string;
  labelId: string;
  jid: string;
  whatsappId: string;
  active: boolean;
}
export async function queueLabelChange(tx: Prisma.TransactionClient, change: LabelChange) {
  const jobs = await tx.scheduledJob.findMany({
    where: { type: 'WHATSAPP_SET_LABEL', status: { in: ['QUEUED', 'RUNNING', 'FAILED'] } },
    select: { id: true, payload: true },
  });
  const previous = jobs.filter(({ payload }) => {
    const data = payload as unknown as LabelChange;
    return (
      data.sessionId === change.sessionId &&
      data.contactId === change.contactId &&
      data.labelId === change.labelId
    );
  });
  if (previous.length)
    await tx.scheduledJob.updateMany({
      where: { id: { in: previous.map((job) => job.id) } },
      data: { status: 'CANCELLED', lockedAt: null },
    });
  await tx.scheduledJob.create({
    data: {
      type: 'WHATSAPP_SET_LABEL',
      deduplicationKey: `label-change:${randomUUID()}`,
      payload: { ...change },
      runAt: new Date(),
      maxAttempts: 5,
    },
  });
}
