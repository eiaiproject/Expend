import { useTranslation } from 'react-i18next';
import { ArrowDown } from 'reicon-react';

export function HeroSection({ onEnter }: { onEnter?: () => void }) {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden pt-24 pb-12 sm:pt-28 sm:pb-16 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] items-center gap-8 lg:gap-16 lg:min-h-[70svh]">
        {/* Copy */}
        <div className="text-center lg:text-left max-w-2xl mx-auto lg:mx-0">
          {/* Eyebrow */}
          <p className="text-xs sm:text-sm font-medium text-[var(--accent)] tracking-wide uppercase mb-4">
            {t('landing.eyebrow')}
          </p>

          {/* Heading */}
          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-5 text-[var(--text-primary)] leading-[1.1]"
            style={{ fontFamily: 'var(--font-display)', textWrap: 'balance' }}
          >
            {t('landing.heroTitle')}
          </h1>

          {/* Description */}
          <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed" style={{ textWrap: 'pretty' }}>
            {t('landing.heroDesc')}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-4">
            <button
              type="button"
              onClick={onEnter}
              className="w-full sm:w-auto px-8 py-3.5 bg-[var(--accent-fill)] text-white rounded-full font-semibold text-base hover:opacity-90 transition-opacity active:scale-95 cursor-pointer"
            >
              {t('landing.heroCtaPrimary')}
            </button>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto px-8 py-3.5 border border-[var(--border-subtle)] text-[var(--text-secondary)] rounded-full font-medium text-base hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors text-center"
            >
              {t('landing.heroCtaSecondary')}
            </a>
          </div>

          {/* Microcopy */}
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mb-8">
            {t('landing.heroMicrocopy')}
          </p>

          {/* Scroll hint */}
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <ArrowDown size={14} aria-hidden="true" />
            <span>{t('landing.scrollDown', 'Scroll down')}</span>
          </a>
        </div>

        {/* App Preview Mockup */}
        <div
          aria-hidden="true"
          className="relative mx-auto w-full max-w-[300px] sm:max-w-[340px] lg:max-w-[380px] lg:justify-self-center"
        >
          <div className="relative">
            {/* Phone Frame */}
            <div className="relative bg-[var(--surface)] rounded-[1.5rem] p-3 sm:p-4 shadow-2xl shadow-black/40 border border-[var(--border-subtle)]">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-6 bg-[var(--surface)] rounded-b-2xl z-20" />

              {/* Screen */}
              <div className="bg-[var(--bg)] rounded-[1.15rem] overflow-hidden">
                {/* Status Bar */}
                <div className="h-10 flex items-center justify-between px-6 pt-2">
                  <span className="text-[10px] text-white/50 font-medium">9:41</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-2.5 bg-white/50 rounded-sm" />
                    <div className="w-4 h-2.5 bg-white/50 rounded-sm" />
                  </div>
                </div>

                {/* App Content */}
                <div className="px-4 pb-6">
                  {/* Header */}
                  <div className="flex justify-between items-center mb-4 mt-1">
                    <div>
                      <h2 className="text-lg font-bold tracking-tight uppercase text-white">Expend</h2>
                      <p className="text-[10px] text-white/40">{t('landing.demoDate')}</p>
                    </div>
                  </div>

                  {/* Balance Card */}
                  <div className="bg-[var(--accent)] rounded-2xl p-4 mb-4">
                    <p className="text-white/70 text-[10px] font-medium mb-1">{t('Balance')}</p>
                    <p className="text-xl font-bold text-white font-mono">Rp 5.240.000</p>
                    <div className="flex gap-2 mt-3">
                      <div className="flex-1 bg-white/10 rounded-lg p-2">
                        <p className="text-[8px] text-white/50 uppercase font-bold">{t('Today')}</p>
                        <p className="text-xs font-bold text-white font-mono">Rp 150.000</p>
                      </div>
                      <div className="flex-1 bg-white/10 rounded-lg p-2">
                        <p className="text-[8px] text-white/50 uppercase font-bold">{t('Yesterday')}</p>
                        <p className="text-xs font-bold text-white font-mono">Rp 85.000</p>
                      </div>
                    </div>
                  </div>

                  {/* Transaction Items */}
                  <div className="space-y-2">
                    {[
                      { name: t('landing.demoLunch'), amount: '45.000', time: '12:30', color: 'bg-red-400' },
                      { name: t('landing.demoTransport'), amount: '25.000', time: '08:15', color: 'bg-orange-400' },
                      { name: t('landing.demoCoffee'), amount: '35.000', time: t('Yesterday'), color: 'bg-amber-400' },
                    ].map((tx, i) => (
                      <div key={i} className="bg-[var(--card)] rounded-xl p-3 flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full ${tx.color} flex items-center justify-center shrink-0`}>
                          <div className="w-2 h-2 bg-white/80 rounded-full" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{tx.name}</p>
                          <p className="text-[10px] text-white/40">{tx.time}</p>
                        </div>
                        <p className="text-xs font-bold text-red-400 font-mono shrink-0">-{tx.amount}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Glow Effect */}
            <div className="absolute -inset-6 bg-[var(--accent)]/8 blur-[40px] rounded-full -z-10" />
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
