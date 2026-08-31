import { NavLink } from 'react-router-dom';
import { Home, ChatRoundDots, Setting } from 'reicon-react';

const cls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium ${isActive ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg)]'}`;

export function SidebarNav() {
  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-[var(--border)] bg-[var(--card)] p-4 gap-1">
      <div className="font-bold text-lg px-2 py-2">Expend</div>
      <NavLink to="/" end className={cls}><Home size={18} /> Home</NavLink>
      <NavLink to="/chat" className={cls}><ChatRoundDots size={18} /> Chat</NavLink>
      <NavLink to="/settings" className={cls}><Setting size={18} /> Pengaturan</NavLink>
    </aside>
  );
}
