import { decodeSutofly } from './sutofly-format.js';
import { recordSchema, list, type RecordData } from './validation.js';
import { AppError } from '../../shared/errors.js';
export interface SutoflyConversion {
  data: RecordData;
  warnings: string[];
  settings: RecordData;
  schedules: RecordData[];
  contacts: RecordData[];
  pixKeys: RecordData[];
  preferences: { replacements?: string };
}
const asObject = (value: unknown): RecordData =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordData) : {};
const timeMs = (raw: unknown) => {
  const value = asObject(raw);
  return Math.min(
    2147483647,
    Math.max(
      0,
      Number(value.value ?? 0) *
        (/hora/i.test(String(value.unit)) ? 3600000 : /minut/i.test(String(value.unit)) ? 60000 : 1000),
    ),
  );
};
export function isSutofly(root: RecordData) {
  return (
    'respostasRapidas' in root ||
    'agendamentosNaoDisparados' in root ||
    typeof root.fluxo === 'string' ||
    (Array.isArray(root.respostasRapidasAcao) &&
      root.respostasRapidasAcao.some(
        (macro) => Array.isArray(macro?.acao) && macro.acao.some((action: RecordData) => action.propriedades),
      ))
  );
}
export function convertSutofly(root: RecordData): SutoflyConversion {
  const warnings: string[] = [];
  const decoded: RecordData = {};
  for (const key of [
    'respostasRapidas',
    'contatos',
    'backupAutomatico',
    'whatsApi',
    'fluxo',
    'categoria',
    'guardaMsg',
    'replacementStorage',
  ])
    if (key in root) decoded[key] = decodeSutofly(root[key]);
  const quick = list(decoded.respostasRapidas, 'respostasRapidas');
  const names = new Map(quick.map((item) => [String(item.id), String(item.titulo ?? item.name ?? '')]));
  const messages: RecordData[] = [];
  const audios: RecordData[] = [];
  const medias: RecordData[] = [];
  const docs: RecordData[] = [];
  const labels = new Map<string, RecordData>();
  const pixKeys: RecordData[] = [];
  const assetIds = new Map<string, string>();
  const macros = list(root.respostasRapidasAcao, 'respostasRapidasAcao').map((macro, index) => {
    const name = names.get(String(macro.id)) || String(macro.name ?? `Script importado ${index + 1}`);
    return {
      id: String(macro.id),
      name,
      acao: list(macro.acao, 'acao').map((action, position) => {
        const props = { ...asObject(action.propriedades), ...action };
        delete props.propriedades;
        const type = String(action.type);
        const text = String(props.mensagem ?? props.text ?? props.message ?? '');
        const base = {
          aguarde: Number(props.aguarde ?? 0),
          composing: Number(props.composing ?? 0),
          sourceActionId: action.id,
        };
        const assetId = `sutofly:asset:${String(macro.id)}:${String(action.id ?? position)}:${position}`;
        assetIds.set(String(action.id), assetId);
        if (type === 'addLabel' || type === 'removeLabel') {
          const rawId = String(props.labelID);
          if (!rawId || rawId === 'undefined') throw new AppError(422, 'Ação de etiqueta sem identificador.');
          const labelId = `sutofly:label:${rawId}`;
          labels.set(labelId, { id: labelId, name: `Etiqueta importada ${rawId}`, sourceWhatsappId: rawId });
          return { ...base, type, labelID: labelId };
        }
        if (type === 'pix') {
          const key = String(props.key ?? '');
          const keyType = String(props.keyType ?? '').toUpperCase();
          const merchantName = String(props.name ?? '');
          pixKeys.push({
            id: `sutofly:pix:${action.id}`,
            name: merchantName || 'PIX importado',
            type: keyType === 'EVP' ? 'RANDOM' : keyType,
            value: key,
            merchantName: merchantName.slice(0, 25),
            merchantCity: '',
          });
          warnings.push(
            'Uma chave PIX foi preservada. Confira os dados e informe a cidade do recebedor antes de gerar QR Code.',
          );
          return {
            ...base,
            type: 'txt',
            text: `Chave PIX (${keyType}): ${key}${merchantName ? `\nTitular: ${merchantName}` : ''}`,
          };
        }
        if (type === 'txt') {
          messages.push({ id: assetId, name: `${name} · ${position + 1}`, text });
          return { ...base, type: 'txt', text };
        }
        if (['audio', 'image', 'video', 'media', 'sticker', 'document', 'doc'].includes(type)) {
          if (typeof props.base64 !== 'string' || !props.base64)
            throw new AppError(422, `O script ${index + 1} tem uma mídia sem conteúdo.`);
          const kind =
            type === 'audio'
              ? 'audio'
              : ['doc', 'document'].includes(type)
                ? 'document'
                : type === 'sticker'
                  ? 'sticker'
                  : type === 'video'
                    ? 'video'
                    : 'image';
          const target = kind === 'audio' ? audios : kind === 'document' ? docs : medias;
          target.push({
            id: assetId,
            name: `${name} · ${position + 1}`,
            base64: props.base64,
            caption: text || undefined,
            filename: String(props.base64Name ?? props.filename ?? `${kind}-${position + 1}`),
            isPtt: false,
          });
          return {
            ...base,
            type: 'media',
            base64: props.base64,
            caption: text || undefined,
            send: { kind, caption: text || undefined, isPtt: false },
          };
        }
        throw new AppError(
          422,
          `Tipo de ação do Sutofly ainda não reconhecido: ${type}. Nenhuma importação foi aplicada.`,
        );
      }),
    };
  });
  const flows: RecordData[] = [];
  const workflows = list(asObject(decoded.fluxo).workflows, 'workflows');
  let missing = 0;
  for (const workflow of workflows) {
    const sourceNodes = list(workflow.nodes, 'nodes');
    const edges = list(workflow.edges, 'edges');
    const nodes: RecordData[] = [];
    const convertedEdges: RecordData[] = [];
    const triggers = list(workflow.acionamentos, 'acionamentos').filter((item) => asObject(item.data).active);
    const trigger =
      triggers.find((item) => item.type === 'aoReceberMensagem') ??
      triggers.find((item) => item.type === 'primeiraMensagemDoCliente') ??
      triggers[0];
    const mode =
      trigger?.type === 'primeiraMensagemDoCliente'
        ? 'first'
        : trigger?.type === 'primeiraMensagemDoClienteNoDia'
          ? 'first-day'
          : trigger?.type === 'apenasPorAutomacao'
            ? 'manual'
            : trigger?.type === 'porPalavraChave'
              ? 'keyword'
              : 'any';
    const rules = list(workflow.regras, 'regras');
    for (const source of sourceNodes) {
      const data = asObject(source.data);
      const id = String(source.id);
      const sourceType = String(source.type);
      const type =
        sourceType === 'init'
          ? 'start'
          : sourceType === 'send-text'
            ? 'text'
            : sourceType === 'send-audio'
              ? 'audio'
              : ['send-image', 'send-video'].includes(sourceType)
                ? 'media'
                : sourceType === 'delay'
                  ? 'delay'
                  : '';
      if (!type)
        throw new AppError(
          422,
          `Bloco do Sutofly ainda não reconhecido: ${sourceType}. O arquivo original permanece intacto.`,
        );
      const outgoing = edges.filter((edge) => edge.source === source.id);
      const mediaRef = data.fileId ? assetIds.get(String(data.fileId)) : undefined;
      const itemId = type === 'text' ? `sutofly:flow-text:${workflow.id}:${id}` : mediaRef;
      if (type === 'text')
        messages.push({
          id: itemId,
          name: `${String(workflow.name)} · texto ${nodes.length + 1}`,
          text: String(data.message ?? ''),
        });
      if (['audio', 'media'].includes(type) && !mediaRef) missing++;
      const title =
        type === 'start'
          ? 'Início importado'
          : !itemId && type !== 'delay'
            ? 'Mídia ausente no backup'
            : `${sourceType.replace('send-', '')} importado`;
      const wait = asObject(source.send).type === 'on-response';
      const waitId = `${id}:response`;
      const next = outgoing.map((edge) => String(edge.target));
      nodes.push({
        id,
        type,
        position: source.position ?? { x: 0, y: nodes.length * 160 },
        data: {
          title,
          itemId,
          simulationDelay: timeMs(asObject(workflow.globalSettings).blockTransitionDelay),
          delayInMs: timeMs(data.waitTime),
          triggerMode: mode,
          cooldownMs: timeMs(workflow.cooldown),
          sendToContacts: true,
          sendToGroups: Boolean(
            asObject(rules.find((item) => item.type === 'responderGrupos')?.propriedades).active,
          ),
          keywordRules: (Array.isArray(asObject(trigger?.data).chaves)
            ? (asObject(trigger?.data).chaves as unknown[])
            : []
          )
            .map((item) => ({
              rule: 'contains',
              keyword:
                typeof item === 'string'
                  ? item
                  : String(asObject(item).keyword ?? asObject(item).chave ?? ''),
            }))
            .filter((item) => item.keyword),
          nextNodeIds: wait ? [waitId] : next,
        },
      });
      if (wait) {
        nodes.push({
          id: waitId,
          type: 'user-input',
          position: {
            x: Number(asObject(source.position).x ?? 0) + 70,
            y: Number(asObject(source.position).y ?? 0) + 100,
          },
          data: {
            title: 'Aguardar resposta',
            compareRule: 'anything',
            expectedMessages: [],
            expirationTimeoutInMs: timeMs(data.waitTime) || undefined,
            nextNodeIds: next,
          },
        });
        convertedEdges.push({ id: `${id}:wait-edge`, source: id, target: waitId });
      }
      for (const edge of outgoing)
        convertedEdges.push({
          ...edge,
          source: wait ? waitId : id,
          sourceHandle: wait ? 'match' : undefined,
        });
    }
    flows.push({
      id: String(workflow.id),
      name: String(workflow.name ?? 'Fluxo importado'),
      enabled: false,
      importedDraft: true,
      draft: { nodes, edges: convertedEdges },
      sourceRules: workflow.regras,
      sourceTriggers: workflow.acionamentos,
    });
  }
  if (missing)
    warnings.push(
      `${missing} mídias dos fluxos não estão incluídas no arquivo (fluxoFiles ausente ou incompleto). Os blocos foram preservados sem arquivo para vincular manualmente.`,
    );
  if (flows.length)
    warnings.push(
      'Fluxos importados como rascunho: revise gatilhos, horários e arquivos antes de publicar e ativar.',
    );
  if (labels.size)
    warnings.push(
      'As etiquetas referenciadas pelos scripts não incluem os nomes originais. Foram preservadas pelo identificador para revisão.',
    );
  const settings = {
    backupAutomatico: decoded.backupAutomatico,
    replacementStorage: decoded.replacementStorage,
    categorias: decoded.categoria,
    whatsApi: {
      active: Boolean(asObject(decoded.whatsApi).active),
      credentialPreservedInOriginal: Boolean(asObject(decoded.whatsApi).token),
    },
  };
  const replacements = asObject(decoded.replacementStorage);
  const items = Array.isArray(replacements.items) ? replacements.items : [];
  const preferences = replacements.isEnabled
    ? {
        replacements: items
          .map((raw) => {
            const item = asObject(raw);
            return `${String(item.from ?? item.original ?? item.de ?? '')}=${String(item.to ?? item.replacement ?? item.para ?? '')}`;
          })
          .filter((line) => !line.startsWith('='))
          .join('\n'),
      }
    : {};
  return {
    data: {
      format: 'Sutofly',
      messages,
      audios,
      medias,
      docs,
      labels: [...labels.values()],
      respostasRapidasAcao: macros,
      flows,
    },
    warnings,
    settings,
    schedules: list(root.agendamentosNaoDisparados, 'agendamentosNaoDisparados'),
    contacts: list(decoded.contatos, 'contatos'),
    pixKeys,
    preferences,
  };
}
