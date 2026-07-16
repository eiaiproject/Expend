import { useTranslation } from 'react-i18next';
import { Zap, Shield, Wifi, Wallet, Tags, ArrowLeftRight, Handshake, BarChart3, Search } from 'lucide-react';

const benefits = [
  { icon: Zap, titleKey: 'landing.benefit1Title', descKey: 'landing.benefit1Desc' },
  { icon: Shield, titleKey: 'landing.benefit2Title', descKey: 'landing.benefit2Desc' },
  { icon: Wifi, titleKey: 'landing.benefit3Title', descKey: 'landing.benefit3Desc' },
];

const features = [
  { icon: Wallet, titleKey: 'landing.featureWalletTitle', descKey: 'landing.featureWalletDesc' },
  { icon: Tags, titleKey: 'landing.featureBudgetTitle', descKey: 'landing.featureBudgetDesc' },
  { icon: ArrowLeftRight, titleKey: 'landing.featureTransferTitle', descKey: 'landing.featureTransferDesc' },
  { icon: Handshake, titleKey: 'landing.featureDebtTitle', descKey: 'landing.featureDebtDesc' },
  { icon: BarChart3, titleKey: 'landing.featureChartsTitle', descKey: 'landing.featureChartsDesc' },
  { icon: Search, titleKey: 'landing.featureSearchTitle', descKey: 'landing.featureSearchDesc' },
];

export function FeaturesSection() {
  const { t } = useTranslation();

  return (
    <section id="features-section" className="scroll-mt-20 py-16 sm:py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        {/* Benefits */}
        <div className="text-center mb-16 sm:mb-20">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)] mb-3" style={{ textWrap: 'balance' }}>
            {t('landing.benefitsTitle')}
          </h2>
          <p className="text-base sm:text-lg text-[var(--text-muted)] max-w-lg mx-auto mb-12" style={{ textWrap: 'pretty' }}>
            {t('landing.benefitsSubtitle')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {benefits.map(({ icon: Icon, titleKey, descKey }, i) => (
              <div key={i} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--accent)]/10 mb-4">
                  <Icon size={22} className="text-[var(--accent)]" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                  {t(titleKey)}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-xs mx-auto">
                  {t(descKey)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Finance Features */}
        <div className="border-t border-[var(--border-subtle)] pt-14 sm:pt-16">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-3" style={{ textWrap: 'balance' }}>
              {t('landing.financeTitle')}
            </h2>
            <p className="text-sm sm:text-base text-[var(--text-muted)] max-w-lg mx-auto" style={{ textWrap: 'pretty' }}>
              {t('landing.financeSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(({ icon: Icon, titleKey, descKey }, i) => (
              <div
                key={i}
                className="p-5 rounded-xl bg-[var(--surface)]/50 border border-[var(--border-subtle)] hover:border-[var(--accent)]/20 transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center mb-3 group-hover:bg-[var(--accent)]/15 transition-colors">
                  <Icon size={18} className="text-[var(--accent)]" />
                </div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1.5">
                  {t(titleKey)}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {t(descKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
