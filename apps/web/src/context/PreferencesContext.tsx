import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useApi } from './ApiContext';
export interface Preferences {
  waitingTimer: boolean;
  waitingYellow: number;
  waitingRed: number;
  theme: string;
  brandingName: string;
  brandingLogo: string;
  accentColor: string;
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
  waitingTimer: true,
  waitingYellow: 5,
  waitingRed: 15,
  theme: localStorage.getItem('noctua-theme') ?? 'dark',
  brandingName: 'noctua',
  brandingLogo: '',
  accentColor: '#a68bfa',
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
const Context = createContext<{
  preferences: Preferences;
  updatePreferences: (value: Partial<Preferences>) => void;
}>({ preferences: defaults, updatePreferences: () => undefined });
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { request } = useApi();
  const ready = useRef(false);
  const [preferences, setPreferences] = useState<Preferences>(() => {
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem('noctua-preferences') ?? '{}') };
    } catch {
      return defaults;
    }
  });
  useEffect(() => {
    localStorage.setItem('noctua-preferences', JSON.stringify(preferences));
    localStorage.setItem('noctua-theme', preferences.theme);
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.style.setProperty('--accent', preferences.accentColor);
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
        if (active) setPreferences((current) => ({ ...current, ...saved }));
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
        updatePreferences: (value) => setPreferences((current) => ({ ...current, ...value })),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const usePreferences = () => useContext(Context);
