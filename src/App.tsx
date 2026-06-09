import { useState, lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { ErrorBoundary } from './components/ErrorBoundary';
const HomeView = lazy(() => import('./views/HomeView'));
const WalletsView = lazy(() => import('./views/WalletsView'));
const StatsView = lazy(() => import('./views/StatsView'));
const SettingsView = lazy(() => import('./views/SettingsView'));
const CategoriesView = lazy(() => import('./views/CategoriesView'));

import { TransactionFormSheet } from './components/TransactionFormSheet';
import { Toaster } from './components/Toaster';
import { ConfirmDialogProvider } from './components/ConfirmDialog';
import { LockScreen } from './components/LockScreen';
import { SecurityProvider, useSecurity } from './contexts/SecurityContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { motion } from 'motion/react';
import { Skeleton } from './components/Skeleton';
import { useAppBootstrap } from './hooks/useAppBootstrap';
import './i18n/init';

import LandingView from './views/LandingView';
import { SidebarNav } from './components/SidebarNav';
import { Download, WifiOff, X } from 'lucide-react';
import OnboardingWizard from './components/OnboardingWizard';
import { MonthlyReportPopup } from './components/MonthlyReportPopup';
import { UpdatePrompt } from './components/UpdatePrompt';
import { useInstallPrompt, useOnlineStatus } from './utils/pwaUtils';

function AppContent() {
  const { t } = useTranslation();
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const { isLocked, isSecurityLoaded } = useSecurity();
  const isOnline = useOnlineStatus();
  const { deferredPrompt, showInstallPrompt } = useInstallPrompt();
  const {
    isCheckingData,
    bypassPwa,
    hasOnboarded,
    onboardingCompleted,
    isBannerDismissed,
    isStandalone,
    showMonthlyReport,
    handleBypassPwa,
    handleDismissBanner,
    handleOnboarded,
    handleOnboardingComplete,
    handleCloseMonthlyReport,
    setBypassPwa,
    setHasOnboarded,
  } = useAppBootstrap();

  // Keyboard shortcut: N to open Add Transaction
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditable = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isEditable) return;

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setIsAddTxOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Block all app content until the security state is known.
  if (!isSecurityLoaded) {
    return <SecureLoadingScreen />;
  }

  // Still checking IndexedDB — show loading to avoid flashing incorrect screen
  if (isCheckingData) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="animate-pulse text-[var(--text-secondary)] text-sm">{t('Loading...')}</div>
      </div>
    );
  }

  // Soft PWA gate: only block first-time visitors (no data, no onboarding flag)
  // Returning visitors go straight to the app.
  if (!isStandalone && !bypassPwa && !hasOnboarded) {
    return (
      <LandingView
        onEnter={handleOnboarded}
        onTryWeb={handleBypassPwa}
      />
    );
  }

  // Show onboarding wizard after first visit (before main app)
  if (hasOnboarded && !onboardingCompleted) {
    return <OnboardingWizard onComplete={handleOnboardingComplete} />;
  }

  // When locked, render only the LockScreen (routes/content not rendered)
  if (isLocked) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] font-sans flex flex-col"
      >
        <LockScreen />
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] font-sans flex flex-col"
    >
      {/* Render elegant installation banner on mobile web if not standalone and banner not dismissed */}
      {!isStandalone && !isBannerDismissed && (
        <div className="md:hidden bg-[var(--accent)] text-white px-4 py-3 flex items-center justify-between gap-3 text-xs font-semibold shadow z-50 relative shrink-0">
          <div className="flex min-w-0 items-center gap-2">
            <Download size={14} className="shrink-0" />
            <span>{t('Install Expend as a PWA for offline use & fullscreen!')}</span>
          </div>
          {deferredPrompt && (
            <button
              onClick={showInstallPrompt}
              className="shrink-0 rounded-lg bg-white/20 px-3 py-1.5 font-semibold hover:bg-white/30"
            >
              {t('Install')}
            </button>
          )}
          <button 
            onClick={handleDismissBanner} 
            className="shrink-0 p-1 rounded-full hover:bg-white/10 cursor-pointer"
            aria-label={t('Close')}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {!isOnline && (
        <div className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-b border-amber-500/20 px-4 py-2 text-xs font-medium flex items-center justify-center gap-2">
          <WifiOff size={14} />
          <span>{t('Offline Mode')}. {t('Data stored locally on this device.')}</span>
        </div>
      )}

      {/* Main layout container: side-by-side flex on desktop */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar Nav (Desktop only) */}
        <div className="hidden md:block">
          <SidebarNav onAddClick={() => setIsAddTxOpen(true)} />
        </div>

        {/* Main View Area */}
        <main className="flex-1 pb-[80px] md:pb-6 md:px-6 md:py-8 max-w-4xl mx-auto w-full overflow-y-auto">
          <RoutesWithSuspense />
        </main>
      </div>

      <BottomNav onAddClick={() => setIsAddTxOpen(true)} />

      {isAddTxOpen && (
        <TransactionFormSheet
          isOpen={isAddTxOpen}
          onClose={() => setIsAddTxOpen(false)}
        />
      )}

      <MonthlyReportPopup
        isOpen={showMonthlyReport}
        onClose={handleCloseMonthlyReport}
      />
    </motion.div>
  );
}

function SecureLoadingScreen() {
  const { t } = useTranslation();

  return (
    <div
      className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] flex items-center justify-center"
      aria-live="polite"
    >
      <div className="space-y-3 text-center">
        <div className="mx-auto h-8 w-8 rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] animate-spin" />
        <p className="text-sm text-[var(--text-secondary)]">{t('Loading...')}</p>
      </div>
    </div>
  );
}

function RoutesWithSuspense() {
  return (
    <ErrorBoundary>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
          <Skeleton />
        </div>
      }>
        <Routes>
          <Route path="/" element={<HomeView />} />
          <Route path="/wallets" element={<WalletsView />} />

          <Route path="/stats" element={<StatsView />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="/categories" element={<CategoriesView />} />
          <Route path="*" element={<NotFoundView />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

function NotFoundView() {
  const { t } = useTranslation();

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
      <h1 className="text-4xl font-black text-[var(--text-primary)]">404</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">{t('Page not found')}</p>
      <Link
        to="/"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-5 text-sm font-bold text-white shadow-lg shadow-[var(--accent)]/20"
      >
        {t('Back to Home')}
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <SecurityProvider>
          <AppContent />
          <UpdatePrompt />
          <Toaster />
          <ConfirmDialogProvider />
        </SecurityProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
