import type { Library } from '../types';
export const menuGroups = [
  {
    id: 'messaging',
    name: 'Mensageria',
    items: [
      ['overview', 'Visão geral'],
      ['inbox', 'Atendimento'],
      ['campaigns', 'Campanhas'],
      ['spreadsheets', 'Planilhas'],
      ['schedule', 'Agenda'],
      ['library', 'Biblioteca'],
      ['flows', 'Autoatendimento'],
      ['sandbox', 'Espaço de Teste'],
    ],
  },
  {
    id: 'relationships',
    name: 'Relacionamentos',
    items: [
      ['contacts', 'Contatos'],
      ['crm', 'CRM e negócios'],
    ],
  },
  {
    id: 'account',
    name: 'Conta',
    items: [
      ['connections', 'Conexões'],
      ['settings', 'Configurações'],
      ['personalization', 'Personalização'],
    ],
  },
];
export const libraryFolders = [
  ['MESSAGE', 'Textos'],
  ['AUDIO', 'Áudios'],
  ['MEDIA', 'Mídias'],
  ['DOCUMENT', 'Documentos'],
  ['FUNNEL', 'Funis'],
  ['MACRO', 'Macros'],
  ['PIX', 'PIX'],
];
export function orderItems<T>(items: readonly T[], ids: readonly string[], key: (item: T) => string): T[] {
  const ranks = new Map(ids.map((id, index) => [id, index]));
  return [...items].sort((a, b) => (ranks.get(key(a)) ?? ids.length) - (ranks.get(key(b)) ?? ids.length));
}
const naturalNames = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
export function orderNamedItems<T extends { id: string; name: string }>(items: readonly T[], ids: readonly string[]): T[] {
  const ranks = new Map(ids.map((id, index) => [id, index]));
  return [...items].sort((a, b) =>
    (ranks.get(a.id) ?? ids.length) - (ranks.get(b.id) ?? ids.length) ||
    naturalNames.compare(a.name, b.name) || a.id.localeCompare(b.id),
  );
}
export function synchronizeWorkbenchOrder<T extends { id: string; kind: string; name: string }>(
  items: readonly T[],
  workbenchOrder: readonly string[],
  resourceOrder: Record<string, string[]>,
): T[] {
  const base = workbenchOrder.length
    ? orderItems(items, workbenchOrder, (item) => item.id)
    : [...items];
  const perKind = new Map<string, T[]>();
  for (const item of base) {
    if (!perKind.has(item.kind)) perKind.set(item.kind, []);
    perKind.get(item.kind)!.push(item);
  }
  for (const [kind, group] of perKind)
    if (resourceOrder[kind]?.length)
      perKind.set(kind, orderNamedItems(group, resourceOrder[kind]));
  const cursors = new Map<string, number>();
  return base.map((item) => {
    const index = cursors.get(item.kind) ?? 0;
    cursors.set(item.kind, index + 1);
    return perKind.get(item.kind)![index]!;
  });
}
export function orderedLibrary(library: Library, order: Record<string, string[]>) {
  return {
    ...library,
    assets: orderNamedItems(library.assets, Object.values(order).flat()),
    funnels: orderNamedItems(library.funnels, order.FUNNEL ?? []),
    macros: orderNamedItems(library.macros, order.MACRO ?? []),
    pixKeys: orderNamedItems(library.pixKeys, order.PIX ?? []),
  };
}
