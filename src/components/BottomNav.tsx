import { NavLink } from 'react-router-dom';
import { Home, ChatRoundDots, Setting } from 'reicon-react';

const link = 'flex flex-col items-center gap-1 py-2 px-4 text-[11px] font-medium';
const active = 'text-[var(--accent)]';
const idle = 'text-[var(--text-secondary)]';

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-[var(--card)] border-t border-[var(--border)] flex justify-around md:hidden pb-[env(safe-area-inset-bottom)]">
      <NavLink to="/" end className={({ isActive }) => `${link} ${isActive ? active : idle}`}>
        <Home size={22} />
        Home
      </NavLink>
      <NavLink to="/chat" className={({ isActive }) => `${link} ${isActive ? active : idle}`}>
        <ChatRoundDots size={22} />
        Chat
      </NavLink>
      <NavLink to="/settings" className={({ isActive }) => `${link} ${isActive ? active : idle}`}>
        <Setting size={22} />
        Setting
      </NavLink>
    </nav>
  );
}
