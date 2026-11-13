export type DockPanelId = 'list' | 'chat' | 'tools';
export interface DockingPreferences {
  dockingPanelWidths: Partial<Record<DockPanelId, number>>;
  dockingPanelSizes: Partial<Record<DockPanelId, { width: number; height: number }>>;
  dockingHiddenPanels: DockPanelId[];
  conversationOptionsExpanded: boolean;
}

export function normalizeDockingPreferences(value: Partial<DockingPreferences>): DockingPreferences {
  const widths = value.dockingPanelWidths;
  const minimumWidths: Record<DockPanelId, number> = { list: 220, chat: 320, tools: 260 };
  const dockingPanelWidths = Object.fromEntries(
    (['list', 'chat', 'tools'] as const).flatMap((id) => {
      const width = widths?.[id];
      return Number.isFinite(width) && width! >= minimumWidths[id] && width! <= 2000
        ? [[id, Math.round(width!)]]
        : [];
    }),
  ) as DockingPreferences['dockingPanelWidths'];
  const dockingPanelSizes = Object.fromEntries(
    (['list', 'chat', 'tools'] as const).flatMap((id) => {
      const size = value.dockingPanelSizes?.[id];
      return size && Number.isFinite(size.width) && size.width >= 180 && size.width <= 3000 &&
        Number.isFinite(size.height) && size.height >= 100 && size.height <= 3000
        ? [[id, { width: Math.round(size.width), height: Math.round(size.height) }]]
        : [];
    }),
  ) as DockingPreferences['dockingPanelSizes'];
  const dockingHiddenPanels = Array.isArray(value.dockingHiddenPanels)
    ? [...new Set(value.dockingHiddenPanels.filter((id): id is DockPanelId => id === 'list' || id === 'chat' || id === 'tools'))]
    : [];
  return {
    dockingPanelWidths,
    dockingPanelSizes,
    dockingHiddenPanels,
    conversationOptionsExpanded: Boolean(value.conversationOptionsExpanded),
  };
}
