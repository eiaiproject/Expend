import { useTranslation } from 'react-i18next';
import { Github } from 'lucide-react';

export function HeroSection({ onTryWeb, onEnter }: { onTryWeb: () => void; onEnter?: () => void }) {
  const { t } = useTranslation();

  return (
    <section
      className="min-h-[88svh] px-4 sm:px-6 relative overflow-hidden pt-20 pb-6 sm:pt-24 sm:pb-14"
    >
      <div className="mx-auto grid w-full max-w-6xl items-center gap-6 sm:gap-10 lg:min-h-[calc(86svh-6rem)] lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:gap-16">
        <div
          className="text-center z-10 w-full max-w-3xl mx-auto lg:mx-0 lg:max-w-xl lg:text-left"
        >
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--surface)]/50 border border-[var(--border-subtle)] rounded-full mb-6"
          >
            <span className="w-2 h-2 rounded-full bg-[var(--accent)]" aria-hidden="true" />
            <span className="text-xs sm:text-sm text-[var(--text-muted)]">
              {t('landing.badge')}
            </span>
          </div>

          {/* Title */}
          <h1
            className="text-6xl sm:text-7xl md:text-8xl font-bold tracking-tight mb-5 text-[var(--text-primary)] text-balance"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Expend
          </h1>

          {/* Tagline */}
          <p
            className="text-base sm:text-lg md:text-xl text-[var(--text-secondary)] max-w-xl mx-auto lg:mx-0 mb-8 sm:mb-10 font-light leading-relaxed text-pretty"
          >
            {t('landing.tagline')}
          </p>

          {/* CTA Buttons */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4 mb-8 sm:mb-10"
          >
            <button
              type="button"
              onClick={onEnter}
              className="w-full sm:w-auto px-8 sm:px-10 py-3.5 sm:py-4 bg-[var(--accent)] text-[var(--bg)] rounded-full font-semibold text-base sm:text-lg hover:bg-[var(--accent)]/90 transition-colors active:scale-95 cursor-pointer"
            >
              {t('landing.startTracking')}
            </button>
            <button
              type="button"
              onClick={onTryWeb}
              className="w-full sm:w-auto px-8 sm:px-10 py-3.5 sm:py-4 bg-transparent border border-[var(--border-subtle)] text-[var(--text-muted)] rounded-full font-medium text-base sm:text-lg hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors active:scale-95 cursor-pointer"
            >
              {t('landing.tryWithoutSetup')}
            </button>
          </div>

          {/* Trust Pills */}
          <ul className="flex flex-wrap justify-center lg:justify-start gap-2 mb-6 sm:mb-8">
            {[
              [t('landing.featurePrivacyTitle'), '#faq-section'],
              [t('landing.featureOfflineTitle'), '#faq-section'],
              [t('landing.featureSecurityTitle'), '#faq-section'],
            ].map(([label, href]) => (
              <li key={label}>
                <a
                  href={href}
                  className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)]/40 px-3 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>

          {/* GitHub Link */}
          <div>
            <a
              href="https://github.com/eiaiproject/Expend.git"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center lg:justify-start gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-sm"
            >
              <Github size={16} aria-hidden="true" />
              <span>{t('landing.source')}</span>
              <span className="text-[var(--border-subtle)]" aria-hidden="true">
                |
              </span>
              <span>{t('landing.openSource')}</span>
            </a>
          </div>
        </div>

        {/* App Preview Mockup */}
        <div
          aria-hidden="true"
          className="relative z-10 mx-auto w-full max-w-[320px] max-h-[260px] overflow-hidden sm:max-w-[360px] sm:max-h-[360px] lg:max-w-[380px] lg:max-h-none lg:justify-self-center"
        >
          <div className="relative">
            {/* Phone Frame */}
            <div className="relative bg-[var(--surface)] rounded-[1.25rem] sm:rounded-[1.5rem] p-3 sm:p-4 shadow-2xl shadow-black/45 border border-[var(--border-subtle)]">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 sm:w-40 h-6 sm:h-7 bg-[var(--surface)] rounded-b-2xl z-20" />

              {/* Screen */}
              <div className="bg-[var(--bg)] rounded-xl sm:rounded-[1.25rem] overflow-hidden">
                {/* Status Bar */}
                <div className="h-10 sm:h-12 flex items-center justify-between px-6 sm:px-8 pt-2">
                  <span className="text-[10px] sm:text-xs text-white/60 font-medium">9:41</span>
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <div className="w-3 sm:w-4 h-2 sm:h-2.5 bg-white/60 rounded-sm" />
                    <div className="w-3 sm:w-4 h-2 sm:h-2.5 bg-white/60 rounded-sm" />
                    <div className="w-4 sm:w-5 h-2 sm:h-2.5 bg-white/60 rounded-sm" />
                  </div>
                </div>

                {/* App Content */}
                <div className="px-4 sm:px-5 pb-6 sm:pb-8">
                  {/* Header */}
                  <div className="flex justify-between items-center mb-4 sm:mb-6 mt-2">
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold tracking-tight uppercase text-white">
                        Expend
                      </h3>
                      <p className="text-[10px] sm:text-xs text-white/50">{t('landing.demoDate')}</p>
                    </div>
                  </div>

                  {/* Balance Card */}
                  <div className="bg-[var(--accent)] rounded-2xl sm:rounded-3xl p-4 sm:p-5 mb-4 sm:mb-5">
                    <p className="text-white/80 text-[10px] sm:text-xs font-medium mb-1">{t('Balance')}</p>
                    <p className="text-xl sm:text-2xl font-bold text-white font-mono">
                      Rp 5.240.000
                    </p>
                    <div className="flex gap-2 mt-3 sm:mt-4">
                      <div className="flex-1 bg-white/10 rounded-lg sm:rounded-xl p-2 sm:p-2.5">
                        <p className="text-[8px] sm:text-[9px] text-white/60 uppercase font-bold">
                          {t('Today')}
                        </p>
                        <p className="text-xs sm:text-sm font-bold text-white font-mono">
                          Rp 150.000
                        </p>
                      </div>
                      <div className="flex-1 bg-white/10 rounded-lg sm:rounded-xl p-2 sm:p-2.5">
                        <p className="text-[8px] sm:text-[9px] text-white/60 uppercase font-bold">
                          {t('Yesterday')}
                        </p>
                        <p className="text-xs sm:text-sm font-bold text-white font-mono">
                          Rp 85.000
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Transaction Items */}
                  <div className="space-y-2 sm:space-y-2.5">
                    {[
                      {
                        name: t('landing.demoLunch'),
                        amount: '45.000',
                        time: '12:30',
                        color: 'bg-red-400',
                      },
                      {
                        name: t('landing.demoTransport'),
                        amount: '25.000',
                        time: '08:15',
                        color: 'bg-orange-400',
                      },
                      {
                        name: t('landing.demoCoffee'),
                        amount: '35.000',
                        time: t('Yesterday'),
                        color: 'bg-amber-400',
                      },
                    ].map((tx, i) => (
                      <div
                        key={i}
                        className="bg-[var(--card)] rounded-xl sm:rounded-2xl p-3 sm:p-3.5 flex items-center gap-3"
                      >
                        <div
                          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full ${tx.color} flex items-center justify-center shrink-0`}
                        >
                          <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-white/80 rounded-full" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-medium text-white truncate">
                            {tx.name}
                          </p>
                          <p className="text-[10px] sm:text-xs text-white/40">{tx.time}</p>
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-red-400 font-mono shrink-0">
                          -{tx.amount}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Glow Effect */}
            <div className="absolute -inset-6 bg-[var(--accent)]/10 blur-[40px] sm:blur-[60px] rounded-full -z-10" />
          </div>
        </div>
      </div>

      {/* Background */}
      <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-[var(--accent)]/5 blur-[120px] rounded-full" />
      </div>
    </section>
  );
}
