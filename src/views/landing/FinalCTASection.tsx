import { useTranslation } from 'react-i18next';

export function FinalCTASection({ onEnter }: { readonly onEnter: () => void }) {
  const { t } = useTranslation();

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)] mb-4" style={{ textWrap: 'balance' }}>
          {t('landing.finalTitle')}
        </h2>
        <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-lg mx-auto mb-8" style={{ textWrap: 'pretty' }}>
          {t('landing.finalDesc')}
        </p>
        <button
          type="button"
          onClick={onEnter}
          className="px-10 py-4 bg-[var(--accent)] text-[var(--bg)] rounded-full font-semibold text-lg hover:opacity-90 transition-opacity active:scale-95 cursor-pointer"
        >
          {t('landing.finalCta')}
        </button>
      </div>
    </section>
  );
}
