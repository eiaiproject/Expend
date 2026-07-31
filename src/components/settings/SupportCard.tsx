import { useTranslation } from 'react-i18next';
import { Coffee } from 'reicon-react';
import { TRAKTEER_URL } from '../../services/supportService';

/**
 * Permanent Settings support card (master.md 9.1).
 *
 * Placed after Backup & Restore so it is visible without excessive
 * scrolling, but never competes with the primary product actions.
 * The external link carries no financial or user data.
 */
export function SupportCard() {
  const { t } = useTranslation();

  return (
    <div
      role="region"
      aria-label={t('settings.supportCardTitle')}
      className="rounded-2xl border border-[var(--accent)]/25 bg-gradient-to-br from-[var(--accent)]/10 via-[var(--card)] to-[var(--card)] p-5 space-y-3"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/15 flex items-center justify-center shrink-0">
          <Coffee size={20} className="text-[var(--accent)]" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('settings.supportCardTitle')}</h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-1">
            {t('settings.supportCardBody')}
          </p>
        </div>
      </div>

      <a
        href={TRAKTEER_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-[var(--accent)] text-white font-bold hover:opacity-90 active:scale-95 transition-[opacity,transform] shadow-lg shadow-[var(--accent)]/20 min-h-[44px]"
      >
        {t('settings.supportCardAction')}
        <span aria-hidden="true">↗</span>
        <span className="sr-only">{t('settings.opensExternalSite')}</span>
      </a>

      <p className="text-xs text-center text-[var(--text-secondary)]">
        {t('settings.supportCardNote')}
      </p>
    </div>
  );
}
