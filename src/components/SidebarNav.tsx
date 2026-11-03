import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { navigationItems, isActivePath } from '../config/navigation';
import { Wordmark } from './Wordmark';

export function SidebarNav() {
  const { t } = useTranslation();
  const location = useLocation();
  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-[var(--border)] bg-[var(--card)] p-4 gap-1">
      <div className="px-4 py-2.5">
        {/* Wordmark inline mengikuti token tema; logo raster lama tetap hijau
            di tema gelap dan tidak menyediakan nama aplikasi di sidebar. */}
        <Wordmark className="h-6 w-auto" />
      </div>
      <nav aria-label={t('nav.main')} className="flex flex-col gap-1">
        {navigationItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === '/'}
            // isActive custom - path matching tanpa query string
            // agar /chat?mode=upload tetap highlight "Chat"
            className={({ isActive }) => {
              const active = isActive || isActivePath(item.href, location.pathname);
              return `flex items-center gap-3 min-h-12 px-4 py-2.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors ${
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
