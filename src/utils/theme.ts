import { useCallback, useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';
export const THEME_KEY = 'theme';

export function getTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {}
  return 'system';
}

/** Terapkan tema tersimpan ke <html> saat boot. Idempoten. */
export function applyTheme(): void {
  const root = document.documentElement;
  const t = getTheme();
  if (t === 'system') {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = t;
  }
}

export function setStoredTheme(t: Theme): void {
  try {
    if (t === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch {}
  applyTheme();
}

export function nextTheme(t: Theme): Theme {
  if (t === 'system') return 'light';
  if (t === 'light') return 'dark';
  return 'system';
}

/** State tema bersama agar header cepat & dropdown Settings selalu sinkron. */
export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void; cycleTheme: () => void } {
  const [theme, setThemeState] = useState<Theme>(getTheme);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === THEME_KEY) setThemeState(getTheme());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const setTheme = useCallback((t: Theme) => {
    setStoredTheme(t);
    setThemeState(t);
  }, []);
  const cycleTheme = useCallback(() => {
    setThemeState((prev) => {
      const n = nextTheme(prev);
      setStoredTheme(n);
      return n;
    });
  }, []);
  return { theme, setTheme, cycleTheme };
}
