import id from './id';
import en from './en';
import type { TranslationKey } from './id';

export type Lang = 'id' | 'en';
export const STORAGE_KEY = 'expend_lang';
export const dictionaries: Record<Lang, Record<TranslationKey, string>> = { id, en };

export function getStoredLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'id' || stored === 'en') return stored;
  } catch {}
  return 'id';
}

export function translate(lang: Lang, key: TranslationKey, params?: Record<string, string | number>): string {
  let str = dictionaries[lang][key] ?? dictionaries.id[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}

/** Standalone translate for non-React modules (reads stored lang). */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  return translate(getStoredLang(), key, params);
}
