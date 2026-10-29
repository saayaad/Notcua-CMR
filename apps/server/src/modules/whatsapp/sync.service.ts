import { requestsHuman, setAiControl } from '../operations/ai-control.js';
import { queueCampaignResponse } from '../operations/campaign-response.js';
import {
  BufferJSON,
  getContentType,
  normalizeMessageContent,
  type BaileysEventMap,
  type Chat,
  type Contact as WaContact,
  type WAMessage,
} from '@whiskeysockets/baileys';
import type { MessageStatus, Prisma, PrismaClient } from '@prisma/client';
import { ContactRepository, normalizedJid, resolveContact } from './contact.repository.js';
import type { WhatsappPublisher } from './whatsapp.types.js';

const labelColors = [
  '#FF9485',
  '#64C4FF',
  '#FFD429',
  '#DFAEFB',
  '#99B7FF',
  '#55CCB3',
  '#FF9DFF',
  '#D3A891',
  '#6CCF9C',
  '#D5A6BD',
  '#85C7D0',
  '#8B9DFB',
  '#FFB65E',
  '#9DD99D',
  '#C2A0DF',
  '#F6C7CB',
  '#A6D5CB',
  '#B9B9B9',
  '#C6D4E0',
  '#F2D083',
];
const realMessageTypes = new Set([
  'conversation',
  'extendedTextMessage',
  'imageMessage',
  'videoMessage',
  'audioMessage',
  'documentMessage',
  'stickerMessage',
  'contactMessage',
  'contactsArrayMessage',
  'locationMessage',
  'liveLocationMessage',
  'buttonsResponseMessage',
  'listResponseMessage',
  'templateButtonReplyMessage',
  'interactiveResponseMessage',
  'pollCreationMessage',
  'pollCreationMessageV2',
  'pollCreationMessageV3',
  'ptvMessage',
]);
const messageStatuses: Record<number, MessageStatus> = {
  0: 'FAILED',
  1: 'PENDING',
  2: 'SENT',
  3: 'DELIVERED',
  4: 'READ',
  5: 'READ',
};

export function messageJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value, BufferJSON.replacer)) as Prisma.InputJsonValue;
}

export function timestamp(value: unknown): Date | undefined {
  const seconds = Number(value);
  const millis = seconds * 1000;
  return Number.isFinite(millis) && millis > 0 && millis < 8_640_000_000_000_000
    ? new Date(millis)
    : undefined;
}

function normalizeOptOut(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function findAdReferral(input: unknown, depth = 0): Record<string, unknown> | null {
  if (!input || typeof input !== 'object' || depth > 6) return null;
  const row = input as Record<string, unknown>;
  for (const key of ['ctwaContext', 'externalAdReply', 'adReplyInfo']) {
    const value = row[key];
    if (value && typeof value === 'object') return value as Record<string, unknown>;
  }
  for (const value of Object.values(row)) {
    const match = findAdReferral(value, depth + 1);
    if (match) return match;
  }
  return null;
}

export class SyncService {
  private readonly contacts: ContactRepository;
  constructor(
    private readonly db: PrismaClient,
    private readonly publisher: WhatsappPublisher,
  ) {
    this.contacts = new ContactRepository(db);
  }

  async contactsUpsert(sessionId: string, entries: Partial<WaContact>[]) {
    let count = 0;
    for (const entry of entries) {
      if (!entry.id) continue;
      const alternate = entry.phoneNumber ?? entry.lid;
      const contact = await this.contacts.resolve({
        jid: entry.id,
        alternateJid: alternate,
        name: entry.name ?? entry.notify ?? entry.verifiedName,
        saved: entry.name ? true : undefined,
      });
      if (!contact) continue;
      if (entry.imgUrl !== undefined && entry.imgUrl !== 'changed') {
        await this.db.contact.update({ where: { id: contact.id }, data: { profilePicture: entry.imgUrl } });
      }
      count++;
    }
    this.publisher.sync({ sessionId, kind: 'contacts', count });
  }

  async mapping(sessionId: string, entry: { lid: string; pn: string }) {
    await this.contacts.resolve({ jid: entry.lid, alternateJid: entry.pn });
    this.publisher.sync({ sessionId, kind: 'identity', count: 1 });
  }

  async chatsUpsert(sessionId: string, entries: Partial<Chat>[], history: boolean) {
    let count = 0;
    for (const entry of entries) {
      if (!entry.id) continue;
      await this.db.$transaction(async (tx) => {
        const contact = await resolveContact(tx, { jid: entry.id!, name: entry.name });
        if (!contact) return;
        const key = { sessionId, contactId: contact.id };
        const previous = await tx.conversation.findUnique({ where: { sessionId_contactId: key } });
        const time = timestamp(entry.conversationTimestamp ?? entry.lastMessageRecvTimestamp);
        const lastMessageAt =
          time && (!previous?.lastMessageAt || time > previous.lastMessageAt) ? time : undefined;
        const unreadCount =
          typeof entry.unreadCount === 'number' ? Math.max(0, entry.unreadCount) : undefined;
        await tx.conversation.upsert({
          where: { sessionId_contactId: key },
          create: { ...key, lastMessageAt, unreadCount, hasHistory: history },
          update: { lastMessageAt, unreadCount, ...(history ? { hasHistory: true } : {}) },
        });
        count++;
      });
    }
    this.publisher.sync({ sessionId, kind: 'chats', count });
  }

  async messagesUpsert(sessionId: string, entries: WAMessage[], live: boolean) {
    let count = 0;
    for (const entry of entries) {
      if (!entry.key.id || !entry.key.remoteJid || !entry.message) continue;
      const protocol = entry.message.protocolMessage;
      if (protocol?.type === 0 && protocol.key?.id) {
        if (!entry.key.fromMe) {
          const jids = [entry.key.remoteJid, entry.key.remoteJidAlt]
            .filter((jid): jid is string => Boolean(jid));
          const original = await this.db.chatMessage.findFirst({
            where: {
              whatsappMessageId: protocol.key.id,
              conversation: {
                sessionId,
                contact: {
                  OR: [
                    { whatsappJid: { in: jids } },
                    { identities: { some: { jid: { in: jids } } } },
                  ],
                },
              },
            },
            select: { id: true, rawPayload: true },
          });
          if (original) {
            const raw = original.rawPayload;
            await this.db.chatMessage.update({
              where: { id: original.id },
              data: {
                rawPayload: {
                  ...(raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}),
                  deletedByClient: true,
                  deletedAt: new Date().toISOString(),
                },
              },
            });
            count++;
          }
        }
        continue;
      }
      const content = normalizeMessageContent(entry.message);
      const type = getContentType(content);
      if (!type || !realMessageTypes.has(type)) continue;
      await this.db.$transaction(
        async (tx) => {
          const contact = await resolveContact(tx, {
            jid: entry.key.remoteJid!,
            alternateJid: entry.key.remoteJidAlt,
            name: !entry.key.fromMe && !entry.key.remoteJid?.endsWith('@g.us') ? entry.pushName : undefined,
          });
          if (!contact) return;
          const key = { sessionId, contactId: contact.id };
          let chat = await tx.conversation.findUnique({ where: { sessionId_contactId: key } });
          if (!chat) chat = await tx.conversation.create({ data: { ...key, hasHistory: !live } });
          const existing = await tx.chatMessage.findUnique({
            where: {
              conversationId_whatsappMessageId: { conversationId: chat.id, whatsappMessageId: entry.key.id! },
            },
          });
          if (existing) return;
          const inbound = !entry.key.fromMe;
          const sentAt = timestamp(entry.messageTimestamp) ?? new Date();
          const text = content?.conversation ?? content?.extendedTextMessage?.text ?? null;
          if (inbound && live) {
            const referral = findAdReferral(entry.message);
            if (referral) {
              const adReferral = {
                source: 'WhatsApp Ads',
                title: String(referral.title ?? referral.adTitle ?? referral.sourceUrl ?? 'Anúncio de WhatsApp').slice(0, 200),
                body: String(referral.body ?? referral.description ?? '').slice(0, 500),
                url: String(referral.sourceUrl ?? referral.url ?? '').slice(0, 1000),
                receivedAt: new Date().toISOString(),
              };
              await tx.contact.update({ where: { id: contact.id }, data: { metadata: messageJson({ ...(contact.metadata as object), adReferral }) } });
              const labels = await tx.label.findMany({ where: { isDeleted: false, OR: [{ sessionId }, { sessionId: null }] }, orderBy: { position: 'asc' } });
              const adLabel = labels.find((label) => normalizeOptOut(label.name).includes('anuncio'));
              if (adLabel) await tx.contactLabel.upsert({ where: { contactId_labelId: { contactId: contact.id, labelId: adLabel.id } }, create: { contactId: contact.id, labelId: adLabel.id }, update: {} });
            }
          }
          if (inbound && live && text?.trim()) {
            const settingsRow = await tx.operationRecord.findUnique({ where: { id: 'settings:opt-out' }, select: { data: true } });
            const configured = (settingsRow?.data as { terms?: string[] } | null)?.terms;
            const terms = configured?.length ? configured : ['parar', 'sair', 'cancelar', 'remover', 'não quero mais', 'não me envie', 'pare'];
            const incoming = normalizeOptOut(text);
            const optedOut = terms.some((term) => {
              const normalized = normalizeOptOut(term);
              return Boolean(normalized && (incoming === normalized || (normalized.includes(' ') ? incoming.includes(normalized) : incoming.startsWith(`${normalized} `))));
            });
            if (optedOut && !(contact.metadata as { optOut?: boolean }).optOut) {
              await tx.contact.update({ where: { id: contact.id }, data: { metadata: messageJson({ ...(contact.metadata as object), optOut: true, optOutAt: new Date().toISOString(), optOutText: text.slice(0, 300) }) } });
              const labels = await tx.label.findMany({ where: { isDeleted: false, OR: [{ sessionId }, { sessionId: null }] }, orderBy: { position: 'asc' } });
              const blocked = labels.find((label) => /bloqueado|opt.?out/.test(normalizeOptOut(label.name)));
              if (blocked) await tx.contactLabel.upsert({ where: { contactId_labelId: { contactId: contact.id, labelId: blocked.id } }, create: { contactId: contact.id, labelId: blocked.id }, update: {} });
              await setAiControl(tx, chat.id, true, 'O cliente solicitou parar mensagens; contato marcado como opt-out.');
              const queued = await tx.deliveryTask.findMany({ where: { conversationId: chat.id, status: 'QUEUED' }, select: { id: true, batchId: true, payload: true } });
              const batches = new Set<string>();
              for (const task of queued) {
                if ((task.payload as { kind?: string }).kind === 'reminder') continue;
                batches.add(task.batchId);
                await tx.deliveryTask.update({ where: { id: task.id }, data: { status: 'CANCELLED', error: 'Contato pediu para parar mensagens.' } });
              }
              for (const batchId of batches) {
                const batch = await tx.operationRecord.findUnique({ where: { id: batchId } });
                if (!batch) continue;
                const current = batch.data as { status?: string; [key: string]: unknown };
                const remaining = await tx.deliveryTask.count({ where: { batchId, status: 'QUEUED' } });
                await tx.operationRecord.update({ where: { id: batchId }, data: { data: messageJson({
                  ...current,
                  status: current.mode === 'CAMPAIGN' ? (remaining ? current.status : 'COMPLETED') : 'CANCELLED',
                  ...(current.mode === 'CAMPAIGN' ? {} : { cancelReason: 'Contato pediu para parar mensagens.', cancelledAt: new Date().toISOString() }),
                }) } });
              }
            }
          }
          if (
            live &&
            Math.abs(Date.now() - sentAt.getTime()) <= 300_000 &&
            (!inbound || requestsHuman(text ?? ''))
          )
            await setAiControl(
              tx,
              chat.id,
              true,
              inbound ? 'Cliente solicitou atendimento humano.' : 'Mensagem manual enviada pelo WhatsApp.',
            );
          const media = content?.imageMessage ?? content?.videoMessage ?? content?.documentMessage;
          const createdMessage = await tx.chatMessage.create({
            data: {
              conversationId: chat.id,
              whatsappMessageId: entry.key.id,
              direction: inbound ? 'INBOUND' : 'OUTBOUND',
              status:
                entry.status != null
                  ? (messageStatuses[entry.status] ?? 'SENT')
                  : inbound
                    ? 'DELIVERED'
                    : 'SENT',
              type,
              text,
              caption: media?.caption,
              sentAt,
              isPtt: content?.audioMessage?.ptt ?? false,
              isPtv: type === 'ptvMessage',
              asViewOnce: Boolean(
                entry.message?.viewOnceMessage ||
                entry.message?.viewOnceMessageV2 ||
                entry.message?.viewOnceMessageV2Extension,
              ),
              rawPayload: messageJson(entry),
            },
          });
          const campaignCta = inbound && live && text?.trim() && Math.abs(Date.now() - sentAt.getTime()) <= 300_000
            ? await queueCampaignResponse(tx, sessionId, chat.id, text, sentAt) : false;
          if (inbound && live && Math.abs(Date.now() - sentAt.getTime()) <= 300_000)
            await tx.flowInboxEvent.create({
              data: { messageId: createdMessage.id, conversationId: chat.id, receivedAt: new Date(),
                ...(campaignCta ? { processedAt: new Date(), outcome: 'campaign-cta' } : {}) },
            });
          if (inbound && live) {
            const pending = await tx.deliveryTask.findMany({
              where: { conversationId: chat.id, status: 'QUEUED' },
              select: { id: true, batchId: true, payload: true },
            });
            const followUps = pending.filter((task) => {
              const data = task.payload as { followUp?: boolean; sourceMessageAt?: string };
              return data.followUp && data.sourceMessageAt &&
                sentAt.getTime() >= new Date(data.sourceMessageAt).getTime() - 1000;
            });
            for (const followUp of followUps) {
              await tx.deliveryTask.updateMany({
                where: { batchId: followUp.batchId, conversationId: chat.id, status: 'QUEUED' },
                data: { status: 'CANCELLED', error: 'Follow-up cancelado: o cliente respondeu.' },
              });
              const batch = await tx.operationRecord.findUnique({ where: { id: followUp.batchId } });
              if (batch) {
                const current = batch.data as { status?: string; [key: string]: unknown };
                const remaining = await tx.deliveryTask.count({ where: { batchId: followUp.batchId, status: 'QUEUED' } });
                await tx.operationRecord.update({
                  where: { id: followUp.batchId },
                  data: { data: messageJson({
                    ...current,
                    status: current.mode === 'CAMPAIGN' ? (remaining ? current.status : 'COMPLETED') : 'CANCELLED',
                    ...(current.mode === 'CAMPAIGN' ? {} : { cancelReason: 'O cliente respondeu.', cancelledAt: new Date().toISOString() }),
                  }) },
                });
              }
            }
          }
          const firstInbound = inbound && !chat.firstInboundAt;
          await tx.conversation.update({
            where: { id: chat.id },
            data: {
              lastMessageAt: !chat.lastMessageAt || sentAt > chat.lastMessageAt ? sentAt : undefined,
              ...(inbound && live ? { unreadCount: { increment: 1 } } : {}),
              ...(!live ? { hasHistory: true } : {}),
              ...(inbound && (!chat.firstInboundAt || sentAt < chat.firstInboundAt)
                ? { firstInboundAt: sentAt }
                : {}),
            },
          });
          if (inbound && (!contact.firstInboundAt || sentAt < contact.firstInboundAt)) {
            await tx.contact.update({ where: { id: contact.id }, data: { firstInboundAt: sentAt } });
          }
          if (firstInbound && live && !chat.hasHistory && !contact.isGroup) {
            const settings = await tx.sessionSettings.findUnique({
              where: { sessionId },
              include: { firstMessageLabel: true },
            });
            if (
              settings?.autoLabelFirstMessage &&
              settings.firstMessageLabelId &&
              !settings.firstMessageLabel?.isDeleted
            ) {
              const link = { contactId: contact.id, labelId: settings.firstMessageLabelId };
              await tx.contactLabel.upsert({ where: { contactId_labelId: link }, create: link, update: {} });
              if (
                settings.firstMessageLabel?.whatsappId &&
                settings.firstMessageLabel.sessionId === sessionId
              ) {
                const deduplicationKey = `first-message-label:${sessionId}:${contact.id}`;
                await tx.scheduledJob.upsert({
                  where: { deduplicationKey },
                  create: {
                    type: 'WHATSAPP_ADD_LABEL',
                    deduplicationKey,
                    runAt: new Date(),
                    maxAttempts: 5,
                    payload: {
                      sessionId,
                      contactId: contact.id,
                      labelId: settings.firstMessageLabelId,
                      jid: entry.key.remoteJid!,
                      whatsappId: settings.firstMessageLabel.whatsappId,
                    },
                  },
                  update: {},
                });
              }
            }
          }
          count++;
        },
        { timeout: 30_000 },
      );
    }
    this.publisher.sync({ sessionId, kind: 'messages', count });
  }

  async messageUpdates(sessionId: string, entries: BaileysEventMap['messages.update']) {
    for (const { key, update } of entries) {
      if (!key.remoteJid || !key.id || update.status == null) continue;
      const jid = normalizedJid(key.remoteJid);
      if (!jid) continue;
      const alias = await this.db.whatsappIdentity.findUnique({ where: { jid } });
      if (!alias) continue;
      const status = messageStatuses[update.status];
      const protectedStatuses: MessageStatus[] =
        status === 'READ'
          ? []
          : status === 'DELIVERED' || status === 'FAILED'
            ? ['READ']
            : status === 'SENT'
              ? ['DELIVERED', 'READ']
              : ['SENT', 'DELIVERED', 'READ'];
      if (status)
        await this.db.chatMessage.updateMany({
          where: {
            whatsappMessageId: key.id,
            conversation: { sessionId, contactId: alias.contactId },
            status: { notIn: protectedStatuses },
          },
          data: { status },
        });
    }
    this.publisher.sync({ sessionId, kind: 'messages', count: entries.length });
  }

  async labelEdit(sessionId: string, label: BaileysEventMap['labels.edit']) {
    const id = `wa:${sessionId}:${label.id}`;
    const color = labelColors[label.color] ?? '#8B5CF6';
    const fields = {
      name: label.name || `Etiqueta ${label.id}`,
      color,
      whatsappColor: label.color,
      isDeleted: Boolean(label.deleted),
    };
    await this.db.$transaction(async (tx) => {
      await tx.label.upsert({
        where: { id },
        create: { id, ...fields, whatsappId: label.id, sessionId, createReason: 'Importado do whatsapp' },
        update: fields,
      });
      if (label.deleted) {
        await tx.contactLabel.deleteMany({ where: { labelId: id } });
        await tx.sessionSettings.updateMany({
          where: { firstMessageLabelId: id },
          data: { autoLabelFirstMessage: false, firstMessageLabelId: null },
        });
      }
    });
    this.publisher.sync({ sessionId, kind: 'labels', count: 1 });
  }

  async labelAssociation(sessionId: string, event: BaileysEventMap['labels.association']) {
    if (event.association.type !== 'label_jid') return;
    await this.db.$transaction(async (tx) => {
      const { labelId, chatId } = event.association;
      const contact = await resolveContact(tx, { jid: chatId });
      if (!contact) return;
      const id = `wa:${sessionId}:${labelId}`;
      const label = await tx.label.upsert({
        where: { id },
        create: {
          id,
          name: `Etiqueta ${labelId}`,
          whatsappId: labelId,
          sessionId,
          createReason: 'Importado do whatsapp',
        },
        update: {},
      });
      const link = { contactId: contact.id, labelId: id };
      const pending = await tx.scheduledJob.findMany({
        where: { type: 'WHATSAPP_SET_LABEL', status: { in: ['QUEUED', 'RUNNING'] } },
        select: { payload: true },
      });
      if (
        pending.some(({ payload }) => {
          const data = payload as Record<string, unknown>;
          return data.sessionId === sessionId && data.contactId === contact.id && data.labelId === id;
        })
      )
        return;
      if (event.type === 'add' && !label.isDeleted)
        await tx.contactLabel.upsert({ where: { contactId_labelId: link }, create: link, update: {} });
      else await tx.contactLabel.deleteMany({ where: link });
    });
    this.publisher.sync({ sessionId, kind: 'labels', count: 1 });
  }

  async history(sessionId: string, event: BaileysEventMap['messaging-history.set']) {
    for (const mapping of event.lidPnMappings ?? []) await this.mapping(sessionId, mapping);
    await this.contactsUpsert(sessionId, event.contacts);
    await this.chatsUpsert(sessionId, event.chats, true);
    await this.messagesUpsert(sessionId, event.messages, false);
    this.publisher.sync({
      sessionId,
      kind: 'history',
      count: event.messages.length,
      progress: event.progress,
    });
  }
}
