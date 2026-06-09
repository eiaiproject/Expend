import { motion } from 'motion/react';
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
  FileText,
  ArrowLeftRight,
  Tags,
  Lock,
  Globe,
  SmartphoneIcon,
} from 'lucide-react';

interface FeatureItem {
  icon: ReactNode;
  title: string;
  description: string;
  stats?: string;
}

function FeatureCard({ icon, title, description, stats, index }: FeatureItem & { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay: (index % 4) * 0.1 }}
      className="relative group"
    >
      <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-[#1E293B]/50 border border-white/5 hover:border-[var(--accent)]/30 transition-all duration-300 h-full">
        {/* Icon */}
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center mb-4 sm:mb-5 group-hover:scale-110 group-hover:bg-[var(--accent)]/20 transition-all duration-300">
          {icon}
        </div>

        {/* Content */}
        <h3 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">
          {title}
        </h3>
        <p className="text-sm sm:text-base text-[#94A3B8] leading-relaxed">
          {description}
        </p>

        {/* Stats Badge */}
        {stats && (
          <div className="mt-4 sm:mt-5 inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--accent)]/10 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
            <span className="text-xs sm:text-sm font-medium text-[var(--accent)]">{stats}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function SectionDivider() {
  return (
    <div className="flex items-center gap-4 my-12 sm:my-16">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="w-2 h-2 rounded-full bg-[var(--accent)]/30" />
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
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
      icon: <FileText size={24} className="text-[var(--accent)]" />,
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
    <section id="features-section" className="py-16 sm:py-24 px-4 sm:px-6 max-w-6xl mx-auto relative z-10">
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-12 sm:mb-16"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-full mb-6"
        >
          <span className="text-xs sm:text-sm font-semibold text-[var(--accent)] uppercase tracking-wider">
            {t('landing.featuresBadge')}
          </span>
        </motion.div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white mb-4">
          {t('landing.featuresTitle')}
        </h2>
        <p className="text-base sm:text-lg text-[#94A3B8] max-w-2xl mx-auto">
          {t('landing.featuresSubtitle')}
        </p>
      </motion.div>

      {/* Core Features - Privacy & Performance */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mb-4"
      >
        <div className="flex items-center gap-3 mb-6 sm:mb-8">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
            <Shield size={16} className="text-[var(--accent)]" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-white">
            {t('landing.featuresCoreTitle')}
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {coreFeatures.map((f, i) => (
            <FeatureCard key={i} index={i} icon={f.icon} title={f.title} description={f.description} stats={f.stats} />
          ))}
        </div>
      </motion.div>

      <SectionDivider />

      {/* Finance Features */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mb-4"
      >
        <div className="flex items-center gap-3 mb-6 sm:mb-8">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
            <Wallet size={16} className="text-[var(--accent)]" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-white">
            {t('landing.featuresFinanceTitle')}
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {financeFeatures.map((f, i) => (
            <FeatureCard key={i} index={i} icon={f.icon} title={f.title} description={f.description} stats={f.stats} />
          ))}
        </div>
      </motion.div>

      <SectionDivider />

      {/* Insight & Security Features */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mb-4"
      >
        <div className="flex items-center gap-3 mb-6 sm:mb-8">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
            <BarChart3 size={16} className="text-[var(--accent)]" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-white">
            {t('landing.featuresInsightTitle')}
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {insightFeatures.map((f, i) => (
            <FeatureCard key={i} index={i} icon={f.icon} title={f.title} description={f.description} stats={f.stats} />
          ))}
        </div>
      </motion.div>
    </section>
  );
}
