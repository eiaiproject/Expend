import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Wallet, Handshake, ChartPie, Settings, Plus } from 'reicon-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../utils/cn';

export function BottomNav({ onAddClick }: { onAddClick: () => void }) {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t('home.primaryNav')}
      className="fixed bottom-0 left-0 w-full bg-[var(--card)] border-t border-[var(--border)] flex items-center z-40 lg:hidden overscroll-contain"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', height: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
    >
      <NavItem to="/" end icon={<Home size={22} />} label={t('Home')} />
      <NavItem to="/wallets" icon={<Wallet size={22} />} label={t('Wallets')} />
      <NavItem to="/debts" icon={<Handshake size={22} />} label={t('Debts')} />
      <NavItem to="/stats" icon={<ChartPie size={22} />} label={t('Stats')} />
      <NavItem to="/settings" icon={<Settings size={22} />} label={t('Settings')} />
    </nav>
  );
}

/* FAB exported separately so App.tsx can place it as sibling of BottomNav */
export function FabButton({ onAddClick }: { onAddClick: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="fixed right-[16px] z-50 pointer-events-none" style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 16px)' }}>
      <button
        type="button"
        onClick={onAddClick}
        className="w-[56px] h-[56px] rounded-[16px] bg-[var(--accent-fill)] text-[var(--accent-ink)] flex items-center justify-center shadow-lg shadow-[var(--accent-fill)]/30 active:scale-95 transition-transform pointer-events-auto lg:hidden touch-manipulation"
        aria-label={t('Add Transaction')}
      >
        <Plus size={28} aria-hidden="true" />
      </button>
    </div>
  );
}

function NavItem({ to, end: isEnd, icon, label }: { to: string; end?: boolean; icon: ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      end={isEnd}
      className={({ isActive }) =>
        cn(
          "flex flex-col items-center justify-center flex-1 h-full gap-1 min-h-[44px] min-w-[44px] relative",
          isActive ? "text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className={cn(
            "rounded-full p-1 transition-colors",
            isActive && "bg-[var(--accent)]/10"
          )} aria-hidden="true">
            {icon}
          </span>
          <span className={cn(
            "text-[9px] leading-none px-0.5 truncate max-w-full",
            isActive ? "font-bold" : "font-medium"
          )}>{label}</span>
        </>
      )}
    </NavLink>
  );
}
