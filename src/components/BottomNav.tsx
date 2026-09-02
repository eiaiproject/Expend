import { NavLink } from 'react-router-dom';
import { navigationItems } from '../config/navigation';

export function BottomNav({ hidden = false }: { readonly hidden?: boolean }) {
  if (hidden) return null;

  return (
    <nav aria-label="Navigasi utama" className="fixed bottom-0 inset-x-0 z-30 bg-[var(--card)] border-t border-[var(--border)] flex items-stretch md:hidden pb-[env(safe-area-inset-bottom)]">
      {navigationItems.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          end={item.href === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-1.5 min-h-13 py-2 text-[12px] font-medium transition-colors relative ${
              isActive
                ? 'text-[var(--accent)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-[var(--accent)]" aria-hidden="true" />
              )}
              <item.icon size={20} aria-hidden />
              <span>{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
