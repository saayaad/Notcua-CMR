import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useApi } from './ApiContext';
export interface HudBlockPosition {
  mode: 'dock' | 'floating';
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface PinnedButtonSettings {
  label?: string;
  category?: string;
  preview?: 'inherit' | 'always' | 'never';
}
export interface Preferences {
  dockingEnabled: boolean;
  dockingLayout: string;
  attendanceCustomizationVersion: number;
  shortcutLabels: Record<string, string>;
  shortcutKeys: Record<string, string>;
  showPinnedPreview: boolean;
  pinnedButtonSettings: Record<string, PinnedButtonSettings>;
  hudBlockPositions: Record<string, HudBlockPosition>;
  waitingTimer: boolean;
  waitingYellow: number;
  waitingRed: number;
  theme: string;
  brandingName: string;
  brandingLogo: string;
  accentColor: string;
  secondaryColor: string;
  favicon: string;
  density: 'compact' | 'medium' | 'expanded';
  panelPosition: 'right' | 'left';
  toolsVisible: boolean;
  toolsCompact: boolean;
  toolsDocked: boolean;
  attendanceShortcutOrder: string[];
  attendanceHiddenShortcuts: string[];
  recentResourceIds: string[];
  favoriteResourceIds: string[];
  workbenchResourceOrder: string[];
  pinnedResourceIds: string[];
  attendanceFunctionsPosition: 'top' | 'bottom';
  hudPanelOrder: string[];
  hudHeaderOrder: string[];
  hudHiddenActions: string[];
  hudToolOrder: string[];
  hudHiddenTools: string[];
  hudListWidth: number;
  hudToolsWidth: number;
  hudToolNav: 'top' | 'side';
  hudPanelLayout: 'columns' | 'rows';
  attendanceShortcutPosition: 'top' | 'bottom' | 'left' | 'right';
  folderLabels: Record<string, string>;
  labelStyles: Record<string, { color: string; icon: string }>;
  menuLabels: Record<string, string>;
  compactNav: boolean;
  hideNames: boolean;
  hidePhotos: boolean;
  hidePreviews: boolean;
  hideMessages: boolean;
  hideMedia: boolean;
  signature: string;
  signatureEnabled: boolean;
  pasteName: boolean;
  replacements: string;
  desktopNotifications: boolean;
  hiddenViews: string[];
  menuGroupOrder: string[];
  menuOrder: string[];
  folderOrder: string[];
  resourceOrder: Record<string, string[]>;
}
const defaults: Preferences = {
  dockingEnabled: false,
  dockingLayout: '',
  attendanceCustomizationVersion: 3,
  shortcutLabels: {},
  shortcutKeys: {},
  showPinnedPreview: true,
  pinnedButtonSettings: {},
  hudBlockPositions: {},
  waitingTimer: true,
  waitingYellow: 5,
  waitingRed: 15,
  theme: localStorage.getItem('noctua-theme') ?? 'dark',
  brandingName: 'noctua',
  brandingLogo: '',
  accentColor: '#a68bfa',
  secondaryColor: '#530f7e',
  favicon: '',
  density: 'compact',
  panelPosition: 'right',
  toolsVisible: true,
  toolsCompact: true,
  toolsDocked: false,
  attendanceShortcutOrder: [
    'faq',
    'MESSAGE',
    'AUDIO',
    'MEDIA',
    'FUNNEL',
    'client',
    'schedule',
    'next',
    'notes',
    'PIX',
    'DOCUMENT',
    'MACRO',
    'transfers',
  ],
  attendanceHiddenShortcuts: [
    'faq',
    'MESSAGE',
    'AUDIO',
    'MEDIA',
    'FUNNEL',
    'DOCUMENT',
    'MACRO',
    'PIX',
    'client',
    'schedule',
    'notes',
    'next',
    'transfers',
  ],
  recentResourceIds: [],
  favoriteResourceIds: [],
  workbenchResourceOrder: [],
  pinnedResourceIds: [],
  attendanceFunctionsPosition: 'top',
  hudPanelOrder: [],
  hudHeaderOrder: ['summary', 'schedule', 'archive', 'flow', 'ai'],
  hudHiddenActions: ['flow', 'ai'],
  hudToolOrder: ['responses', 'profile', 'notes', 'transfers', 'settings'],
  hudHiddenTools: ['responses', 'faq', 'next', 'profile', 'notes', 'transfers', 'settings'],
  hudListWidth: 17,
  hudToolsWidth: 18,
  hudToolNav: 'top',
  hudPanelLayout: 'columns',
  attendanceShortcutPosition: 'bottom',
  folderLabels: {},
  labelStyles: {},
  menuLabels: {},
  compactNav: false,
  hideNames: false,
  hidePhotos: false,
  hidePreviews: false,
  hideMessages: false,
  hideMedia: false,
  signature: '',
  signatureEnabled: false,
  pasteName: false,
  replacements: '',
  desktopNotifications: false,
  hiddenViews: [],
  menuGroupOrder: [],
  menuOrder: [],
  folderOrder: [],
  resourceOrder: {},
};
export function normalizeAttendancePreferences(value: Partial<Preferences>): Preferences {
  const result = { ...defaults, ...value, brandingName: 'noctua' };
  if ((value.attendanceCustomizationVersion ?? 0) < 3) {
    result.attendanceHiddenShortcuts = [...defaults.attendanceHiddenShortcuts];
    result.hudHiddenTools = [...defaults.hudHiddenTools];
    result.pinnedResourceIds = [];
    result.density = 'compact';
    result.attendanceCustomizationVersion = 3;
  }
  return result;
}
const Context = createContext<{
  preferences: Preferences;
  updatePreferences: (value: Partial<Preferences>) => void;
  savePreferences: (value: Partial<Preferences>) => Promise<void>;
}>({ preferences: defaults, updatePreferences: () => undefined, savePreferences: async () => undefined });
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { request } = useApi();
  const ready = useRef(false);
  const [preferences, setPreferences] = useState<Preferences>(() => {
    try {
      return normalizeAttendancePreferences(JSON.parse(localStorage.getItem('noctua-preferences') ?? '{}'));
    } catch {
      return defaults;
    }
  });
  useEffect(() => {
    localStorage.setItem('noctua-preferences', JSON.stringify(preferences));
    localStorage.setItem('noctua-theme', preferences.theme);
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.style.setProperty('--accent', preferences.accentColor);
    document.documentElement.style.setProperty('--accent-secondary', preferences.secondaryColor);
    document.documentElement.dataset.density = preferences.density;
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (preferences.favicon) {
      const link = favicon ?? document.createElement('link');
      link.rel = 'icon';
      link.href = preferences.favicon;
      link.dataset.noctuaCustom = 'true';
      if (!favicon) document.head.append(link);
    } else if (favicon?.dataset.noctuaCustom === 'true') favicon.remove();
    document.documentElement.style.setProperty(
      '--accent-bg',
      `color-mix(in srgb, ${preferences.accentColor} 20%, var(--surface))`,
    );
    for (const [key, name] of [
      ['hideNames', 'private-names'],
      ['hidePhotos', 'private-photos'],
      ['hidePreviews', 'private-previews'],
      ['hideMessages', 'private-messages'],
      ['hideMedia', 'private-media'],
      ['compactNav', 'compact-navigation'],
    ] as const)
      document.documentElement.classList.toggle(name, preferences[key]);
  }, [preferences]);
  useEffect(() => {
    let active = true;
    void request<Partial<Preferences>>('/operations/settings/preferences')
      .then((saved) => {
        if (active)
          setPreferences((current) =>
            normalizeAttendancePreferences({
              ...current,
              ...saved,
              attendanceCustomizationVersion: saved.attendanceCustomizationVersion ?? 0,
            }),
          );
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) ready.current = true;
      });
    return () => {
      active = false;
    };
  }, [request]);
  useEffect(() => {
    if (!ready.current) return;
    const timer = window.setTimeout(() => {
      void request('/operations/settings/preferences', 'PUT', preferences).catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [preferences, request]);
  return (
    <Context.Provider
      value={{
        preferences,
        updatePreferences: (value) =>
          setPreferences((current) => ({ ...current, ...value, brandingName: 'noctua' })),
        savePreferences: async (value) => {
          const next = { ...preferences, ...value, brandingName: 'noctua' };
          await request('/operations/settings/preferences', 'PUT', next);
          setPreferences(next);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const usePreferences = () => useContext(Context);
