import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { useVisualViewport } from './utils/keyboard';
import { SidebarNav } from './components/SidebarNav';
import { SkeletonCard } from './components/SkeletonCard';
import { OnboardingCoach } from './components/OnboardingCoach';
import { isOnboarded, markOnboarded } from './utils/onboarding';
import { applyA11yPrefs } from './utils/a11yPrefs';
import { applyTheme } from './utils/theme';
import { I18nProvider, useTranslation } from './i18n';

const HomeView = lazy(() => import('./views/HomeView'));
const ChatView = lazy(() => import('./views/ChatView'));
const SettingsView = lazy(() => import('./views/SettingsView'));

function Shell() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { vvHeight, vvTop, keyboardOpen } = useVisualViewport();
  const isChat = location.pathname === '/chat';
  // TASK 1: coach saat first-run — baca flag saat init (bukan setState di effect).
  const [showCoach, setShowCoach] = useState<boolean>(() => !isOnboarded());

  useEffect(() => {
    applyTheme();
    applyA11yPrefs();
  }, []);

  // TASK 1: replay dari Settings ("Lihat tutorial lagi") via event lokal.
  useEffect(() => {
    const onReplay = () => setShowCoach(true);
    window.addEventListener('expend:replay-onboarding', onReplay);
    return () => window.removeEventListener('expend:replay-onboarding', onReplay);
  }, []);

  const closeCoach = () => {
    markOnboarded();
    setShowCoach(false);
  };

  // Saat keyboard buka, pakai visualViewport.height sebagai batas tinggi
  // agar list tidak meluap ke belakang keyboard.
  const containerStyle =
    vvHeight > 0
      ? {
          height: `${vvHeight}px`,
          transform: vvTop > 0 ? `translateY(${vvTop}px)` : undefined,
        }
      : undefined;

  return (
    <div className="bg-[var(--bg)] text-[var(--text-primary)] flex overflow-hidden" style={containerStyle ?? { height: '100dvh' }}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-[var(--radius-md)] focus:bg-[var(--accent-fill)] focus:text-[var(--accent-ink)] focus:text-sm focus:font-bold focus:shadow-lg"
      >
        {t('common.skipToContent')}
      </a>
      <SidebarNav />
      <main id="main-content" className="flex-1 min-w-0 min-h-0 flex flex-col max-w-3xl mx-auto w-full pt-[env(safe-area-inset-top)] md:pt-6 overflow-hidden">
        <Suspense fallback={<SkeletonCard lines={3} />}>
          <Routes>
            <Route path="/" element={<HomeView />} />
            <Route path="/chat" element={<ChatView />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <BottomNav hidden={isChat && keyboardOpen} />
      <OnboardingCoach
        open={showCoach}
        onClose={closeCoach}
        onTryExample={(ex) => {
          markOnboarded();
          setShowCoach(false);
          navigate(`/chat?input=${encodeURIComponent(ex)}`);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <I18nProvider>
        <Shell />
      </I18nProvider>
    </BrowserRouter>
  );
}
