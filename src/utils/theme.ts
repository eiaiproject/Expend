import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
export const THEME_KEY = 'theme';

export function getTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {}
  return 'dark';
}

/** Terapkan tema tersimpan ke <html>. Idempoten. */
export function applyTheme(): void {
  document.documentElement.dataset.theme = getTheme();
}

/**
 * Migrasi satu-kali dari era 3 opsi: nilai legacy 'system'/kosong/rusak
 * disampel dari OS lalu disimpan permanen, agar tampilan tak berubah
 * mendadak. Dipanggil saat boot sebelum applyTheme.
 */
export function migrateLegacyTheme(): void {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark') return;
    const dark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? true;
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  } catch {}
}

export function setStoredTheme(t: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {}
  applyTheme();
}

export function nextTheme(t: Theme): Theme {
  return t === 'dark' ? 'light' : 'dark';
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
