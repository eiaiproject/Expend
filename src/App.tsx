import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { SidebarNav } from './components/SidebarNav';
import { I18nProvider, useTranslation } from './i18n';

const HomeView = lazy(() => import('./views/HomeView'));
const ChatView = lazy(() => import('./views/ChatView'));
const SettingsView = lazy(() => import('./views/SettingsView'));

function Skeleton() {
  const { t } = useTranslation();
  return (
    <output className="space-y-3 py-6 animate-pulse block" aria-label={t('common.loadingData')}>
      <span className="sr-only">{t('common.loading')}</span>
      <div className="h-24 rounded-[var(--radius-lg)] bg-[var(--border)]" />
      <div className="h-16 rounded-[var(--radius-lg)] bg-[var(--border)]" />
      <div className="h-16 rounded-[var(--radius-lg)] bg-[var(--border)]" />
    </output>
  );
}

function Shell() {
  const { t } = useTranslation();
  const location = useLocation();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const isChat = location.pathname === '/chat';

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const threshold = 150;
    const initialHeight = vv.height;
    const onResize = () => {
      const heightDiff = initialHeight - vv.height;
      setKeyboardOpen(heightDiff > threshold);
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="h-[100dvh] bg-[var(--bg)] text-[var(--text-primary)] flex overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-[var(--radius-md)] focus:bg-[var(--accent-fill)] focus:text-[var(--accent-ink)] focus:text-sm focus:font-bold focus:shadow-lg"
      >
        {t('common.skipToContent')}
      </a>
      <SidebarNav />
      <main id="main-content" className="flex-1 min-w-0 min-h-0 flex flex-col max-w-3xl mx-auto w-full pt-[env(safe-area-inset-top)] md:pt-6 overflow-hidden">
        <Suspense fallback={<Skeleton />}>
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
