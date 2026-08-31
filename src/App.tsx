import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { SidebarNav } from './components/SidebarNav';

const HomeView = lazy(() => import('./views/HomeView'));
const ChatView = lazy(() => import('./views/ChatView'));
const SettingsView = lazy(() => import('./views/SettingsView'));

function Shell() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] flex">
      <SidebarNav />
      <main className="flex-1 min-w-0 max-w-3xl mx-auto px-4 pt-5 pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-8">
        <Suspense fallback={<div className="py-10 text-sm text-[var(--text-secondary)]">Loading…</div>}>
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
