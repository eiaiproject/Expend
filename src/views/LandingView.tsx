import { useInstallPrompt } from '../utils/pwaUtils';
import { HeroSection } from './landing/HeroSection';
import { FeaturesSection } from './landing/FeaturesSection';
import { PreviewSection } from './landing/PreviewSection';
import { SocialProofSection } from './landing/SocialProofSection';
import { TechStackSection } from './landing/TechStackSection';
import { InstallSection, LandingFooter } from './landing/InstallSection';
import { FAQSection } from './landing/FAQSection';

export default function LandingView({ onTryWeb, onEnter }: { onTryWeb: () => void; onEnter?: () => void }) {
  const { deferredPrompt, showInstallPrompt } = useInstallPrompt();

  const scrollToInstall = () => {
    document.getElementById('install-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-[var(--bg)] text-[var(--text-primary)] font-sans overflow-x-hidden">
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
