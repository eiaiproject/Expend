import { useState, useEffect, useCallback } from 'react';
import { useInstallPrompt } from '../utils/pwaUtils';
import { useTranslation } from 'react-i18next';
import { ArrowUp } from 'lucide-react';
import { HeroSection } from './landing/HeroSection';
import { FeaturesSection } from './landing/FeaturesSection';
import { PreviewSection } from './landing/PreviewSection';
import { SocialProofSection } from './landing/SocialProofSection';
import { TechStackSection } from './landing/TechStackSection';
import { InstallSection, LandingFooter } from './landing/InstallSection';
import { FAQSection } from './landing/FAQSection';

function StickyNav() {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 100);
      setShowTop(window.scrollY > 600);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <>
      <nav
        role="navigation"
        aria-label="Main"
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[var(--bg)]/90 backdrop-blur-md border-b border-[var(--border-subtle)] py-3'
            : 'py-5'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
            Expend
          </span>
          <div className="hidden sm:flex items-center gap-6">
            <button onClick={() => scrollTo('features-section')} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
              {t('landing.footerFeatures')}
            </button>
            <button onClick={() => scrollTo('preview-section')} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
              {t('landing.previewTitle')}
            </button>
            <button onClick={() => scrollTo('install-section')} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
              {t('landing.footerInstall')}
            </button>
            <button onClick={() => scrollTo('faq-section')} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
              FAQ
            </button>
          </div>
        </div>
      </nav>
      {/* Back to top */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Back to top"
        className={`fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shadow-lg transition-all duration-300 cursor-pointer ${
          showTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <ArrowUp size={18} />
      </button>
    </>
  );
}

export default function LandingView({ onTryWeb, onEnter }: { onTryWeb: () => void; onEnter?: () => void }) {
  const { deferredPrompt, showInstallPrompt } = useInstallPrompt();

  const scrollToInstall = () => {
    document.getElementById('install-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-[var(--bg)] text-[var(--text-primary)] font-sans overflow-x-hidden">
      {/* Skip to content */}
      <a
        href="#features-section"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[var(--accent)] focus:text-white focus:rounded-lg focus:text-sm"
      >
        Skip to content
      </a>

      <StickyNav />

      {/* Hero Section */}
      <HeroSection
        onTryWeb={onTryWeb}
        onEnter={onEnter}
        onScrollToInstall={scrollToInstall}
      />

      {/* Features Section */}
      <FeaturesSection />

      {/* App Preview */}
      <PreviewSection />

      {/* Social Proof */}
      <SocialProofSection />

      {/* Tech Stack */}
      <TechStackSection />

      {/* Install Section */}
      <InstallSection
        onTryWeb={onTryWeb}
        deferredPrompt={deferredPrompt}
        showInstallPrompt={showInstallPrompt}
      />

      {/* FAQ Section */}
      <FAQSection />

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}
