import type { Library } from '../types';
export const menuGroups = [
  {
    id: 'messaging',
    name: 'Mensageria',
    items: [
      ['overview', 'Visão geral'],
      ['inbox', 'Atendimento'],
      ['campaigns', 'Campanhas'],
      ['schedule', 'Agenda'],
      ['library', 'Biblioteca'],
      ['flows', 'Autoatendimento'],
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
export function orderedLibrary(library: Library, order: Record<string, string[]>) {
  return {
    ...library,
    assets: orderItems(library.assets, Object.values(order).flat(), (item) => item.id),
    funnels: orderItems(library.funnels, order.FUNNEL ?? [], (item) => item.id),
    macros: orderItems(library.macros, order.MACRO ?? [], (item) => item.id),
    pixKeys: orderItems(library.pixKeys, order.PIX ?? [], (item) => item.id),
  };
}
