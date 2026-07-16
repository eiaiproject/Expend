import { useTranslation } from 'react-i18next';
import { ShieldCheck, ShieldAlert, ClipboardCheck } from 'lucide-react';

export function PrivacySection() {
  const { t } = useTranslation();

  const protectedItems = [1, 2, 3, 4].map(i => t(`landing.privacyProtected${i}`));
  const notProtectedItems = [1, 2, 3, 4].map(i => t(`landing.privacyNotProtected${i}`));
  const actionItems = [1, 2, 3].map(i => t(`landing.privacyAction${i}`));

  return (
    <section id="privacy-section" className="scroll-mt-20 py-16 sm:py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)] mb-3" style={{ textWrap: 'balance' }}>
            {t('landing.privacyTitle')}
          </h2>
          <p className="text-base sm:text-lg text-[var(--text-muted)] max-w-lg mx-auto" style={{ textWrap: 'pretty' }}>
            {t('landing.privacySubtitle')}
          </p>
        </div>

        {/* Three columns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Protected */}
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <ShieldCheck size={20} className="text-green-400" />
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                {t('landing.privacyProtectedTitle')}
              </h3>
            </div>
            <ul className="space-y-3">
              {protectedItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)] leading-relaxed">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Not Protected */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <ShieldAlert size={20} className="text-amber-400" />
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                {t('landing.privacyNotProtectedTitle')}
              </h3>
            </div>
            <ul className="space-y-3">
              {notProtectedItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)] leading-relaxed">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]/30 p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <ClipboardCheck size={20} className="text-[var(--accent)]" />
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                {t('landing.privacyActionTitle')}
              </h3>
            </div>
            <ul className="space-y-3">
              {actionItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)] leading-relaxed">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
