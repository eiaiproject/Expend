import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { isEditableElement } from './utils/keyboard';
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
  const [vvHeight, setVvHeight] = useState(0);
  const [vvTop, setVvTop] = useState(0);
  const isChat = location.pathname === '/chat';

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    // B1: Turunkan threshold dari 150px ke 60px agar iPadOS split keyboard
    // (~80px) dan Android floating keyboard (~100-120px) juga terdeteksi.
    const threshold = 60;
    const initialHeight = vv.height;
    const isEditing = () => isEditableElement(document.activeElement);
    const recompute = () => {
      const h = vv.height;
      // Pin container ke visual viewport: iOS Safari mem-pan offsetTop saat
      // keyboard terbuka; tanpa ini dasar container menggantung di atas keyboard.
      setVvTop(vv.offsetTop);
      // Tanpa fokus editable, keyboard pasti turun: paksa pulih agar
      // container tidak nyangkut kecil bila event vv resize tidak sampai (iOS).
      if (!isEditing()) {
        setVvHeight(h);
        setKeyboardOpen(false);
        return;
      }
      setVvHeight(h);
      setKeyboardOpen(Math.max(initialHeight, h) - h > threshold);
    };
    let blurTimer = 0;
    const onBlur = () => {
      window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(recompute, 300);
    };
    recompute();
    vv.addEventListener('resize', recompute);
    window.addEventListener('resize', recompute);
    document.addEventListener('focusin', recompute);
    document.addEventListener('focusout', onBlur);
    return () => {
      window.clearTimeout(blurTimer);
      vv.removeEventListener('resize', recompute);
      window.removeEventListener('resize', recompute);
      document.removeEventListener('focusin', recompute);
      document.removeEventListener('focusout', onBlur);
    };
  }, []);

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
