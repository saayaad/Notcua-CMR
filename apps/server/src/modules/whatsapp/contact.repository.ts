import { jidNormalizedUser } from '@whiskeysockets/baileys';
import type { Contact, Prisma, PrismaClient } from '@prisma/client';

export type Tx = Prisma.TransactionClient;

export function normalizedJid(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const jid = jidNormalizedUser(value);
  return /^(?:\d+@(?:s\.whatsapp\.net|lid)|[\d-]+@g\.us)$/.test(jid) ? jid : undefined;
}

async function mergeContacts(tx: Tx, from: Contact, into: Contact): Promise<void> {
  const labels = await tx.contactLabel.findMany({ where: { contactId: from.id } });
  for (const label of labels) {
    const key = { contactId: into.id, labelId: label.labelId };
    await tx.contactLabel.upsert({ where: { contactId_labelId: key }, create: key, update: {} });
  }
  const chats = await tx.conversation.findMany({ where: { contactId: from.id } });
  for (const chat of chats) {
    const target = await tx.conversation.findUnique({
      where: { sessionId_contactId: { sessionId: chat.sessionId, contactId: into.id } },
    });
    if (!target) await tx.conversation.update({ where: { id: chat.id }, data: { contactId: into.id } });
    else {
      const messages = await tx.chatMessage.findMany({
        where: { conversationId: chat.id },
        select: { id: true, whatsappMessageId: true },
      });
      for (const message of messages) {
        const duplicate = message.whatsappMessageId
          ? await tx.chatMessage.findUnique({
              where: {
                conversationId_whatsappMessageId: {
                  conversationId: target.id,
                  whatsappMessageId: message.whatsappMessageId,
                },
              },
            })
          : null;
        if (!duplicate)
          await tx.chatMessage.update({ where: { id: message.id }, data: { conversationId: target.id } });
      }
      const lastMessageAt = [chat.lastMessageAt, target.lastMessageAt]
        .filter((d): d is Date => d !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      const firstInboundAt = [chat.firstInboundAt, target.firstInboundAt]
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime())[0];
      await tx.conversation.update({
        where: { id: target.id },
        data: {
          lastMessageAt,
          firstInboundAt,
          hasHistory: chat.hasHistory || target.hasHistory,
          unreadCount: Math.max(chat.unreadCount, target.unreadCount),
        },
      });
      await tx.conversation.delete({ where: { id: chat.id } });
    }
  }
  await tx.deal.updateMany({ where: { contactId: from.id }, data: { contactId: into.id } });
  await tx.flowExecution.updateMany({ where: { contactId: from.id }, data: { contactId: into.id } });
  await tx.funnelExecution.updateMany({ where: { contactId: from.id }, data: { contactId: into.id } });
  await tx.macroExecution.updateMany({ where: { contactId: from.id }, data: { contactId: into.id } });
  await tx.whatsappIdentity.updateMany({ where: { contactId: from.id }, data: { contactId: into.id } });
  const firstInboundAt = [from.firstInboundAt, into.firstInboundAt]
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  await tx.contact.delete({ where: { id: from.id } });
  await tx.contact.update({
    where: { id: into.id },
    data: {
      firstInboundAt,
      profilePicture: into.profilePicture ?? from.profilePicture,
      isSavedContact: into.isSavedContact || from.isSavedContact,
    },
  });
}

export interface IdentityInput {
  jid: string;
  alternateJid?: string | null;
  name?: string | null;
  saved?: boolean;
}

export async function resolveContact(tx: Tx, input: IdentityInput): Promise<Contact | undefined> {
  const jid = normalizedJid(input.jid);
  if (!jid) return undefined;
  const alternate = normalizedJid(input.alternateJid);
  const jids = [...new Set([jid, alternate].filter((v): v is string => Boolean(v)))];
  const pn = jids.find((j) => j.endsWith('@s.whatsapp.net'))?.split('@')[0];
  const identities = await tx.whatsappIdentity.findMany({
    where: { jid: { in: jids } },
    include: { contact: true },
  });
  const legacy = await tx.contact.findMany({
    where: { OR: [{ whatsappJid: { in: jids } }, ...(pn ? [{ phoneNumber: pn }] : [])] },
  });
  const candidates = [
    ...new Map([...identities.map((i) => i.contact), ...legacy].map((c) => [c.id, c])).values(),
  ];
  let contact = candidates.find((c) => c.phoneNumber === pn) ?? candidates[0];
  if (contact) {
    for (const other of candidates) if (other.id !== contact.id) await mergeContacts(tx, other, contact);
    contact = await tx.contact.update({
      where: { id: contact.id },
      data: {
        ...(pn ? { phoneNumber: pn } : {}),
        ...(input.name && (!contact.isSavedContact || input.saved) ? { name: input.name } : {}),
        ...(input.saved === undefined ? {} : { isSavedContact: input.saved || contact.isSavedContact }),
      },
    });
  } else {
    const phoneNumber = pn ?? `${jid.endsWith('@g.us') ? 'group' : 'lid'}:${jid}`;
    contact = await tx.contact.create({
      data: {
        phoneNumber,
        whatsappJid: jid,
        name: input.name || (pn ?? 'Contato WhatsApp'),
        isGroup: jid.endsWith('@g.us'),
        isSavedContact: input.saved ?? false,
      },
    });
  }
  for (const alias of jids)
    await tx.whatsappIdentity.upsert({
      where: { jid: alias },
      create: { jid: alias, contactId: contact.id },
      update: { contactId: contact.id },
    });
  return contact;
}

export class ContactRepository {
  constructor(private readonly db: PrismaClient) {}
  resolve(input: IdentityInput) {
    return this.db.$transaction((tx) => resolveContact(tx, input), { timeout: 30_000 });
  }
}
