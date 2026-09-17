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
