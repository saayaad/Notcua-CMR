import { AssetKind, MacroActionType, NodeType, Prisma, type PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors.js';
import {
  assetSchema, labelSchema, funnelSchema, macroSchema, recordSchema, idSchema,
  list, json, digest, stableStringify, decodeBase64, cleanFilename, phone, type RecordData,
} from './validation.js';
import { flowSchema, parseGraph } from './flow-validation.js';

const collections = { messages: AssetKind.MESSAGE, audios: AssetKind.AUDIO, medias: AssetKind.MEDIA, docs: AssetKind.DOCUMENT };
const itemKinds: Record<string, AssetKind> = { message: AssetKind.MESSAGE, audio: AssetKind.AUDIO, media: AssetKind.MEDIA, doc: AssetKind.DOCUMENT, document: AssetKind.DOCUMENT };
const nodeKinds: Record<string, NodeType> = { start: 'START', text: 'TEXT', audio: 'AUDIO', media: 'MEDIA', delay: 'DELAY', 'user-input': 'USER_INPUT' };
type Tx = Prisma.TransactionClient;
export interface ImportReport {
  batchId: string;
  format: string;
  duplicate: boolean;
  counts: { assets: number; files: number; labels: number; contacts: number; macros: number; funnels: number; flows: number };
  warnings: string[];
}

export class BackupService {
  constructor(private readonly db: PrismaClient) {}

  async import(input: unknown, sourceName = 'backup.json'): Promise<ImportReport> {
    const root = Array.isArray(input) ? { respostasRapidasAcao: input } : recordSchema.parse(input);
    const wrapped = root.ZV_backup;
    const data = wrapped === undefined ? root : recordSchema.parse(wrapped);
    const hasZv = ['messages', 'audios', 'medias', 'docs', 'labels', 'funnels', 'flows', 'objectsList'].some((key) => key in data);
    const hasMacros = 'respostasRapidasAcao' in data;
    if (!hasZv && !hasMacros) throw new AppError(422, 'Formato não reconhecido: esperado ZV_backup ou respostasRapidasAcao.');
    const format = hasZv ? 'ZV_backup' : 'respostasRapidasAcao';
    const hash = digest(stableStringify(input));
    const existing = await this.db.importBatch.findUnique({ where: { sha256: hash } });
    if (existing) return { ...(existing.report as unknown as ImportReport), duplicate: true };
    try {
      return await this.db.$transaction(async (tx) => {
        const report: ImportReport = {
          batchId: '', format, duplicate: false,
          counts: { assets: 0, files: 0, labels: 0, contacts: 0, macros: 0, funnels: 0, flows: 0 },
          warnings: [],
        };
        const known = new Set([...Object.keys(collections), 'labels', 'funnels', 'flows', 'objectsList', 'respostasRapidasAcao', 'format', 'version', 'exportedAt']);
        for (const key of Object.keys(data)) {
          if (!known.has(key)) report.warnings.push(`Campo ${key} preservado no original, sem conversão para entidades.`);
        }
        const files = new Map<string, string>();
        const fileIds = new Set<string>();
        const storeFile = async (entry: RecordData): Promise<string> => {
          const encoded = entry.base64 ?? entry.data;
          if (typeof encoded !== 'string') throw new AppError(422, 'objectsList exige base64 ou data em cada arquivo.');
          const decoded = decodeBase64(encoded, typeof entry.mimeType === 'string' ? entry.mimeType : undefined);
          const stored = await tx.storedFile.upsert({
            where: { sha256: decoded.sha256 },
            create: { ...decoded, filename: cleanFilename(entry.filename ?? entry.name) },
            update: {},
          });
          fileIds.add(stored.id);
          return stored.id;
        };
        const objectList = data.objectsList;
        const objects = objectList !== undefined && !Array.isArray(objectList)
          ? Object.entries(recordSchema.parse(objectList)).map(([id, value]) => typeof value === 'string' ? { id, base64: value } : { ...recordSchema.parse(value), id })
          : list(objectList, 'objectsList');
        for (const entry of objects) {
          const id = idSchema.parse(entry.id);
          if (files.has(id)) throw new AppError(422, `Arquivo duplicado: ${id}`);
          files.set(id, await storeFile(entry));
        }
        const seen = new Set<string>();
        const unique = (kind: string, id: string) => {
          const key = `${kind}:${id}`;
          if (seen.has(key)) throw new AppError(422, `ID duplicado em ${kind}: ${id}`);
          seen.add(key);
        };
        const contactIds = new Set<string>();
        for (const raw of list(data.labels, 'labels')) {
          const label = labelSchema.parse(raw);
          unique('label', label.id);
          const fields = { name: label.name, color: label.color, description: label.description, createReason: label.createReason };
          await tx.label.upsert({ where: { id: label.id }, create: { id: label.id, ...fields }, update: fields });
          for (const number of label.phoneNumbers) {
            const phoneNumber = phone(number);
            const contact = await tx.contact.upsert({ where: { phoneNumber }, create: { phoneNumber, name: phoneNumber }, update: {} });
            await tx.contactLabel.upsert({
              where: { contactId_labelId: { contactId: contact.id, labelId: label.id } },
              create: { contactId: contact.id, labelId: label.id }, update: {},
            });
            contactIds.add(contact.id);
          }
          report.counts.labels++;
        }
        for (const [key, kind] of Object.entries(collections)) {
          for (const raw of list(data[key], key)) {
            const asset = assetSchema.parse(raw);
            unique('asset', asset.id);
            let fileId: string | undefined;
            if (asset.base64) fileId = await storeFile(asset);
            else if (asset.objectId ?? asset.fileId) {
              const ref = asset.objectId ?? asset.fileId;
              fileId = files.get(ref!);
              if (!fileId) throw new AppError(422, `Ativo ${asset.id} referencia arquivo inexistente: ${ref}`);
            } else fileId = files.get(asset.id);
            const text = asset.text ?? asset.message;
            if (kind === 'MESSAGE' && !text) throw new AppError(422, `Mensagem ${asset.id} exige text ou message.`);
            if (kind !== 'MESSAGE' && !fileId) throw new AppError(422, `Ativo ${asset.id} exige mídia Base64 ou objectId válido.`);
            const previous = await tx.asset.findUnique({ where: { id: asset.id } });
            if (previous && previous.kind !== kind) throw new AppError(409, `ID ${asset.id} já pertence a outro tipo de ativo.`);
            const fields = {
              kind, name: asset.name ?? asset.title ?? `${key} ${asset.id}`, text: text ?? null,
              caption: asset.caption ?? null, fileId: fileId ?? null,
              isFavorite: asset.isFavorite, isPtt: asset.isPtt, isPtv: asset.isPtv, asViewOnce: asset.asViewOnce,
              metadata: json(raw),
            };
            await tx.asset.upsert({ where: { id: asset.id }, create: { id: asset.id, ...fields }, update: fields });
            report.counts.assets++;
          }
        }
        const requireAsset = async (id: string, expected?: AssetKind) => {
          const asset = await tx.asset.findUnique({ where: { id } });
          if (!asset || (expected && asset.kind !== expected)) throw new AppError(422, `Ativo ausente ou incompatível: ${id}`);
        };
        for (const raw of list(data.respostasRapidasAcao, 'respostasRapidasAcao')) {
          const macro = macroSchema.parse(raw);
          unique('macro', macro.id);
          const fields = { name: macro.name, text: macro.text ?? null, isFavorite: macro.isFavorite, metadata: json(raw) };
          await tx.macro.upsert({ where: { id: macro.id }, create: { id: macro.id, ...fields }, update: fields });
          await tx.macroAction.deleteMany({ where: { macroId: macro.id } });
          for (const [position, action] of macro.acao.entries()) {
            let fileId: string | undefined;
            if (action.base64) fileId = await storeFile(action);
            if (action.labelID && !await tx.label.findUnique({ where: { id: action.labelID } })) {
              throw new AppError(422, `Macro ${macro.id} referencia etiqueta inexistente: ${action.labelID}`);
            }
            const type: MacroActionType = action.type === 'txt' || action.type === 'utility' ? 'TEXT' : action.type === 'addLabel' ? 'ADD_LABEL' : action.type === 'removeLabel' ? 'REMOVE_LABEL' : 'MEDIA';
            await tx.macroAction.create({ data: {
              macroId: macro.id, position, type, text: action.text ?? action.message,
              waitMs: Math.round(action.aguarde * 1000), composingMs: Math.round(action.composing * 1000),
              fileId, labelId: action.labelID, payload: json(action),
            } });
          }
          report.counts.macros++;
        }
        for (const raw of list(data.funnels, 'funnels')) {
          const funnel = funnelSchema.parse(raw);
          unique('funnel', funnel.id);
          const fields = { name: funnel.name, metadata: json(raw) };
          await tx.funnel.upsert({ where: { id: funnel.id }, create: { id: funnel.id, ...fields }, update: fields });
          await tx.funnelItem.deleteMany({ where: { funnelId: funnel.id } });
          for (const [position, item] of funnel.itemsSequence.entries()) {
            await requireAsset(item.itemId, itemKinds[item.type]);
            await tx.funnelItem.create({ data: { funnelId: funnel.id, assetId: item.itemId, position, delayBeforeSendMs: item.delayBeforeSend } });
          }
          report.counts.funnels++;
        }
        for (const raw of list(data.flows, 'flows')) {
          const flow = flowSchema.parse(raw);
          unique('flow', flow.id);
          const versions: { status: 'DRAFT' | 'PUBLISHED'; raw: unknown }[] = [];
          if (flow.draft != null) versions.push({ status: 'DRAFT', raw: flow.draft });
          if (flow.published != null) versions.push({ status: 'PUBLISHED', raw: flow.published });
          if (!versions.length && flow.nodes) versions.push({ status: 'DRAFT', raw });
          if (!versions.length) throw new AppError(422, `Fluxo ${flow.id} exige draft, published ou nodes.`);
          if (flow.enabled && !versions.some((v) => v.status === 'PUBLISHED')) {
            throw new AppError(422, `Fluxo ativo ${flow.id} exige versão published.`);
          }
          const fields = { name: flow.name, enabled: flow.enabled, enabledAt: null, metadata: json(raw) };
          await tx.flow.upsert({ where: { id: flow.id }, create: { id: flow.id, ...fields }, update: fields });
          const last = await tx.flowVersion.aggregate({ where: { flowId: flow.id }, _max: { version: true } });
          let version = last._max.version ?? 0;
          for (const snapshot of versions) {
            const graph = parseGraph(snapshot.raw);
            const created = await tx.flowVersion.create({ data: {
              flowId: flow.id, version: ++version, status: snapshot.status, graph: json(snapshot.raw),
              publishedAt: snapshot.status === 'PUBLISHED' ? new Date() : null,
            } });
            for (const n of graph.nodes) {
              const expected = n.type === 'text' ? 'MESSAGE' : n.type === 'audio' ? 'AUDIO' : n.type === 'media' ? 'MEDIA' : undefined;
              if (n.config.itemId) await requireAsset(n.config.itemId, expected);
              await tx.flowNode.create({ data: {
                versionId: created.id, sourceId: n.id, type: nodeKinds[n.type]!, x: n.position.x, y: n.position.y,
                assetId: n.config.itemId, simulationDelayMs: n.config.simulationDelay,
                delayInMs: n.config.delayInMs, expirationTimeoutMs: n.config.expirationTimeoutInMs,
                config: json(n.config),
              } });
            }
          }
          report.counts.flows++;
        }
        report.counts.files = fileIds.size;
        report.counts.contacts = contactIds.size;
        const batch = await tx.importBatch.create({ data: {
          sha256: hash, format, sourceName: cleanFilename(sourceName), payload: json(input), report: json(report),
        } });
        report.batchId = batch.id;
        await tx.importBatch.update({ where: { id: batch.id }, data: { report: json(report) } });
        return report;
      }, { timeout: 60_000, maxWait: 10_000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const batch = await this.db.importBatch.findUnique({ where: { sha256: hash } });
        if (batch) return { ...(batch.report as unknown as ImportReport), duplicate: true };
      }
      throw error;
    }
  }

  async export() {
    return this.db.$transaction(async (tx) => {
      const assets = await tx.asset.findMany({ orderBy: { id: 'asc' } });
      const files = await tx.storedFile.findMany({ orderBy: { id: 'asc' } });
      const labels = await tx.label.findMany({ where: { isDeleted: false }, include: { contacts: { include: { contact: true } } }, orderBy: { id: 'asc' } });
      const macros = await tx.macro.findMany({ include: { actions: { orderBy: { position: 'asc' } } } });
      const funnels = await tx.funnel.findMany({ include: { items: { include: { asset: true }, orderBy: { position: 'asc' } } } });
      const flows = await tx.flow.findMany({ include: { versions: { orderBy: { version: 'desc' } } } });
      const assetOutput = (kind: AssetKind) => assets.filter((a) => a.kind === kind).map((a) => ({
        ...recordSchema.parse(a.metadata), id: a.id, name: a.name, text: a.text ?? undefined,
        caption: a.caption ?? undefined, base64: undefined, fileId: undefined,
        objectId: a.fileId ?? undefined, isFavorite: a.isFavorite, isPtt: a.isPtt, isPtv: a.isPtv, asViewOnce: a.asViewOnce,
      }));
      return {
        format: 'ZV_backup', version: 1, exportedAt: new Date().toISOString(),
        messages: assetOutput('MESSAGE'), audios: assetOutput('AUDIO'), medias: assetOutput('MEDIA'), docs: assetOutput('DOCUMENT'),
        objectsList: files.map((f) => ({ id: f.id, filename: f.filename, mimeType: f.mimeType, base64: Buffer.from(f.data).toString('base64') })),
        labels: labels.map((l) => ({ id: l.id, name: l.name, color: l.color, description: l.description, createReason: l.createReason, phoneNumbers: l.contacts.map((c) => c.contact.phoneNumber) })),
        respostasRapidasAcao: macros.map((m) => ({
          ...recordSchema.parse(m.metadata), id: m.id, name: m.name, text: m.text ?? undefined, isFavorite: m.isFavorite,
          acao: m.actions.map((a) => ({ ...recordSchema.parse(a.payload), aguarde: a.waitMs / 1000, composing: a.composingMs / 1000 })),
        })),
        funnels: funnels.map((f) => ({
          ...recordSchema.parse(f.metadata), id: f.id, name: f.name,
          itemsSequence: f.items.map((i) => ({ itemId: i.assetId, type: i.asset.kind.toLowerCase(), delayBeforeSend: i.delayBeforeSendMs })),
        })),
        flows: flows.map((f) => ({
          ...recordSchema.parse(f.metadata), id: f.id, name: f.name, enabled: f.enabled,
          draft: f.versions.find((v) => v.status === 'DRAFT')?.graph,
          published: f.versions.find((v) => v.status === 'PUBLISHED')?.graph,
        })),
      };
    }, { timeout: 60_000 });
  }
}
