import ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors.js';
import { json } from '../backups/validation.js';
import { retryDatabaseOperation } from '../../database/retry.js';
import { putRecord } from './records.js';
export function normalizeLeadPhone(value: string, countryCode = '55', areaCode = '') {
  const matches = value.match(/\+?\d[\d\s().-]{6,}\d/g) ?? [];
  if (matches.length !== 1) return '';
  let phone = matches[0]!.replace(/\D/g, '').replace(/^00/, '');
  if (countryCode === '55') {
    if ([8, 9].includes(phone.length)) {
      if (!/^[1-9]\d$/.test(areaCode)) return '';
      phone = areaCode + phone;
    }
    if ([10, 11].includes(phone.length)) phone = '55' + phone;
    if (phone.startsWith('55') && !/^55[1-9]\d\d{8,9}$/.test(phone)) return '';
  }
  return /^\d{8,15}$/.test(phone) ? phone : '';
}
export const leadSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phoneNumber: z.string().regex(/^\d{8,15}$/),
  tags: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  email: z.string().max(200).default(''),
  optIn: z.boolean().default(false),
});
export class ContactsService {
  constructor(private db: PrismaClient) {}
  async updateProfile(
    sessionId: string,
    conversationId: string,
    data: { name?: string; pinned?: boolean; assignedTo?: string; [key: string]: unknown },
  ) {
    return retryDatabaseOperation(() =>
      this.db.$transaction(async (tx) => {
        const chat = await tx.conversation.findFirst({
          where: { id: conversationId, sessionId },
          include: { contact: true },
        });
        if (!chat) throw new AppError(404, 'Conversa não encontrada nesta conexão.');
        const { name, ...fields } = data;
        await tx.contact.update({
          where: { id: chat.contactId },
          data: {
            ...(name ? { name } : {}),
            metadata: json({ ...(chat.contact.metadata as object), ...fields }),
          },
        });
        if (data.pinned !== undefined || data.assignedTo !== undefined)
          await tx.conversation.update({
            where: { id: chat.id },
            data: { pinned: data.pinned, assignedTo: data.assignedTo },
          });
        if (data.assignedTo && data.assignedTo !== chat.assignedTo)
          await tx.operationRecord.create({
            data: {
              id: `notice:${randomUUID()}`,
              kind: 'NOTICE',
              data: {
                title: 'Atendimento atribuído',
                text: `${name || chat.contact.name} foi atribuído a ${data.assignedTo}.`,
                conversationId: chat.id,
                recipient: data.assignedTo,
                createdAt: new Date().toISOString(),
                read: false,
              },
            },
          });
        return { saved: true };
      }),
    );
  }
  async addNote(sessionId: string, conversationId: string, text: string, author: string) {
    return retryDatabaseOperation(() =>
      this.db.$transaction(async (tx) => {
        const chat = await tx.conversation.findFirst({
          where: { id: conversationId, sessionId },
          include: { contact: true },
        });
        if (!chat) throw new AppError(404, 'Conversa não encontrada nesta conexão.');
        const metadata = chat.contact.metadata as { notes?: unknown[] };
        await tx.contact.update({
          where: { id: chat.contactId },
          data: {
            metadata: json({
              ...metadata,
              notes: [
                ...(metadata.notes ?? []),
                { id: randomUUID(), text, author, at: new Date().toISOString() },
              ].slice(-200),
            }),
          },
        });
        return { saved: true };
      }),
    );
  }
  async preview(raw: unknown) {
    const input = z
      .object({
        filename: z.string().max(200),
        areaCode: z
          .string()
          .regex(/^$|^[1-9]\d$/)
          .default(''),
        base64: z.string().max(15_000_000),
        countryCode: z
          .string()
          .regex(/^\d{1,3}$/)
          .default('55'),
        phoneColumn: z.number().int().min(0).max(100).optional(),
        nameColumn: z.number().int().min(0).max(100).optional(),
      })
      .parse(raw);
    const bytes = Buffer.from(input.base64.replace(/^data:[^,]*,/, ''), 'base64');
    if (bytes.length > 10 * 1024 * 1024) throw new AppError(413, 'A planilha deve ter até 10 MiB.');
    const book = new ExcelJS.Workbook();
    try {
      if (/\.csv$/i.test(input.filename)) {
        const text = bytes.toString('utf8').replace(/^\uFEFF/, '');
        const delimiter = text.split('\n')[0]!.includes(';') ? ';' : ',';
        await book.csv.read(Readable.from([text]), { parserOptions: { delimiter, trim: true } });
      } else if (/\.xlsx$/i.test(input.filename)) await book.xlsx.load(bytes as never);
      else throw new Error();
    } catch {
      throw new AppError(422, 'Não foi possível ler. Use .xlsx ou .csv válido.');
    }
    const sheet = book.worksheets[0];
    if (!sheet) throw new AppError(422, 'A planilha está vazia.');
    if (sheet.rowCount > 5001 || sheet.columnCount > 100)
      throw new AppError(422, 'Divida a planilha em arquivos de até 5.000 linhas e 100 colunas.');
    const rows: string[][] = [];
    sheet.eachRow((row) => {
      const values: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => (values[col - 1] = cell.text.trim()));
      rows.push(values);
    });
    const headerIndex = rows
      .slice(0, 15)
      .findIndex((row) =>
        row.some((cell) => /^(telefone|celular|whatsapp|phone|phone_number|número|numero)(\s|$)/i.test(cell)),
      );
    const headers = headerIndex >= 0 ? rows[headerIndex]! : rows[0]!.map((_, index) => `Coluna ${index + 1}`);
    const find = (pattern: RegExp) => headers.findIndex((value) => pattern.test(value));
    const candidate = rows.slice(headerIndex >= 0 ? headerIndex + 1 : 0);
    const phoneColumn =
      input.phoneColumn ??
      (find(/telefone|celular|whats|phone|número|numero/i) >= 0
        ? find(/telefone|celular|whats|phone|número|numero/i)
        : (headers
            .map((_, col) => ({
              col,
              score: candidate
                .slice(0, 30)
                .filter((row) =>
                  Boolean(normalizeLeadPhone(row[col] ?? '', input.countryCode, input.areaCode)),
                ).length,
            }))
            .sort((a, b) => b.score - a.score)[0]?.col ?? 0));
    const nameColumn = input.nameColumn ?? Math.max(0, find(/nome|name|cliente|contato/i));
    const tagCol = find(/tags|etiqueta|segmento/i);
    const emailCol = find(/e-?mail/i);
    const consentCol = find(/opt.?in|consentimento/i);
    const items: z.infer<typeof leadSchema>[] = [];
    const rejected: { row: number; reason: string }[] = [];
    const seen = new Set<string>();
    for (const [index, row] of candidate.entries()) {
      const phone = normalizeLeadPhone(row[phoneColumn] ?? '', input.countryCode, input.areaCode);
      if (!phone) {
        rejected.push({
          row: index + Math.max(0, headerIndex + 1) + 1,
          reason: 'Telefone ausente, ambíguo ou inválido. Para números locais, informe o DDD padrão.',
        });
        continue;
      }
      if (seen.has(phone)) {
        rejected.push({ row: index + 1, reason: 'Telefone repetido no arquivo.' });
        continue;
      }
      seen.add(phone);
      items.push({
        name: nameColumn !== phoneColumn && row[nameColumn] ? row[nameColumn]!.slice(0, 100) : phone,
        phoneNumber: phone,
        tags:
          tagCol >= 0
            ? (row[tagCol] ?? '')
                .split(/[|;]/)
                .map((value) => value.trim())
                .filter(Boolean)
                .slice(0, 20)
            : [],
        email: emailCol >= 0 ? (row[emailCol] ?? '').slice(0, 200) : '',
        optIn: consentCol >= 0 && /^(sim|true|1|yes)$/i.test(row[consentCol] ?? ''),
      });
    }
    return {
      headers,
      phoneColumn,
      nameColumn,
      items,
      rejected,
      total: candidate.length,
      inferred: headerIndex < 0,
    };
  }
  async import(sessionId: string, raw: unknown) {
    const input = z
      .object({
        items: z.array(leadSchema).min(1).max(5000),
        extraTag: z.string().trim().max(80).default(''),
        listName: z.string().trim().max(100).default(''),
      })
      .parse(raw);
    if (!(await this.db.whatsappSession.findUnique({ where: { id: sessionId } })))
      throw new AppError(404, 'Conexão não encontrada.');
    let imported = 0;
    const conversationIds: string[] = [];
    for (let offset = 0; offset < input.items.length; offset += 50)
      await this.db.$transaction(
        async (tx) => {
          for (const lead of input.items.slice(offset, offset + 50)) {
            const existing = await tx.contact.findUnique({ where: { phoneNumber: lead.phoneNumber } });
            const metadata = {
              ...((existing?.metadata as object) ?? {}),
              ...(lead.email ? { email: lead.email } : {}),
              ...(lead.optIn ? { optIn: true, optInAt: new Date().toISOString() } : {}),
            };
            const jid = `${lead.phoneNumber}@s.whatsapp.net`;
            const contact = existing
              ? await tx.contact.update({ where: { id: existing.id }, data: { metadata: json(metadata) } })
              : await tx.contact.create({
                  data: {
                    name: lead.name,
                    phoneNumber: lead.phoneNumber,
                    whatsappJid: jid,
                    metadata: json(metadata),
                  },
                });
            await tx.whatsappIdentity.upsert({
              where: { jid },
              create: { jid, contactId: contact.id },
              update: {},
            });
            const conversation = await tx.conversation.upsert({
              where: { sessionId_contactId: { sessionId, contactId: contact.id } },
              create: { sessionId, contactId: contact.id },
              update: {},
            });
            conversationIds.push(conversation.id);
            for (const name of new Set([...lead.tags, ...(input.extraTag ? [input.extraTag] : [])])) {
              let label = await tx.label.findFirst({ where: { name, sessionId, isDeleted: false } });
              if (!label)
                label = await tx.label.create({
                  data: {
                    id: 'label:' + randomUUID(),
                    name,
                    sessionId,
                    color: '#a68bfa',
                    createReason: 'Importado de planilha',
                  },
                });
              await tx.contactLabel.upsert({
                where: { contactId_labelId: { contactId: contact.id, labelId: label.id } },
                create: { contactId: contact.id, labelId: label.id },
                update: {},
              });
            }
            imported++;
          }
        },
        { timeout: 30_000 },
      );
    const listId = input.listName ? `lead-list:${randomUUID()}` : undefined;
    if (listId)
      await putRecord(this.db, listId, 'LEAD_LIST', {
        name: input.listName,
        sessionId,
        conversationIds: [...new Set(conversationIds)],
        createdAt: new Date().toISOString(),
      });
    return { imported, sends: 0, listId };
  }
}
