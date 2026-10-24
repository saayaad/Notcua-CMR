import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
export interface Preferences {
  waitingTimer: boolean;
  waitingYellow: number;
  waitingRed: number;
  theme: string;
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
