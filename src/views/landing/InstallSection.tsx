import { useTranslation } from 'react-i18next';
import { Download, Check, Coffee } from 'reicon-react';
import { isIOSDevice } from '../../utils/pwaUtils';
import { useState, useEffect } from 'react';
import { APP_VERSION } from '../../utils/constants';
import { TRAKTEER_URL } from '../../services/supportService';

export function InstallSection({
  onEnter,
  deferredPrompt,
  showInstallPrompt,
}: {
  readonly onEnter: () => void;
  readonly deferredPrompt: {
    readonly prompt: () => Promise<void>;
    readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
  } | null;
  readonly showInstallPrompt: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const isIOS = isIOSDevice();
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
    }
  }, []);

  const getPlatformHint = () => {
    if (isIOS) return t('landing.installIOS');
    if (deferredPrompt) return t('landing.installAndroid');
    return t('landing.installDesktop');
  };
  const platformHint = getPlatformHint();

  const renderInstallBody = () => {
    if (installed) {
      return (
        <div className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-sm font-medium">
          <Check size={16} />
          {t('landing.installAlreadyInstalled')}
        </div>
      );
    }
    if (dismissed) {
      return (
        <button
          type="button"
          onClick={onEnter}
          className="px-8 py-3.5 bg-[var(--accent)] text-[var(--bg)] rounded-full font-semibold text-base hover:opacity-90 transition-opacity active:scale-95 cursor-pointer"
        >
          {t('landing.heroCtaPrimary')}
        </button>
      );
    }
    return (
      <div className="space-y-4">
        {deferredPrompt ? (
          <button
            type="button"
            onClick={showInstallPrompt}
            className="px-8 py-3.5 bg-[var(--accent)] text-[var(--bg)] rounded-full font-semibold text-base hover:opacity-90 transition-opacity active:scale-95 cursor-pointer inline-flex items-center gap-2.5"
          >
            <Download size={18} aria-hidden="true" />
            {t('landing.installButton')}
          </button>
        ) : (
          <button
            type="button"
            onClick={onEnter}
            className="px-8 py-3.5 bg-[var(--accent)] text-[var(--bg)] rounded-full font-semibold text-base hover:opacity-90 transition-opacity active:scale-95 cursor-pointer inline-flex items-center gap-2.5"
          >
            <Download size={18} aria-hidden="true" />
            {t('landing.installButton')}
          </button>
        )}

        <p className="text-xs text-[var(--text-muted)]">
          {t('landing.installQuickNote')}
        </p>

        {/* Platform hint */}
        <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
          {platformHint}
        </p>

        {/* Not now */}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
        >
          {t('landing.installNotNow')}
        </button>
      </div>
    );
  };

  return (
    <section id="install-section" className="scroll-mt-20 py-16 sm:py-24 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto text-center">
        {/* Header */}
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)] mb-3" style={{ textWrap: 'balance' }}>
          {t('landing.installTitle')}
        </h2>
        <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-md mx-auto mb-8" style={{ textWrap: 'pretty' }}>
          {t('landing.installSubtitle')}
        </p>

        {renderInstallBody()}
      </div>
    </section>
  );
}

export function LandingFooter() {
  const { t } = useTranslation();

  return (
    <footer className="py-8 sm:py-12 px-4 sm:px-6 border-t border-[var(--border-subtle)]">
      <div className="max-w-4xl mx-auto">
        {/* Logo & Tagline */}
        <div className="text-center mb-6 sm:mb-8">
          <h2
            className="text-xl sm:text-2xl tracking-tight text-[var(--text-primary)] mb-1"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Expend
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            {t('landing.footerTagline')}
          </p>
        </div>

        {/* Quick Links */}
        <div className="flex justify-center flex-wrap gap-4 sm:gap-6 mb-6 sm:mb-8">
          <a
            href="#features-section"
            className="text-xs sm:text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            {t('landing.footerFeatures')}
          </a>
          <a
            href="#install-section"
            className="text-xs sm:text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            {t('landing.footerInstall')}
          </a>
          <a
            href="https://github.com/eiaiproject/Expend.git"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs sm:text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            {t('landing.footerGitHub')}
          </a>
        </div>

        {/* Secondary support CTA — must not compete with the primary install CTA (9.3) */}
        <div className="flex items-center justify-center gap-1.5 mb-6">
          <a
            href={TRAKTEER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
            aria-label={t('landing.supportCta')}
          >
            <Coffee size={14} aria-hidden="true" />
            {t('landing.supportCta')}
            <span aria-hidden="true">↗</span>
          </a>
        </div>

        {/* Bottom */}
        <div className="text-center text-xs text-[var(--text-muted)]">
          <span>{APP_VERSION}</span>
          <span className="mx-2">·</span>
          <span>{t('landing.footerCopyright')}</span>
        </div>
      </div>
    </footer>
  );
}
