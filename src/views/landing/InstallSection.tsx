import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { PlusSquare, Share, ArrowRight, Download, ChevronRight } from 'lucide-react';
import { isIOSDevice } from '../../utils/pwaUtils';
import { APP_VERSION } from '../../utils/constants';

export function InstallSection({ onTryWeb, deferredPrompt, showInstallPrompt }: {
  onTryWeb: () => void;
  deferredPrompt: { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> } | null;
  showInstallPrompt: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const isIOS = isIOSDevice();

  return (
    <section id="install-section" className="py-16 sm:py-24 px-4 sm:px-6 relative z-10">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 sm:mb-14"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
            {t('landing.installTitle')}
          </h2>
          <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-xl mx-auto">
            {t('landing.installSubtitle')}
          </p>
        </motion.div>

        {/* Install Button or Manual Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 sm:mb-14"
        >
          {deferredPrompt ? (
            <div className="space-y-4">
              <button
                onClick={showInstallPrompt}
                className="px-10 sm:px-12 py-4 sm:py-5 bg-[var(--accent)] text-white rounded-full font-semibold text-base sm:text-lg hover:bg-[var(--accent)]/90 transition-all active:scale-95 cursor-pointer inline-flex items-center gap-3"
              >
                <Download size={20} />
                {t('landing.installButton')}
              </button>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                {t('landing.installQuickNote')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-lg mx-auto">
                {isIOS
                  ? t('landing.iosManualStep')
                  : t('landing.browserInstallOption')}
              </p>
              <button
                onClick={onTryWeb}
                className="text-sm sm:text-base font-semibold text-[var(--accent)] hover:underline cursor-pointer"
              >
                {t('landing.continueWeb')} <ArrowRight size={14} className="inline" />
              </button>
            </div>
          )}
        </motion.div>

        {/* Visual Steps */}
        <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
          {/* Step 1 */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-[var(--card)]/50 border border-white/5 rounded-xl sm:rounded-2xl p-6 sm:p-8 relative overflow-hidden group hover:border-[var(--accent)]/20 transition-all"
          >
            {/* Step Number */}
            <div className="absolute top-4 sm:top-6 right-4 sm:right-6 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[var(--accent)]/10 flex items-center justify-center">
              <span className="text-lg sm:text-xl font-bold text-[var(--accent)]">1</span>
            </div>

            {/* Icon */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-5 sm:mb-6 group-hover:scale-110 transition-transform">
              {isIOS ? (
                <Share size={28} className="text-[#007AFF]" />
              ) : (
                <ChevronRight size={28} className="text-white/70" />
              )}
            </div>

            {/* Content */}
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">
              {isIOS ? t('landing.step1Ios') : t('landing.step1Browser')}
            </h3>
            <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
              {isIOS ? t('landing.step1IosDesc') : t('landing.step1BrowserDesc')}
            </p>

            {/* Visual Indicator */}
            <div className="mt-5 sm:mt-6 flex items-center gap-3">
              <div className={`p-2.5 sm:p-3 rounded-xl ${isIOS ? 'bg-[#007AFF]/10' : 'bg-white/5'}`}>
                {isIOS ? (
                  <Share size={20} className="text-[#007AFF]" />
                ) : (
                  <span className="text-lg">⋮</span>
                )}
              </div>
              <div className="text-xs sm:text-sm text-[var(--text-secondary)]">
                {isIOS ? t('landing.step1IosVisual') : t('landing.step1BrowserVisual')}
              </div>
            </div>
          </motion.div>

          {/* Step 2 */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-[var(--card)]/50 border border-white/5 rounded-xl sm:rounded-2xl p-6 sm:p-8 relative overflow-hidden group hover:border-[var(--accent)]/20 transition-all"
          >
            {/* Step Number */}
            <div className="absolute top-4 sm:top-6 right-4 sm:right-6 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[var(--accent)]/10 flex items-center justify-center">
              <span className="text-lg sm:text-xl font-bold text-[var(--accent)]">2</span>
            </div>

            {/* Icon */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-5 sm:mb-6 group-hover:scale-110 transition-transform">
              <PlusSquare size={28} className="text-white/70" />
            </div>

            {/* Content */}
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">
              {t('landing.step2Title')}
            </h3>
            <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
              {t('landing.step2Desc')}
            </p>

            {/* Visual Indicator */}
            <div className="mt-5 sm:mt-6 flex items-center gap-3">
              <div className="p-2.5 sm:p-3 rounded-xl bg-white/5">
                <PlusSquare size={20} className="text-white/70" />
              </div>
              <div className="text-xs sm:text-sm text-[var(--text-secondary)]">
                {t('landing.step2Visual')}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-8 sm:mt-10 text-center"
        >
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            {t('landing.installNote')}
          </p>
        </motion.div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  const { t } = useTranslation();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="py-12 sm:py-16 px-4 sm:px-6 relative z-10 border-t border-white/5">
      <div className="max-w-4xl mx-auto">
        {/* Logo & Tagline */}
        <div
          onClick={scrollToTop}
          className="text-center cursor-pointer mb-8 sm:mb-10 group"
        >
          <h2 className="text-2xl sm:text-3xl tracking-tight text-white group-hover:text-[var(--accent)] transition-colors mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            Expend
          </h2>
          <p className="text-sm sm:text-base text-[var(--text-secondary)] font-light">
            {t('landing.footerTagline')}
          </p>
        </div>

        {/* Quick Links */}
        <div className="flex justify-center flex-wrap gap-6 sm:gap-8 mb-8 sm:mb-10">
          <a href="#features-section" className="text-xs sm:text-sm text-[var(--text-secondary)] hover:text-white transition-colors">
            {t('landing.footerFeatures')}
          </a>
          <a href="#install-section" className="text-xs sm:text-sm text-[var(--text-secondary)] hover:text-white transition-colors">
            {t('landing.footerInstall')}
          </a>
          <a
            href="https://github.com/eiaiproject/Expend.git"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs sm:text-sm text-[var(--text-secondary)] hover:text-white transition-colors"
          >
            {t('landing.footerGitHub')}
          </a>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-8 sm:mb-10" />

        {/* Bottom */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-xs text-[var(--text-secondary)]/60">
          <span>{APP_VERSION}</span>
          <span className="hidden sm:inline">|</span>
          <span>{t('landing.footerCopyright')}</span>
          <span className="hidden sm:inline">|</span>
          <a
            href="https://github.com/eiaiproject/Expend.git"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white/80 transition-colors"
          >
            {t('landing.openSource')}
          </a>
        </div>
      </div>
    </footer>
  );
}
