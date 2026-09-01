import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { SidebarNav } from './components/SidebarNav';

const HomeView = lazy(() => import('./views/HomeView'));
const ChatView = lazy(() => import('./views/ChatView'));
const SettingsView = lazy(() => import('./views/SettingsView'));

function Skeleton() {
  return (
    <div className="space-y-3 py-6 animate-pulse">
      <div className="h-24 rounded-xl bg-[var(--border)]" />
      <div className="h-16 rounded-xl bg-[var(--border)]" />
      <div className="h-16 rounded-xl bg-[var(--border)]" />
    </div>
  );
}

function Shell() {
  return (
    <div className="h-[100dvh] bg-[var(--bg)] text-[var(--text-primary)] flex overflow-hidden">
      <SidebarNav />
      <main className="flex-1 min-w-0 flex flex-col min-h-0 max-w-3xl mx-auto w-full px-4 pt-5 md:pt-8 pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-8 overflow-y-auto">
        <Suspense fallback={<Skeleton />}>
          <Routes>
            <Route path="/" element={<HomeView />} />
            <Route path="/chat" element={<ChatView />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
