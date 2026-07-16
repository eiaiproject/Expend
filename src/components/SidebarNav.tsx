import { type ReactNode } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Home, Wallet, PieChart, Settings, Plus, Tag, Handshake, ShoppingBag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../utils/cn';

export function SidebarNav({ onAddClick }: { onAddClick: () => void }) {
  const { t } = useTranslation();

  return (
    <aside className="w-[260px] h-dvh bg-[var(--card)] border-r border-[var(--border)] flex flex-col justify-between p-6 shrink-0 sticky top-0 overflow-y-auto">
      <div className="space-y-8">
        {/* Brand — link, not heading */}
        <Link
          to="/"
          className="flex items-center gap-2 px-2 text-2xl tracking-tight text-[var(--accent)] no-underline"
          style={{ fontFamily: 'var(--font-display)' }}
          aria-label="Expend, open Overview"
        >
          Expend
        </Link>

        {/* Navigation Items */}
        <nav aria-label={t('home.primaryNav')}>
          <ul className="flex flex-col gap-2 list-none p-0 m-0">
            <SidebarItem to="/" end icon={<Home size={20} />} label={t('Home')} />
            <SidebarItem to="/wallets" icon={<Wallet size={20} />} label={t('Wallets')} />
            <SidebarItem to="/debts" icon={<Handshake size={20} />} label={t('Debts & Receivables')} />
            <SidebarItem to="/payees" icon={<ShoppingBag size={20} />} label={t('Recipients & Merchants')} />
            <SidebarItem to="/categories" icon={<Tag size={20} />} label={t('Categories')} />
            <SidebarItem to="/stats" icon={<PieChart size={20} />} label={t('Stats')} />
            <SidebarItem to="/settings" icon={<Settings size={20} />} label={t('Settings')} />
          </ul>
        </nav>
      </div>

      {/* Big Add Button at Sidebar Bottom */}
      <button
        type="button"
        onClick={onAddClick}
        className="w-full py-4 rounded-xl bg-[var(--accent-fill)] text-[var(--accent-ink)] flex items-center justify-start gap-2 font-bold hover:opacity-90 active:scale-95 transition-colors shadow-lg shadow-[var(--accent-fill)]/10 group touch-manipulation mt-4"
        aria-label={t('Add Transaction')}
      >
        <Plus size={20} aria-hidden="true" />
        <span>{t('Add Transaction')}</span>
        <kbd className="ml-auto hidden lg:inline-flex items-center justify-center w-5 h-5 rounded border border-white/20 text-[9px] font-mono font-bold text-white/70">
          N
        </kbd>
      </button>
    </aside>
  );
}

function SidebarItem({ to, end: isEnd, icon, label }: { to: string; end?: boolean; icon: ReactNode; label: string }) {
  return (
    <li>
      <NavLink
        to={to}
        end={isEnd}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-4 px-4 py-3 rounded-xl font-medium text-sm transition-colors min-h-[44px] relative",
            isActive
              ? "bg-[var(--accent)]/10 text-[var(--accent)] font-bold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r-full before:bg-[var(--accent)]"
              : "text-[var(--text-secondary)] hover:bg-[var(--border)]/30 hover:text-[var(--text-primary)]"
          )
        }
      >
        <span aria-hidden="true">{icon}</span>
        <span>{label}</span>
      </NavLink>
    </li>
  );
}
