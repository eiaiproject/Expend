import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const THEME_KEY = 'theme';

export function getTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {}
  return 'dark';
}

/**
 * Warna bilah browser/status per tema. SENGAJA sebangun dengan `--bg` di
 * src/index.css: sebelumnya meta `theme-color` selalu #264025, jadi tema terang
 * tampil dengan chrome gelap di atas halaman hampir putih.
 */
const THEME_COLOR: Record<Theme, string> = { light: '#F7F6F2', dark: '#0a0a0a' };

/** Terapkan tema tersimpan ke <html> + meta theme-color. Idempoten. */
export function applyTheme(): void {
  const theme = getTheme();
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
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
  const [theme, setTheme] = useState<Theme>(getTheme);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === THEME_KEY) setTheme(getTheme());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const persistTheme = useCallback((t: Theme) => {
    setStoredTheme(t);
    setTheme(t);
  }, []);
  const cycleTheme = useCallback(() => {
    setTheme((prev) => {
      const n = nextTheme(prev);
      setStoredTheme(n);
      return n;
    });
  }, []);
  return { theme, setTheme: persistTheme, cycleTheme };
}
