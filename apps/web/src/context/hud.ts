export const hudPanels = [
  { id: 'list', name: 'Lista de conversas' },
  { id: 'chat', name: 'Conversa' },
  { id: 'tools', name: 'Mensagens fixadas' },
];
export const hudActions = [
  { id: 'summary', name: 'Resumo da conversa' },
  { id: 'schedule', name: 'Agendar mensagem' },
  { id: 'archive', name: 'Arquivar / reabrir' },
  { id: 'flow', name: 'Iniciar fluxo' },
  { id: 'ai', name: 'Assistente de IA' },
];
export const hudTools = [
  { id: 'responses', name: 'Biblioteca' },
  { id: 'faq', name: 'Respostas padrão' },
  { id: 'next', name: 'Próxima ação' },
  { id: 'profile', name: 'Cliente' },
  { id: 'notes', name: 'Notas' },
  { id: 'transfers', name: 'Transferências' },
  { id: 'settings', name: 'Ações' },
];
export function completeOrder(ids: readonly string[], allowed: readonly string[]): string[] {
  return [...new Set([...ids.filter((id) => allowed.includes(id)), ...allowed])];
}
export function panelOrder(value: { hudPanelOrder: string[]; panelPosition: string }): string[] {
  return completeOrder(
    value.hudPanelOrder.length
      ? value.hudPanelOrder
      : value.panelPosition === 'left'
        ? ['list', 'tools', 'chat']
        : ['list', 'chat', 'tools'],
    hudPanels.map((item) => item.id),
  );
}

export function hudGrid(
  order: string[],
  value: { hudPanelLayout: string; hudListWidth: number; hudToolsWidth: number; panelPosition: string },
) {
  if (!order.length)
    return { '--hud-areas': 'none', '--hud-columns': 'minmax(0,1fr)', '--hud-rows': 'minmax(0,1fr)' };
  const toolsWidth = `minmax(15rem, min(${value.hudToolsWidth}rem, 34vw))`;
  if (value.hudPanelLayout === 'rows') {
    const stack = order.filter((id) => id !== 'tools');
    const docked = order.includes('tools');
    const left = value.panelPosition === 'left';
    return {
      '--hud-areas': stack.map((id) => `"${docked ? (left ? `tools ${id}` : `${id} tools`) : id}"`).join(' '),
      '--hud-columns': docked
        ? left
          ? `${toolsWidth} minmax(0,1fr)`
          : `minmax(0,1fr) ${toolsWidth}`
        : 'minmax(0,1fr)',
      '--hud-rows': stack.map((id) => (id === 'chat' ? 'minmax(0,1fr)' : 'clamp(20rem,42vh,26rem)')).join(' '),
    };
  }
  return {
    '--hud-areas': `"${order.join(' ')}"`,
    '--hud-columns': order
      .map((id) =>
        id === 'chat'
          ? 'minmax(21rem,1fr)'
          : id === 'list'
            ? `minmax(13rem, min(${value.hudListWidth}rem, 24vw))`
            : toolsWidth,
      )
      .join(' '),
    '--hud-rows': 'minmax(0,1fr)',
  };
}
