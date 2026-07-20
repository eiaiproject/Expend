import { useTranslation } from 'react-i18next';
import { Plus, Refresh, ChartBar } from 'reicon-react';

const steps = [
  { icon: Plus, key: 1 },
  { icon: Refresh, key: 2 },
  { icon: ChartBar, key: 3 },
] as const;

export function HowItWorksSection() {
  const { t } = useTranslation();

  return (
    <section id="how-it-works" className="scroll-mt-20 py-16 sm:py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)] mb-3" style={{ textWrap: 'balance' }}>
            {t('landing.howTitle')}
          </h2>
          <p className="text-base sm:text-lg text-[var(--text-muted)] max-w-lg mx-auto" style={{ textWrap: 'pretty' }}>
            {t('landing.howSubtitle')}
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
          {steps.map(({ icon: Icon, key }, i) => (
            <div key={i} className="relative text-center group">
              {/* Connector line (desktop) */}
              {i < steps.length - 1 && (
                <div className="hidden sm:block absolute top-8 left-[calc(50%+40px)] right-[calc(-50%+40px)] h-px bg-[var(--border-subtle)]" aria-hidden="true" />
              )}

              {/* Step number + icon */}
              <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--accent)]/10 mb-5 group-hover:bg-[var(--accent)]/15 transition-colors">
                <Icon size={24} className="text-[var(--accent)]" />
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[var(--accent)] text-[var(--bg)] text-xs font-bold flex items-center justify-center">
                  {key}
                </span>
              </div>

              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                {t(`landing.howStep${key}Title`)}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-xs mx-auto">
                {t(`landing.howStep${key}Desc`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
