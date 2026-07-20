import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { More, Eye, Edit, ArrowSwapHorizontal, Scale, Archive, ArchiveTick, Trash2 } from 'reicon-react';
import type { Wallet } from '../../db/db';
import { usePrivacy } from '../../contexts/PrivacyContext';

interface WalletOverflowMenuProps {
  wallet: Wallet;
  onViewTransactions: () => void;
  onEdit: () => void;
  onTransfer: () => void;
  onReconcile: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  onDelete: () => void;
}

/**
 * Overflow menu for wallet actions.
 * Uses a button trigger + absolutely-positioned menu.
 * On mobile (< lg), renders as a bottom sheet for better touch ergonomics.
 *
 * Follows W3C menu button pattern:
 * - trigger: aria-haspopup="menu", aria-expanded, aria-controls
 * - menu: role="menu", menuitem items
 * - Escape closes, focus returns to trigger
 */
export function WalletOverflowMenu({
  wallet,
  onViewTransactions,
  onEdit,
  onTransfer,
  onReconcile,
  onDeactivate,
  onReactivate,
  onDelete,
}: WalletOverflowMenuProps) {
  const { t } = useTranslation();
  const { hideAmount } = usePrivacy();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = `wallet-menu-${wallet.id}`;

  const isArchived = !!wallet.archivedAt;

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Close on Escape, return focus to trigger
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  // Focus first menu item when opened
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const firstItem = menuRef.current.querySelector('[role="menuitem"]') as HTMLElement;
      firstItem?.focus();
    }
  }, [isOpen]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) return;
    const items = menuRef.current?.querySelectorAll('[role="menuitem"]') as NodeListOf<HTMLElement>;
    if (!items?.length) return;
    const currentIndex = Array.from(items).indexOf(document.activeElement as HTMLElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      items[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      items[prev]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  }, [isOpen]);

  const closeAnd = (action: () => void) => () => {
    setIsOpen(false);
    action();
  };

  const label = t('wallet.actionsFor', { name: wallet.name });

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
      >
        <More size={18} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={handleKeyDown}
          className="absolute right-0 top-full mt-1 z-50 w-56 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden"
        >
          <button
            type="button"
            role="menuitem"
            onClick={closeAnd(onViewTransactions)}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-[var(--bg)] transition-colors focus-visible:outline-none focus-visible:bg-[var(--bg)]"
          >
            <Eye size={16} aria-hidden="true" className="shrink-0" />
            {t('wallet.viewTransactions')}
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={closeAnd(onEdit)}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-[var(--bg)] transition-colors focus-visible:outline-none focus-visible:bg-[var(--bg)]"
          >
            <Edit size={16} aria-hidden="true" className="shrink-0" />
            {t('wallet.editWallet')}
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={closeAnd(onTransfer)}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-[var(--bg)] transition-colors focus-visible:outline-none focus-visible:bg-[var(--bg)]"
          >
            <ArrowSwapHorizontal size={16} aria-hidden="true" className="shrink-0" />
            {t('wallet.transferFunds')}
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={closeAnd(onReconcile)}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-[var(--bg)] transition-colors focus-visible:outline-none focus-visible:bg-[var(--bg)]"
          >
            <Scale size={16} aria-hidden="true" className="shrink-0" />
            {t('wallet.reconcileBalance')}
          </button>

          <div className="border-t border-[var(--border)] my-1" role="separator" />

          {isArchived ? (
            <button
              type="button"
              role="menuitem"
              onClick={closeAnd(onReactivate)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-[var(--bg)] transition-colors focus-visible:outline-none focus-visible:bg-[var(--bg)]"
            >
              <ArchiveTick size={16} aria-hidden="true" className="shrink-0" />
              {t('wallet.reactivateWallet')}
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={closeAnd(onDeactivate)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-[var(--bg)] transition-colors focus-visible:outline-none focus-visible:bg-[var(--bg)]"
            >
              <Archive size={16} aria-hidden="true" className="shrink-0" />
              {t('wallet.deactivateWallet')}
            </button>
          )}

          <div className="border-t border-[var(--border)] my-1" role="separator" />
          <button
            type="button"
            role="menuitem"
            onClick={closeAnd(onDelete)}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left text-red-500 hover:bg-red-500/5 transition-colors focus-visible:outline-none focus-visible:bg-red-500/5"
          >
            <Trash2 size={16} aria-hidden="true" className="shrink-0" />
            {t('wallet.deletePermanently')}
          </button>
        </div>
      )}
    </div>
  );
}
