import type { Prisma } from '@prisma/client';
import { queueLabelChange } from '../whatsapp/label-changes.js';
import { AppError } from '../../shared/errors.js';
export async function labelAtStart(
  tx: Prisma.TransactionClient,
  sessionId: string,
  contactId: string,
  labelId: string | undefined,
) {
  if (!labelId) return;
  const label = await tx.label.findFirst({
    where: { id: labelId, isDeleted: false, OR: [{ sessionId }, { sessionId: null }] },
  });
  if (!label) throw new AppError(422, 'A etiqueta inicial do fluxo não está disponível nesta conexão.');
  await tx.contactLabel.upsert({
    where: { contactId_labelId: { contactId, labelId } },
    create: { contactId, labelId },
    update: {},
  });
  const contact = await tx.contact.findUniqueOrThrow({ where: { id: contactId } });
  if (label.whatsappId && contact.whatsappJid)
    await queueLabelChange(tx, {
      sessionId,
      contactId,
      labelId,
      whatsappId: label.whatsappId,
      jid: contact.whatsappJid,
      active: true,
    });
}
