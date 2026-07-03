import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Wallet, Handshake, PieChart, Settings, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../utils/cn';

export function BottomNav({ onAddClick }: { onAddClick: () => void }) {
  const { t } = useTranslation();

  return (
    <nav className="fixed bottom-0 left-0 w-full h-[64px] bg-[var(--card)] border-t border-[var(--border)] flex items-center z-40 md:hidden overscroll-contain"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <NavItem to="/" end icon={<Home size={24} />} label={t('Home')} />
      <NavItem to="/wallets" icon={<Wallet size={24} />} label={t('Wallets')} />
      <NavItem to="/debts" icon={<Handshake size={24} />} label={t('Debts')} />
      <NavItem to="/stats" icon={<PieChart size={24} />} label={t('Stats')} />
      <NavItem to="/settings" icon={<Settings size={24} />} label={t('More')} />

      {/* FAB - according to PRD: 56x56, Accent color, right 16px, above bottom nav 16px */}
      <button
        type="button"
        onClick={onAddClick}
        className="fixed right-[16px] w-[56px] h-[56px] rounded-[16px] bg-[var(--accent-fill)] text-[var(--accent-ink)] flex items-center justify-center shadow-lg shadow-[var(--accent-fill)]/30 active:scale-95 hover:scale-105 transition-transform z-50 md:hidden touch-manipulation"
        style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 16px)' }}
        aria-label={t('Add Transaction')}
      >
        <Plus size={32} aria-hidden="true" />
      </button>
    </nav>
  );
}

function NavItem({ to, end: isEnd, icon, label }: { to: string; end?: boolean; icon: ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      end={isEnd}
      className={({ isActive }) =>
        cn(
          "flex flex-col items-center justify-center flex-1 h-full gap-1",
          isActive ? "text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        )
      }
    >
      <span aria-hidden="true">{icon}</span>
      <span className="text-[10px] font-medium">{label}</span>
    </NavLink>
  );
}
