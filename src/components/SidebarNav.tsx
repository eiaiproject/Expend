import { NavLink, useLocation } from 'react-router-dom';
import { navigationItems } from '../config/navigation';
import { useTranslation } from '../i18n';

export function SidebarNav() {
  const { t } = useTranslation();
  const location = useLocation();
  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-[var(--border)] bg-[var(--card)] p-4 gap-1">
      <div className="px-4 py-2.5">
        <img src="/Expend-logo.svg" alt="Expend" className="h-8 w-auto" />
      </div>
      <nav aria-label={t('nav.main')} className="flex flex-col gap-1">
        {navigationItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === '/'}
            // C10: isActive custom - path matching tanpa query string
            // agar /chat?mode=upload tetap highlight "Chat"
            className={({ isActive }) => {
              const match = item.href === '/' 
                ? location.pathname === '/'
                : location.pathname.startsWith(item.href);
              const active = isActive || match;
              return `flex items-center gap-3 px-4 py-2.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors ${
                active
                  ? 'bg-[var(--accent-fill)] text-[var(--accent-ink)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg)]'
              }`;
            }}
          >
            <item.icon size={18} aria-hidden />
            {t(item.labelKey)}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
