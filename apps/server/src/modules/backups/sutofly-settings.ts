import type { Prisma } from '@prisma/client';
import { json, phone } from './validation.js';
import type { SutoflyConversion } from './sutofly.js';
import { AppError } from '../../shared/errors.js';
export async function importSutoflySettings(
  tx: Prisma.TransactionClient,
  conversion: SutoflyConversion,
  hash: string,
  selectedSession?: string,
) {
  const session = selectedSession
    ? await tx.whatsappSession.findUnique({ where: { id: selectedSession } })
    : await tx.whatsappSession.findFirst({ orderBy: { createdAt: 'asc' } });
  if (selectedSession && !session)
    throw new AppError(422, 'A conexão escolhida para os agendamentos não existe.');
  const savedContacts = new Set<string>();
  const contactFor = async (value: string, name?: string) => {
    const phoneNumber = phone(value.split('@')[0]!);
    const contact = await tx.contact.upsert({
      where: { phoneNumber },
      create: { phoneNumber, name: name || phoneNumber, whatsappJid: `${phoneNumber}@s.whatsapp.net` },
      update: {},
    });
    savedContacts.add(contact.id);
    await tx.whatsappIdentity.upsert({
      where: { jid: `${phoneNumber}@s.whatsapp.net` },
      create: { jid: `${phoneNumber}@s.whatsapp.net`, contactId: contact.id },
      update: {},
    });
    return contact;
  };
  for (const raw of conversion.contacts)
    await contactFor(
      String(raw.phoneNumber ?? raw.id ?? ''),
      typeof raw.name === 'string' ? raw.name : undefined,
    );
  for (const key of conversion.pixKeys)
    await tx.pixKey.upsert({
      where: { id: String(key.id) },
      create: {
        id: String(key.id),
        name: String(key.name),
        type: String(key.type),
        value: String(key.value),
        merchantName: String(key.merchantName),
        merchantCity: '',
      },
      update: {},
    });
  await tx.operationRecord.upsert({
    where: { id: `sutofly-settings:${hash}` },
    create: {
      id: `sutofly-settings:${hash}`,
      kind: 'IMPORTED_SETTINGS',
      data: json({ source: 'Sutofly', settings: conversion.settings, preferences: conversion.preferences }),
    },
    update: {},
  });
  if (conversion.settings.backupAutomatico) {
    const previous = await tx.operationRecord.findUnique({ where: { id: 'settings:backups' } });
    const original = conversion.settings.backupAutomatico as { time?: string };
    const previousData = previous?.data as { automatic?: boolean; [key: string]: unknown } | undefined;
    const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(original.time ?? '') ? original.time : '00:00';
    const data = json({
      ...previousData,
      automatic: previousData?.automatic ?? false,
      time,
      importedConfiguration: conversion.settings.backupAutomatico,
    });
    await tx.operationRecord.upsert({
      where: { id: 'settings:backups' },
      create: { id: 'settings:backups', kind: 'SETTINGS', data },
      update: { data },
    });
    conversion.warnings.push(
      'A configuração de backup automático foi preservada. Confira e ative as cópias do Noctua nas configurações.',
    );
  }
  let schedules = 0;
  for (const raw of conversion.schedules) {
    const batchId = `sutofly:schedule:${String(raw.id)}`;
    const date = String(raw.data ?? ''),
      time = String(raw.hora ?? '');
    const runAt = new Date(`${date}T${time}:00-03:00`);
    if (!Number.isFinite(runAt.getTime()))
      throw new AppError(422, 'O backup contém um agendamento com data inválida.');
    const contact = await contactFor(String(raw.userID ?? ''));
    const batch = {
      name: String(raw.titulo ?? 'Agendamento importado'),
      sessionId: session?.id ?? '',
      status: 'DRAFT',
      mode: 'SCHEDULE',
      minSeconds: 15,
      maxSeconds: 45,
      count: 1,
      createdAt: new Date().toISOString(),
      importedFrom: 'Sutofly',
      source: raw,
      needsConnection: !session,
    };
    const existing = await tx.operationRecord.findUnique({ where: { id: batchId } });
    if (existing) {
      schedules++;
      continue;
    }
    await tx.operationRecord.create({
      data: { id: batchId, kind: session ? 'BATCH' : 'IMPORTED_SCHEDULE', data: json(batch) },
    });
    if (session) {
      const chat = await tx.conversation.upsert({
        where: { sessionId_contactId: { sessionId: session.id, contactId: contact.id } },
        create: { sessionId: session.id, contactId: contact.id },
        update: {},
      });
      const text = String(raw.mensagem ?? '');
      if (raw.tipo === 'txt' && text)
        await tx.deliveryTask.create({
          data: {
            batchId,
            sessionId: session.id,
            conversationId: chat.id,
            runAt,
            payload: { kind: 'text', text },
          },
        });
      else
        conversion.warnings.push(
          'Um agendamento não textual foi preservado para revisão, sem criar um envio.',
        );
    }
    schedules++;
  }
  if (schedules)
    conversion.warnings.push(
      `${schedules} agendamentos preservados como rascunhos, sem ativar envios. Confira datas passadas, recorrência e conexão antes de ativar.`,
    );
  return {
    schedules,
    contacts: savedContacts.size,
    pixKeys: conversion.pixKeys.length,
    fields: Object.keys(conversion.settings).filter((key) => conversion.settings[key] !== undefined),
  };
}
