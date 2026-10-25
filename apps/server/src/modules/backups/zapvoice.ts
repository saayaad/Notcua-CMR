import { AppError } from '../../shared/errors.js';
import type { RecordData } from './validation.js';

// ZapVoice 3 stores message bodies alongside binary objects, and start nodes
// outside each graph. Normalize a copy; retain the untouched source in ImportBatch.
export function convertZapvoice(source: RecordData) {
  if (source.type !== 'partial' && source.type !== 'full') return undefined;
  if (!Array.isArray(source.objectsList) || !Array.isArray(source.messages)) return undefined;
  const objects = source.objectsList as RecordData[];
  const textIds = new Set((source.messages as RecordData[]).map((item) => String(item.id)));
  const warnings = ['Fluxos do ZapVoice importados desativados para revisão antes de publicar.'];
  const flows = ((source.flows ?? []) as RecordData[]).map((flow) => {
    const graph = (value: unknown, startValue: unknown) => {
      if (!value) return undefined;
      const snapshot = value as RecordData;
      const start = startValue as RecordData | undefined;
      if (!start) throw new AppError(422, `Fluxo ${flow.id}: início ausente no backup.`);
      const trigger = (start.trigger ?? {}) as RecordData;
      const keywordRules = ((trigger.keywordRules ?? []) as RecordData[]).flatMap((rule) =>
        ((rule.keywords ?? []) as string[]).filter(Boolean).map((keyword) => ({ rule: rule.type, keyword })),
      );
      const nodes = [
        { ...start, ...trigger, keywordRules, schedule: start.enabledSchedule ? start.schedule : undefined },
        ...((snapshot.nodes ?? []) as RecordData[]),
      ].map((node) => Object.fromEntries(Object.entries(node).filter(([, value]) => value !== null)));
      return { ...snapshot, nodes };
    };
    return {
      ...flow,
      name:
        (flow.draft as RecordData | undefined)?.name ??
        (flow.published as RecordData | undefined)?.name ??
        `Fluxo ${flow.id}`,
      enabled: false,
      draft: graph(flow.draft, flow.draftStartNode),
      published: graph(flow.published, flow.publishedStartNode),
    };
  });
  return {
    warnings,
    data: {
      ...source,
      messages: (source.messages as RecordData[]).map((message) => {
        const object = objects.find((item) => item.id === message.id);
        if (typeof object?.data !== 'string') throw new AppError(422, `Texto ausente: ${message.id}`);
        return { ...message, text: object.data };
      }),
      objectsList: objects.filter((item) => !textIds.has(String(item.id))),
      labels: ((source.labels ?? []) as RecordData[]).map((label) => ({
        ...label,
        phoneNumbers: ((label.phoneNumbers ?? []) as (RecordData | string)[]).map((entry) =>
          typeof entry === 'string' ? entry : String(entry.number),
        ),
      })),
      flows,
    } as RecordData,
  };
}
