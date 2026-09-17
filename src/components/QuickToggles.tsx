import { Moon, Sun } from 'reicon-react';
import { useTranslation } from '../i18n';
import type { Lang } from '../i18n';
import { useTheme, type Theme } from '../utils/theme';
import type { TranslationKey } from '../i18n/id';

const THEME_LABEL_KEY: Record<Theme, TranslationKey> = {
  light: 'settings.themeLight',
  dark: 'settings.themeDark',
};

/** Toggle biner light ↔ dark. Ikon mencerminkan tema aktif. */
export function ThemeCycleButton() {
  const { t } = useTranslation();
  const { theme, cycleTheme } = useTheme();
  const Icon = theme === 'light' ? Sun : Moon;
  const label = `${t('settings.theme')}: ${t(THEME_LABEL_KEY[theme])}`;
  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={label}
      title={label}
      className="min-w-11 min-h-11 w-11 h-11 grid place-items-center rounded-full bg-[var(--card)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bone)] active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
    >
      <Icon size={18} aria-hidden />
    </button>
  );
}

/** Segmen kompak ID | EN. */
export function LangToggle() {
  const { t, lang, setLang } = useTranslation();
  return (
    <fieldset className="flex items-center rounded-full bg-[var(--card)] border border-[var(--border)] p-1 gap-0.5 m-0 min-w-0">
      <legend className="sr-only">{t('settings.language')}</legend>
      {(['id', 'en'] as const).map((l: Lang) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          aria-label={`${t('settings.language')}: ${l === 'id' ? 'Bahasa Indonesia' : 'English'}`}
          onClick={() => setLang(l)}
          className={`min-w-11 min-h-9 px-2.5 rounded-full text-[11px] font-bold tracking-wide transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 ${
            lang === l ? 'bg-[var(--accent-fill)] text-[var(--accent-ink)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bone)]'
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </fieldset>
  );
}

/** Aksi cepat header: tema + bahasa. Dipakai di Summary & Chat. */
export function QuickToggles() {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <LangToggle />
      <ThemeCycleButton />
    </div>
  );
}
