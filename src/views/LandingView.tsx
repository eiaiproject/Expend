import { useState, useEffect, useCallback } from 'react';
import { useInstallPrompt } from '../utils/pwaUtils';
import { useTranslation } from 'react-i18next';
import { ArrowUp, Globe } from 'reicon-react';
import { HeroSection } from './landing/HeroSection';
import { HowItWorksSection } from './landing/HowItWorksSection';
import { FeaturesSection } from './landing/FeaturesSection';
import { PreviewSection } from './landing/PreviewSection';
import { PrivacySection } from './landing/PrivacySection';
import { InstallSection } from './landing/InstallSection';
import { TechStackSection } from './landing/TechStackSection';
import { FAQSection } from './landing/FAQSection';
import { FinalCTASection } from './landing/FinalCTASection';
import { LandingFooter } from './landing/InstallSection';
import { StickyCta } from '../components/StickyCta';
import { RevealOnScroll } from '../components/RevealOnScroll';
import { useNearViewport } from '../hooks/useNearViewport';

/* ------------------------------------------------------------------ */
/*  Lazy section wrapper: defers rendering until ~400px of the viewport */
/* ------------------------------------------------------------------ */
function LazySection({ children }: { readonly children: React.ReactNode }) {
  const [ref, isNear] = useNearViewport('400px');
  return (
    <div ref={ref}>
      {isNear ? children : <div className="min-h-[200px]" />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Language Switcher                                                 */
/* ------------------------------------------------------------------ */
function LangSwitcher() {
  const { i18n, t } = useTranslation();
  const isEn = i18n.language?.startsWith('en');

  const toggle = useCallback(() => {
    const next = isEn ? 'id' : 'en';
    i18n.changeLanguage(next);
  }, [i18n, isEn]);

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
      aria-label={isEn ? 'Switch to Indonesian' : 'Switch to English'}
    >
      <Globe size={14} aria-hidden="true" />
      {isEn ? 'ID' : 'EN'}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Sticky Nav                                                        */
/* ------------------------------------------------------------------ */
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

  return (
    <>
      <nav
        aria-label={t('Main')}
        className={`fixed top-0 left-0 right-0 z-50 transition-[padding,background-color,border-color] duration-300 ${
          scrolled
            ? 'bg-[var(--bg)]/90 backdrop-blur-md border-b border-[var(--border-subtle)] py-3'
            : 'py-4'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="text-lg font-bold tracking-tight text-[var(--text-primary)] cursor-pointer bg-transparent border-none p-0"
            style={{ fontFamily: 'var(--font-display)' }}
            aria-label="Expend — home"
          >
            Expend
          </button>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-5">
            <a href="#how-it-works" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              {t('landing.navHowItWorks', 'How It Works')}
            </a>
            <a href="#features-section" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              {t('landing.footerFeatures')}
            </a>
            <a href="#privacy-section" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              {t('landing.navPrivacy', 'Privacy')}
            </a>
            <a href="#faq-section" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              FAQ
            </a>
            <a
              href="https://github.com/eiaiproject/Expend.git"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              GitHub
            </a>
            <LangSwitcher />
          </div>

          {/* Mobile: lang + CTA */}
          <div className="flex sm:hidden items-center gap-2">
            <LangSwitcher />
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="px-4 py-2 bg-[var(--accent)] text-[var(--bg)] rounded-full text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer"
            >
              {t('landing.navCta', 'Start Tracking')}
            </button>
          </div>
        </div>
      </nav>

      {/* Back to top */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label={t('Back to top')}
        className={`fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 w-11 h-11 rounded-full bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--text-muted)] flex items-center justify-center shadow-lg transition-[opacity,transform] duration-300 cursor-pointer ${
          showTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <ArrowUp size={18} />
      </button>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Landing View                                                      */
/* ------------------------------------------------------------------ */
export default function LandingView({
  onTryWeb,
  onEnter,
}: {
  readonly onTryWeb: () => void;
  readonly onEnter?: () => void;
}) {
  const { t } = useTranslation();
  const { deferredPrompt, showInstallPrompt } = useInstallPrompt();
  const handleEnter = onEnter ?? onTryWeb;

  return (
    <div className="bg-[var(--bg)] text-[var(--text-primary)] font-sans overflow-x-hidden">
      {/* Skip to content */}
      <a
        href="#how-it-works"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[var(--accent)] focus:text-white focus:rounded-lg focus:text-sm"
      >
        {t('Skip to content')}
      </a>

      <StickyNav />

      {/* 1. Hero — always rendered (LCP element) */}
      <HeroSection onEnter={handleEnter} />

      {/* 2. How It Works — lazy + reveal */}
      <LazySection>
        <RevealOnScroll>
          <HowItWorksSection />
        </RevealOnScroll>
      </LazySection>

      {/* 3. Benefits + Features — lazy + reveal */}
      <LazySection>
        <RevealOnScroll delay={50}>
          <FeaturesSection />
        </RevealOnScroll>
      </LazySection>

      {/* 4. App Preview — lazy + reveal */}
      <LazySection>
        <RevealOnScroll delay={100}>
          <PreviewSection />
        </RevealOnScroll>
      </LazySection>

      {/* 5. Privacy & Security — lazy + reveal */}
      <LazySection>
        <RevealOnScroll delay={50}>
          <PrivacySection />
        </RevealOnScroll>
      </LazySection>

      {/* 6. Install PWA — lazy + reveal */}
      <LazySection>
        <RevealOnScroll>
          <InstallSection
            onEnter={handleEnter}
            deferredPrompt={deferredPrompt}
            showInstallPrompt={showInstallPrompt}
          />
        </RevealOnScroll>
      </LazySection>

      {/* 7. FAQ — lazy + reveal */}
      <LazySection>
        <RevealOnScroll delay={50}>
          <FAQSection />
        </RevealOnScroll>
      </LazySection>

      {/* 8. Tech Stack — lazy + reveal */}
      <LazySection>
        <RevealOnScroll>
          <TechStackSection />
        </RevealOnScroll>
      </LazySection>

      {/* 9. Final CTA — lazy + reveal */}
      <LazySection>
        <RevealOnScroll delay={50}>
          <FinalCTASection onEnter={handleEnter} />
        </RevealOnScroll>
      </LazySection>

      {/* Footer */}
      <LandingFooter />

      {/* Sticky CTA (mobile) */}
      <StickyCta onEnter={handleEnter} />
    </div>
  );
}
