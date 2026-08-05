import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Wallet, Handshake, Plus, MoreH } from 'reicon-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../utils/cn';

/**
 * Mobile bottom navigation (master.md §3.1/§3.3).
 * Home · Wallets · [Add] · Debts · More — central Add is integrated into the
 * nav instead of a floating FAB so it never covers list content or toasts.
 * Short `nav.*` labels avoid Indonesian truncation at 11px.
 */
export function BottomNav({ onAddClick }: { readonly onAddClick: () => void }) {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t('home.primaryNav')}
      className="fixed bottom-0 left-0 w-full bg-[var(--card)] border-t border-[var(--border)] grid grid-cols-5 z-40 lg:hidden overscroll-contain"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', height: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
    >
      <NavItem to="/" end icon={<Home size={22} />} label={t('Home')} />
      <NavItem to="/wallets" icon={<Wallet size={22} />} label={t('Wallets')} />

      {/* Central Add — raised, reachable from both thumbs */}
      <div className="relative flex items-start justify-center h-full">
        <button
          type="button"
          onClick={onAddClick}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-[var(--accent-fill)] text-[var(--accent-ink)] flex items-center justify-center shadow-lg shadow-[var(--accent-fill)]/30 active:scale-95 transition-transform touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
          aria-label={t('Add Transaction')}
        >
          <Plus size={28} aria-hidden="true" />
        </button>
      </div>

      <NavItem to="/debts" icon={<Handshake size={22} />} label={t('nav.debts')} />
      <NavItem to="/more" icon={<MoreH size={22} />} label={t('nav.more')} />
    </nav>
  );
}

function NavItem({ to, end: isEnd, icon, label }: { readonly to: string; readonly end?: boolean; readonly icon: ReactNode; readonly label: string }) {
  return (
    <NavLink
      to={to}
      end={isEnd}
      className={({ isActive }) =>
        cn(
          "flex flex-col items-center justify-center gap-1 min-h-[44px] min-w-[44px] relative",
          isActive ? "text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              "rounded-full p-1 transition-colors",
              isActive && "bg-[var(--accent)]/10"
            )}
            aria-hidden="true"
          >
            {icon}
          </span>
          <span
            className={cn(
              "text-[11px] leading-none px-0.5 truncate max-w-full",
              isActive ? "font-bold" : "font-medium"
            )}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}
