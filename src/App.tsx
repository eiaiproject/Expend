import { useState, lazy, Suspense, useEffect, useCallback, useRef } from 'react';
import { useKeyboardShortcutGuard } from './hooks/useKeyboardShortcut';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { ErrorBoundary } from './components/ErrorBoundary';
const HomeView = lazy(() => import('./views/HomeView'));
const WalletsView = lazy(() => import('./views/WalletsView'));
const WalletDetailView = lazy(() => import('./views/WalletDetailView'));
const DebtsView = lazy(() => import('./views/DebtsView'));
const StatsView = lazy(() => import('./views/StatsView'));
const SettingsView = lazy(() => import('./views/SettingsView'));
const CategoriesView = lazy(() => import('./views/CategoriesView'));
const PayeesView = lazy(() => import('./views/PayeesView'));
const SchedulesView = lazy(() => import('./views/SchedulesView'));
const MoreView = lazy(() => import('./views/MoreView'));

import { TransactionFormSheet } from './components/TransactionFormSheet';
import { ActionPickerSheet } from './components/ActionPickerSheet';
import { DebtFormSheet } from './components/debts/DebtFormSheet';
import { Toaster, toast } from './components/Toaster';
import { SupportPrompt } from './components/SupportPrompt';
import { PrivacyProvider } from './contexts/PrivacyContext';
import { ConfirmDialogProvider } from './components/ConfirmDialog';
import { LockScreen } from './components/LockScreen';
import { SecurityProvider, useSecurity } from './contexts/SecurityContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Skeleton } from './components/Skeleton';
import { useAppBootstrap } from './hooks/useAppBootstrap';
import { processDueSchedules } from './services/recurringService';
import './i18n/init';

import LandingView from './views/LandingView';
import { SidebarNav } from './components/SidebarNav';
import { Download, WifiOff, X } from 'reicon-react';
import OnboardingWizard from './components/OnboardingWizard';
import { UpdatePrompt } from './components/UpdatePrompt';
import { WhatsNewDialog } from './components/WhatsNewDialog';
import { useInstallPrompt, useOnlineStatus } from './utils/pwaUtils';
import type { TransactionType } from './hooks/useTransactionForm';

function AppContent() {
  const { t } = useTranslation();

  // Dev-only seeders: /?seed=demo (master.md §12 demo data) or
  // /?seed=sample (50 example transactions across 10 payees).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const seed = new URLSearchParams(window.location.search).get('seed');
    if (!seed) return;
    let cancelled = false;
    const run = async (): Promise<number> => {
      if (seed === 'sample') {
        const { seedSampleData } = await import('./utils/seedSample');
        // Guard BEFORE seeding: StrictMode double-invokes this effect in dev,
        // so the cancelled flag must stop the second run before it writes.
        if (cancelled) return 0;
        return seedSampleData();
      }
      const { seedDemoData } = await import('./utils/seedDemo');
      if (cancelled) return 0;
      return seedDemoData();
    };
    void run().then((count) => {
      if (cancelled) return;
      window.history.replaceState({}, '', window.location.pathname);
      if (count > 0) {
        window.location.reload(); // re-boot so onboarding flag + data are live
      }
    }).catch((err) => {
      console.error('seed failed:', err);
      window.history.replaceState({}, '', window.location.pathname);
    });
    return () => { cancelled = true; };
  }, []);

  const [isActionPickerOpen, setIsActionPickerOpen] = useState(false);
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [txInitialType, setTxInitialType] = useState<TransactionType>('expense');
  const [txInitialDescription, setTxInitialDescription] = useState<string | undefined>();
  const [isDebtFormOpen, setIsDebtFormOpen] = useState(false);
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
    handleBypassPwa,
    handleDismissBanner,
    handleOnboarded,
    handleOnboardingComplete,
  } = useAppBootstrap();

  const openAddTx = useCallback((type: TransactionType = 'expense', desc?: string) => {
    setTxInitialType(type);
    setTxInitialDescription(desc);
    setIsAddTxOpen(true);
  }, []);

  // Recurring schedules: process due 'create'-mode schedules once per app
  // session after the app is opened and unlocked (master.md 7.2/7.3).
  // Idempotent, but a one-shot guard avoids re-running on lock/unlock toggles.
  const schedulesProcessedRef = useRef(false);
  useEffect(() => {
    if (schedulesProcessedRef.current) return;
    if (!isSecurityLoaded || isLocked) return;
    if (!hasOnboarded || !onboardingCompleted) return;
    schedulesProcessedRef.current = true;
    processDueSchedules()
      .then((createdCount) => {
        // Transparent processing feedback (master.md 3.14).
        if (createdCount > 0) {
          toast.add(t('recurring.toastProcessed', { count: createdCount }));
        }
      })
      .catch(() => {
        // Allow a retry on a later unlock/state change if processing failed.
        schedulesProcessedRef.current = false;
      });
  }, [isSecurityLoaded, isLocked, hasOnboarded, onboardingCompleted, t]);

  // Keyboard shortcut: N to open Add Transaction
  const isShortcutIgnored = useKeyboardShortcutGuard();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isShortcutIgnored(e)) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        openAddTx('expense');
      }
    };
    document.addEventListener('keydown', handler as EventListener);
    return () => document.removeEventListener('keydown', handler as EventListener);
  }, [openAddTx, isShortcutIgnored]);

  if (!isSecurityLoaded) {
    return <SecureLoadingScreen />;
  }

  if (isCheckingData) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="animate-pulse text-[var(--text-secondary)] text-sm">{t('Loading...')}</div>
      </div>
    );
  }

  if (!isStandalone && !bypassPwa && !hasOnboarded) {
    return (
      <LandingView
        onEnter={handleOnboarded}
        onTryWeb={handleBypassPwa}
      />
    );
  }

  if (hasOnboarded && !onboardingCompleted) {
    return <OnboardingWizard onComplete={handleOnboardingComplete} />;
  }

  if (isLocked) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] font-sans flex flex-col">
        <LockScreen />
      </div>
    );
  }

  // Contextual install prompt — only when deferredPrompt is available and not dismissed
  const showContextualInstall = !isStandalone && deferredPrompt && !isBannerDismissed;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] font-sans flex flex-col">
      {/* Skip to content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[var(--accent)] focus:text-white focus:rounded-lg focus:font-bold focus:shadow-lg"
      >
        {t('Skip to content')}
      </a>

      {/* Contextual install banner — compact, dismissible */}
      {showContextualInstall && (
        <div className="md:hidden bg-[var(--card)] border border-[var(--border)] mx-4 mt-3 px-4 py-3 flex items-center justify-between gap-3 text-sm rounded-xl shadow-sm relative z-30 shrink-0">
          <div className="flex min-w-0 items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
              <Download size={16} className="text-[var(--accent)]" aria-hidden="true" />
            </div>
            <p className="text-xs font-semibold text-[var(--text-primary)] min-w-0">{t('home.installDesc')}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={showInstallPrompt}
              className="px-3 py-1.5 rounded-lg bg-[var(--accent-fill)] text-[var(--accent-ink)] text-xs font-semibold hover:opacity-90 transition-opacity min-h-[36px]"
            >
              {t('Install')}
            </button>
            <button
              type="button"
              onClick={handleDismissBanner}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--border)] transition-colors"
              aria-label={t('home.installDismiss')}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {!isOnline && (
        <div className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-b border-amber-500/20 px-4 py-2 text-xs font-medium flex items-center justify-center gap-2" role="status"> {/* NOSONAR: S6819 — no semantic HTML for status */}
          <WifiOff size={14} aria-hidden="true" />
          <span>{t('Offline Mode')}. {t('Data stored locally on this device.')}</span>
        </div>
      )}

      {/* Main layout */}
      <div className="flex-1 flex min-h-0">
        <div className="hidden lg:block">
          <SidebarNav onAddClick={() => setIsActionPickerOpen(true)} />
        </div>

        <main
          id="main-content"
          className="flex-1 min-w-0 w-full max-w-4xl mx-auto overflow-y-auto px-4 pt-5 md:px-6 md:py-8 lg:pb-8 pb-[calc(88px+env(safe-area-inset-bottom,0px))]"
          tabIndex={-1}
        >
          <RoutesWithSuspense />
        </main>
      </div>

      {/* Bottom Nav — central Add opens the action picker */}
      <BottomNav onAddClick={() => setIsActionPickerOpen(true)} />

      <ActionPickerSheet
        isOpen={isActionPickerOpen}
        onClose={() => setIsActionPickerOpen(false)}
        onAddExpense={() => {
          setIsActionPickerOpen(false);
          openAddTx('expense');
        }}
        onTransfer={() => {
          setIsActionPickerOpen(false);
          openAddTx('transfer');
        }}
        onDebt={() => {
          setIsActionPickerOpen(false);
          setIsDebtFormOpen(true);
        }}
      />

      {isAddTxOpen && (
        <TransactionFormSheet
          isOpen={isAddTxOpen}
          onClose={() => { setIsAddTxOpen(false); setTxInitialDescription(undefined); }}
          initialType={txInitialType}
          initialDescription={txInitialDescription}
        />
      )}

      <DebtFormSheet
        isOpen={isDebtFormOpen}
        onClose={() => setIsDebtFormOpen(false)}
      />

      {/* Contextual support prompt — only inside the unlocked app shell */}
      <SupportPrompt />

      {/* What's New popup — once after each version change */}
      <WhatsNewDialog />
    </div>
  );
}

function SecureLoadingScreen() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] flex items-center justify-center" aria-live="polite">
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
          <Route path="/wallets/:id" element={<WalletDetailView />} />
          <Route path="/debts" element={<DebtsView />} />
          <Route path="/stats" element={<StatsView />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="/categories" element={<CategoriesView />} />
          <Route path="/payees" element={<PayeesView />} />
          <Route path="/schedules" element={<SchedulesView />} />
          <Route path="/more" element={<MoreView />} />
          <Route path="*" element={<NotFoundView />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

function NotFoundView() {
  const { t } = useTranslation();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6 rounded-[16px] border border-[var(--border)] bg-[var(--card)] mt-4">
      <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)]">404</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">{t('Page not found')}</p>
      <Link
        to="/"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[var(--accent-fill)] px-5 text-sm font-bold text-[var(--accent-ink)] shadow-lg shadow-[var(--accent-fill)]/20 transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--accent-fill)]/30"
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
        <PrivacyProvider>
          <SecurityProvider>
            <AppContent />
            <UpdatePrompt />
            <Toaster />
            <ConfirmDialogProvider />
          </SecurityProvider>
        </PrivacyProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
