import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DARK_THEME_ENABLED } from '../config/features';

/**
 * Light / dark theme for the signed-in workspace.
 *
 * The preference is per browser (localStorage) and defaults to light, so nobody
 * is switched to dark without choosing it. The `dark` class on <html> is only
 * applied while the workspace Layout is mounted (see `useApplyTheme`): public
 * pages — landing, login, shareable profiles, certificates — stay light.
 *
 * index.html applies the same rule before React loads, so a dark-theme user does
 * not see a light flash on reload. Keep STORAGE_KEY in sync with it.
 */
export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'ix-theme';
const DEFAULT_PREFERENCE: ThemePreference = 'light';
const DARK_QUERY = '(prefers-color-scheme: dark)';

const isPreference = (value: unknown): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system';

const readPreference = (): ThemePreference => {
  if (!DARK_THEME_ENABLED) return 'light';
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : DEFAULT_PREFERENCE;
  } catch {
    return DEFAULT_PREFERENCE;
  }
};

const systemPrefersDark = () => {
  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
};

interface ThemeContextValue {
  /** False when the feature flag is off: the toggle is hidden and the theme is light. */
  enabled: boolean;
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  enabled: false,
  preference: 'light',
  resolved: 'light',
  setPreference: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    if (!DARK_THEME_ENABLED) return;
    let media: MediaQueryList;
    try {
      media = window.matchMedia(DARK_QUERY);
    } catch {
      return;
    }
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  // Keep tabs in step when the preference changes in another one.
  useEffect(() => {
    if (!DARK_THEME_ENABLED) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) setPreferenceState(readPreference());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    if (!DARK_THEME_ENABLED) return;
    setPreferenceState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode or blocked storage: the choice lasts for this tab only.
    }
  }, []);

  const resolved: ResolvedTheme =
    DARK_THEME_ENABLED && (preference === 'dark' || (preference === 'system' && systemDark)) ? 'dark' : 'light';

  const value = useMemo(
    () => ({ enabled: DARK_THEME_ENABLED, preference, resolved, setPreference }),
    [preference, resolved, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);

/** Applies the resolved theme to <html> while the calling component is mounted. */
export const useApplyTheme = () => {
  const { resolved } = useTheme();
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    return () => root.classList.remove('dark');
  }, [resolved]);
};
