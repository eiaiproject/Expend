import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { useVisualViewport } from './utils/keyboard';
import { SidebarNav } from './components/SidebarNav';
import { SkeletonCard } from './components/SkeletonCard';
import { I18nProvider, useTranslation } from './i18n';

const HomeView = lazy(() => import('./views/HomeView'));
const ChatView = lazy(() => import('./views/ChatView'));
const SettingsView = lazy(() => import('./views/SettingsView'));

function Shell() {
  const { t } = useTranslation();
  const location = useLocation();
  const { vvHeight, vvTop, keyboardOpen } = useVisualViewport();
  const isChat = location.pathname === '/chat';

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
