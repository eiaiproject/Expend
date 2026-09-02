/**
 * Standalone translate function for use outside React components.
 * Falls back to Indonesian if no language is set.
 */
import type { TranslationKey } from './id';
import id from './id';
import en from './en';

const STORAGE_KEY = 'expend_lang';
const dictionaries = { id, en };

function getLang(): 'id' | 'en' {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'id' || stored === 'en') return stored;
  } catch {}
  return 'id';
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const lang = getLang();
  let str = dictionaries[lang][key] ?? dictionaries.id[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}
