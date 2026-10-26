import type { SerializedDockview } from 'dockview-react';

export const dockPanels = { list: 'Conversas', chat: 'Conversa', tools: 'Biblioteca e fixados' } as const;
export type DockPanelId = keyof typeof dockPanels;
export function readDockLayout(raw: string, width = 1280, height = 720): SerializedDockview | null {
  if (!raw || raw.length > 16000) return null;
  try {
    const state = JSON.parse(raw) as SerializedDockview;
    if (
      !state.grid?.root ||
      !state.panels ||
      Object.keys(state.panels).length > 3 ||
      !Number.isFinite(state.grid.width) ||
      !Number.isFinite(state.grid.height) ||
      !['HORIZONTAL', 'VERTICAL'].includes(state.grid.orientation)
    )
      return null;
    for (const [id, panel] of Object.entries(state.panels)) {
      if (!Object.hasOwn(dockPanels, id) || panel.id !== id || panel.contentComponent !== 'workspace')
        return null;
      state.panels[id] = {
        id,
        contentComponent: 'workspace',
        title: dockPanels[id as DockPanelId],
        renderer: 'always',
        minimumWidth: id === 'chat' ? 320 : id === 'tools' ? 260 : 220,
        minimumHeight: 130,
      };
    }
    const floating = [
      ...(state.floatingGroups ?? []),
      ...(state.popoutGroups ?? []).map((group) => ({
        ...(group.data ? { data: group.data } : { grid: group.grid }),
        position: { left: 24, top: 24, width: 600, height: 440 },
      })),
    ];
    if (
      floating.some(
        (group) =>
          !group.position ||
          !Number.isFinite(group.position.width) ||
          !Number.isFinite(group.position.height),
      )
    )
      return null;
    state.floatingGroups = floating.map((group) => ({
      ...group,
      position: {
        left: Math.max(
          0,
          Math.min(
            width - Math.max(180, Math.min(width, group.position.width)),
            'left' in group.position
              ? group.position.left
              : width - group.position.width - group.position.right,
          ),
        ),
        top: Math.max(
          0,
          Math.min(
            height - Math.max(100, Math.min(height, group.position.height)),
            'top' in group.position
              ? group.position.top
              : height - group.position.height - group.position.bottom,
          ),
        ),
        width: Math.max(180, Math.min(width, group.position.width)),
        height: Math.max(100, Math.min(height, group.position.height)),
      },
    }));
    // External windows are reopened only by an explicit click, never by restoring saved data.
    delete state.popoutGroups;
    delete state.edgeGroups;
    const seen = new Set<string>();
    let count = 0;
    const check = (value: unknown, depth = 0): boolean => {
      if (++count > 400 || depth > 20) return false;
      if (!value || typeof value !== 'object') return true;
      const object = value as Record<string, unknown>;
      if (Array.isArray(object.views))
        for (const id of object.views) {
          if (typeof id !== 'string' || !state.panels[id] || seen.has(id)) return false;
          seen.add(id);
        }
      return Object.values(object).every((item) => check(item, depth + 1));
    };
    if (!check(state.grid) || !check(state.floatingGroups)) return null;
    if (seen.size !== Object.keys(state.panels).length) return null;
    return {
      grid: state.grid,
      panels: state.panels,
      activeGroup: state.activeGroup,
      floatingGroups: state.floatingGroups,
    };
  } catch {
    return null;
  }
}
