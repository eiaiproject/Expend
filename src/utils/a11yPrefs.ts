export type FontSize = 's' | 'm' | 'l';
export const FONTSIZE_KEY = 'expend_fontsize';
export const CONTRAST_KEY = 'expend_contrast';

export function getFontSize(): FontSize {
  try {
    const v = localStorage.getItem(FONTSIZE_KEY);
    if (v === 's' || v === 'm' || v === 'l') return v;
  } catch {}
  return 'm';
}

export function setFontSize(v: FontSize): void {
  try {
    localStorage.setItem(FONTSIZE_KEY, v);
  } catch {}
  applyA11yPrefs();
}

export function isHighContrast(): boolean {
  try {
    return localStorage.getItem(CONTRAST_KEY) === 'high';
  } catch {
    return false;
  }
}

export function setHighContrast(on: boolean): void {
  try {
    if (on) localStorage.setItem(CONTRAST_KEY, 'high');
    else localStorage.removeItem(CONTRAST_KEY);
  } catch {}
  applyA11yPrefs();
}

/** Terapkan preferensi ke <html>: data-fontsize + data-contrast. Idempoten. */
export function applyA11yPrefs(): void {
  const root = document.documentElement;
  root.dataset.fontsize = getFontSize();
  if (isHighContrast()) root.dataset.contrast = 'high';
  else delete root.dataset.contrast;
}
