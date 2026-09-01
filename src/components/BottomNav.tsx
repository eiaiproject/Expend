import { NavLink } from 'react-router-dom';
import { Home, ChatRoundDots, Setting } from 'reicon-react';

export function BottomNav() {
  const base = 'flex flex-col items-center justify-center gap-1 min-w-11 min-h-11 px-3 py-2 text-[11px] font-medium rounded-full transition-colors';
  const active = 'bg-[var(--accent)] text-white';
  const idle = 'text-[var(--text-secondary)] hover:bg-[var(--bg)]';
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-[var(--card)] border-t border-[var(--border)] flex justify-around items-center md:hidden px-2 py-2 pb-[calc(8px+env(safe-area-inset-bottom))]">
      <NavLink to="/" end className={({ isActive }) => `${base} ${isActive ? active : idle}`}>
        <Home size={20} />
        <span>Home</span>
      </NavLink>
      <NavLink to="/chat" className={({ isActive }) => `${base} ${isActive ? active : idle}`}>
        <ChatRoundDots size={20} />
        <span>Chat</span>
      </NavLink>
      <NavLink to="/settings" className={({ isActive }) => `${base} ${isActive ? active : idle}`}>
        <Setting size={20} />
        <span>Setting</span>
      </NavLink>
    </nav>
  );
}
