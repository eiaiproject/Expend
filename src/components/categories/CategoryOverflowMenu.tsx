import { useState, useRef, useEffect, useCallback } from 'react';
import { More } from 'reicon-react';
import { useTranslation } from 'react-i18next';

interface MenuItem {
  readonly label: string;
  readonly onClick: () => void;
  readonly danger?: boolean;
}

interface CategoryOverflowMenuProps {
  readonly categoryName: string;
  readonly items: MenuItem[];
  readonly disabled?: boolean;
}

export function CategoryOverflowMenu({ categoryName, items, disabled }: CategoryOverflowMenuProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = `category-menu-${categoryName.replace(/\s+/g, '-').toLowerCase()}`;

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, closeMenu]);

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)] transition-colors"
        aria-label={t('categories.actionsFor', { name: categoryName })}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
      >
        <More size={18} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label={t('categories.actionsFor', { name: categoryName })}
          className="absolute right-0 top-full mt-1 w-56 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {items.map((item, i) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                item.onClick();
                closeMenu();
              }}
              className={`w-full text-left px-4 py-3 text-sm min-h-[44px] flex items-center transition-colors ${
                item.danger
                  ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                  : 'text-[var(--text-primary)] hover:bg-[var(--bg)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
