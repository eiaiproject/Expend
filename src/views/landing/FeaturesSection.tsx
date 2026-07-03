import { useTranslation } from 'react-i18next';
import { type ReactNode } from 'react';
import {
  Shield,
  Zap,
  Smartphone,
  Wifi,
  BarChart3,
  Wallet,
  Search,
  ArrowLeftRight,
  Tags,
  Lock,
  Globe,
  Handshake,
} from 'lucide-react';

interface FeatureItem {
  icon: ReactNode;
  title: string;
  description: string;
  stats?: string;
}

function FeatureCard({ icon, title, description, stats, index }: FeatureItem & { index: number }) {
  return (
    <div
      className="relative group h-full"
    >
      <div className="p-6 sm:p-8 rounded-xl sm:rounded-2xl bg-[var(--surface)]/50 border border-[var(--border-subtle)] hover:border-[var(--accent)]/30 transition-colors duration-300 h-full flex flex-col">
        {/* Icon */}
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center mb-4 sm:mb-5 group-hover:scale-110 group-hover:bg-[var(--accent)]/20 transition-[transform,background-color] duration-300">
          {icon}
        </div>

        {/* Content */}
        <h3 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)] mb-2 sm:mb-3">
          {title}
        </h3>
        <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
          {description}
        </p>

        {/* Stats Badge */}
        {stats && (
          <div className="mt-auto pt-5 inline-flex w-fit items-center gap-2 px-3 py-1.5 bg-[var(--accent)]/10 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
            <span className="text-xs sm:text-sm font-medium text-[var(--accent)]">{stats}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function FeaturesSection() {
  const { t } = useTranslation();

  const coreFeatures: FeatureItem[] = [
    {
      icon: <Shield size={24} className="text-[var(--accent)]" />,
      title: t('landing.featurePrivacyTitle'),
      description: t('landing.featurePrivacyDesc'),
      stats: t('landing.featurePrivacyStats'),
    },
    {
      icon: <Zap size={24} className="text-[var(--accent)]" />,
      title: t('landing.featureSpeedTitle'),
      description: t('landing.featureSpeedDesc'),
      stats: t('landing.featureSpeedStats'),
    },
    {
      icon: <Smartphone size={24} className="text-[var(--accent)]" />,
      title: t('landing.featureNativeTitle'),
      description: t('landing.featureNativeDesc'),
    },
    {
      icon: <Wifi size={24} className="text-[var(--accent)]" />,
      title: t('landing.featureOfflineTitle'),
      description: t('landing.featureOfflineDesc'),
      stats: t('landing.featureOfflineStats'),
    },
  ];

  const financeFeatures: FeatureItem[] = [
    {
      icon: <Wallet size={24} className="text-[var(--accent)]" />,
      title: t('landing.featureWalletTitle'),
      description: t('landing.featureWalletDesc'),
      stats: t('landing.featureWalletStats'),
    },
    {
      icon: <Tags size={24} className="text-[var(--accent)]" />,
      title: t('landing.featureBudgetTitle'),
      description: t('landing.featureBudgetDesc'),
      stats: t('landing.featureBudgetStats'),
    },
    {
      icon: <ArrowLeftRight size={24} className="text-[var(--accent)]" />,
      title: t('landing.featureTransferTitle'),
      description: t('landing.featureTransferDesc'),
    },
    {
      icon: <Handshake size={24} className="text-[var(--accent)]" />,
      title: t('landing.featureDebtTitle'),
      description: t('landing.featureDebtDesc'),
      stats: t('landing.featureDebtStats'),
    },
  ];

  const insightFeatures: FeatureItem[] = [
    {
      icon: <BarChart3 size={24} className="text-[var(--accent)]" />,
      title: t('landing.featureChartsTitle'),
      description: t('landing.featureChartsDesc'),
      stats: t('landing.featureChartsStats'),
    },
    {
      icon: <Search size={24} className="text-[var(--accent)]" />,
      title: t('landing.featureSearchTitle'),
      description: t('landing.featureSearchDesc'),
    },
    {
      icon: <Lock size={24} className="text-[var(--accent)]" />,
      title: t('landing.featureSecurityTitle'),
      description: t('landing.featureSecurityDesc'),
      stats: t('landing.featureSecurityStats'),
    },
    {
      icon: <Globe size={24} className="text-[var(--accent)]" />,
      title: t('landing.featureLanguageTitle'),
      description: t('landing.featureLanguageDesc'),
    },
  ];

  return (
    <section
      id="features-section"
      className="scroll-mt-24 pt-12 pb-20 sm:pt-20 sm:pb-28 px-4 sm:px-6 max-w-6xl mx-auto relative z-10"
    >
      {/* Section Header */}
      <div
        className="text-center mb-14 sm:mb-16"
      >
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[var(--text-primary)] mb-4 text-balance">
          {t('landing.featuresTitle')}
        </h2>
        <p className="text-base sm:text-lg text-[var(--text-muted)] max-w-2xl mx-auto text-pretty">
          {t('landing.featuresSubtitle')}
        </p>
      </div>

      <div className="space-y-14 sm:space-y-16">
        {/* Core Features - Privacy & Performance */}
        <div>
          <div className="flex items-center gap-3 mb-6 sm:mb-8">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
              <Shield size={16} className="text-[var(--accent)]" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
              {t('landing.featuresCoreTitle')}
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {coreFeatures.map((f, i) => (
              <FeatureCard
                key={i}
                index={i}
                icon={f.icon}
                title={f.title}
                description={f.description}
                stats={f.stats}
              />
            ))}
          </div>
        </div>

        {/* Finance Features */}
        <div>
          <div className="flex items-center gap-3 mb-6 sm:mb-8">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
              <Wallet size={16} className="text-[var(--accent)]" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
              {t('landing.featuresFinanceTitle')}
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {financeFeatures.map((f, i) => (
              <FeatureCard
                key={i}
                index={i}
                icon={f.icon}
                title={f.title}
                description={f.description}
                stats={f.stats}
              />
            ))}
          </div>
        </div>

        {/* Insight & Security Features */}
        <div>
          <div className="flex items-center gap-3 mb-6 sm:mb-8">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
              <BarChart3 size={16} className="text-[var(--accent)]" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
              {t('landing.featuresInsightTitle')}
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {insightFeatures.map((f, i) => (
              <FeatureCard
                key={i}
                index={i}
                icon={f.icon}
                title={f.title}
                description={f.description}
                stats={f.stats}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
