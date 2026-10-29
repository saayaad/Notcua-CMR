import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useApi, errorMessage } from './ApiContext';
import { PreferenceSaveQueue } from './preferences-save';
import { firebaseAuth } from '../auth/firebase';
import type { HudBlockPosition } from './hud-placement.js';
export type { HudBlockPosition } from './hud-placement.js';
export interface PinnedButtonSettings {
  label?: string;
  category?: string;
  preview?: 'inherit' | 'always' | 'never';
}
export interface Preferences {
  leadSort: 'priority' | 'recent' | 'oldest' | 'waiting';
  leadResponse: 'all' | 'ours' | 'client' | 'never';
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
  leadSort: 'priority',
  leadResponse: 'all',
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
  saveError: string;
  retrySave: () => void;
}>({
  preferences: defaults,
  updatePreferences: () => undefined,
  savePreferences: async () => undefined,
  saveError: '',
  retrySave: () => undefined,
});
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const storageKey = `noctua-preferences:${firebaseAuth?.currentUser?.uid ?? 'local'}`;
  const { request, notify } = useApi();
  const [saveError, setSaveError] = useState('');
  const [loadRevision, setLoadRevision] = useState(0);
  const writer = useRef(new PreferenceSaveQueue());
  const saveRevision = useRef(0);
  const lastSaved = useRef('');
  const ready = useRef(false);
  const [preferences, setPreferences] = useState<Preferences>(() => {
    try {
      return normalizeAttendancePreferences(JSON.parse(localStorage.getItem(storageKey) ?? '{}'));
    } catch {
      return defaults;
    }
  });
  const persist = useCallback(
    async (snapshot: Preferences) => {
      const revision = ++saveRevision.current;
      try {
        if (!ready.current) throw new Error('Aguarde carregar as preferências da conta antes de salvar.');
        await writer.current.run(() => request('/operations/settings/preferences', 'PUT', snapshot));
        lastSaved.current = JSON.stringify(snapshot);
        if (revision === saveRevision.current) setSaveError('');
      } catch (error) {
        if (revision === saveRevision.current) {
          const message = errorMessage(error);
          setSaveError(message);
          notify(
            `Não foi possível salvar suas preferências na conta. Elas continuam neste navegador. ${message}`,
            true,
          );
        }
        throw error;
      }
    },
    [request, notify],
  );
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(preferences));
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
        if (active) {
          ready.current = true;
          setSaveError('');
          setPreferences((current) => {
            const next = normalizeAttendancePreferences({
              ...current,
              ...saved,
              attendanceCustomizationVersion: saved.attendanceCustomizationVersion ?? 0,
            });
            lastSaved.current = JSON.stringify(next);
            return next;
          });
        }
      })
      .catch((error) => {
        if (active) {
          ready.current = false;
          setSaveError(errorMessage(error));
          notify(`Não foi possível carregar suas preferências da conta. ${errorMessage(error)}`, true);
        }
      });
    return () => {
      active = false;
    };
  }, [request, notify, loadRevision]);
  useEffect(() => {
    if (!ready.current) return;
    if (lastSaved.current === JSON.stringify(preferences)) return;
    const timer = window.setTimeout(() => {
      void persist(preferences).catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [preferences, persist]);
  return (
    <Context.Provider
      value={{
        preferences,
        saveError,
        retrySave: () => {
          if (!ready.current) setLoadRevision((value) => value + 1);
          else void persist(preferences).catch(() => undefined);
        },
        updatePreferences: (value) =>
          setPreferences((current) => ({ ...current, ...value, brandingName: 'noctua' })),
        savePreferences: async (value) => {
          const next = { ...preferences, ...value, brandingName: 'noctua' };
          await persist(next);
          setPreferences((current) => ({ ...current, ...value, brandingName: 'noctua' }));
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const usePreferences = () => useContext(Context);
