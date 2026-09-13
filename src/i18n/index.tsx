import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { TranslationKey } from './id';
import { getStoredLang, translate, STORAGE_KEY } from './shared';
import type { Lang } from './shared';
export type { Lang } from './shared';

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { readonly children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(getStoredLang);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
  }, [lang]);

  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>) => translate(lang, key, params), [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used within I18nProvider');
  return ctx;
}
