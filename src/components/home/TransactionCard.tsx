import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownCircle, ArrowUpRight, ArrowDownLeft, RefreshCw, Edit2, Trash2, MoreVertical, Eye, CheckCircle2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import { FALLBACK_CATEGORY_NAME } from '../../utils/constants';
import { formatCurrencyValue, formatSignedCurrency } from '../../utils/formatUtils';
import { displayDateShort } from '../../utils/dateUtils';
import { SearchHighlight } from '../SearchHighlight';
import type { Transaction, Category, Wallet } from '../../db/db';

interface TransactionCardProps {
  tx: Transaction;
  categoryMap: Record<number, Category | undefined>;
  walletMap: Record<number, Wallet | undefined>;
  searchTerm: string;
  hideAmount: boolean;
  isSelectionMode: boolean;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewDetail?: () => void;
}

function txAccessibleLabel(tx: Transaction, categoryName: string, hideAmount: boolean, t: (key: string, opts?: any) => string): string {
  const typeLabel =
    tx.type === 'expense' ? t('home.typeExpense') :
    tx.type === 'transfer_out' || tx.type === 'transfer_in' ? t('home.typeTransfer') :
    tx.type === 'balance_adjustment' ? t('Balance Adjustment') :
    tx.type;
  if (hideAmount) {
    return `${tx.description}, ${typeLabel}, ${categoryName}`;
  }
  return `${tx.description}, ${typeLabel}, ${formatCurrencyValue(tx.amount, false)}`;
}

function txActionsLabel(tx: Transaction, hideAmount: boolean, t: (key: string, opts?: any) => string): string {
  if (hideAmount) {
    return t('home.actionsFor', { name: tx.description });
  }
  return t('home.actionsFor', { name: `${tx.description} - ${formatCurrencyValue(tx.amount, false)}` });
}

export function TransactionCard({
  tx,
  categoryMap,
  walletMap,
  searchTerm,
  hideAmount,
  isSelectionMode,
  isSelected,
  onSelect,
  onClick,
  onEdit,
  onDelete,
  onViewDetail,
}: TransactionCardProps) {
  const { t, i18n } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const renderAmountValue = (amount: number) => formatCurrencyValue(amount, hideAmount);
  const categoryName = tx.categoryId
    ? (categoryMap[tx.categoryId]?.name === FALLBACK_CATEGORY_NAME ? t('Other') : categoryMap[tx.categoryId]?.name) || '-'
    : '-';
  
  const isExpenseOrTransferOut = tx.type === 'expense' || tx.type === 'transfer_out' || 
    (tx.type === 'balance_adjustment' && tx.amount < 0);

  // Close menu on click outside or Escape
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
        // Return focus to menu trigger
        const trigger = menuRef.current?.previousElementSibling as HTMLElement;
        trigger?.focus();
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleMainClick = useCallback(() => {
    if (isSelectionMode) {
      onSelect(tx.id!);
    } else {
      onClick();
    }
  }, [isSelectionMode, onSelect, onClick, tx.id]);

  const handleMainKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleMainClick();
    }
  }, [handleMainClick]);

  const accessibleLabel = txAccessibleLabel(tx, categoryName, hideAmount, t);
  const actionsLabel = txActionsLabel(tx, hideAmount, t);

  return (
    <article
      className={cn("relative rounded-[16px] bg-[var(--card)] border transition-[border-color,background-color,box-shadow]",
        isSelectionMode 
          ? (isSelected ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/20" : "border-[var(--border)]") 
          : "border-[var(--border)]",
        isMenuOpen && "z-40"
      )}
      data-testid="transaction-row"
      data-tx-id={tx.id}
      data-tx-type={tx.type}
    >
      <div className="flex items-center p-4 gap-3">
        {/* Selection checkbox */}
        {isSelectionMode && (
          <div className={cn(
            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
            isSelected
              ? "bg-[var(--accent)] border-[var(--accent)] text-white" 
              : "border-[var(--border)] text-transparent"
          )} aria-hidden="true">
            <CheckCircle2 size={14} />
          </div>
        )}

        {/* Type icon */}
        {!isSelectionMode && (
          <div 
            className={cn(
              "w-8 h-8 rounded-full shrink-0 flex items-center justify-center",
              tx.type === 'expense' && "bg-red-500/10 text-red-500",
              tx.type === 'transfer_out' && "bg-orange-500/10 text-orange-500",
              tx.type === 'transfer_in' && "bg-green-500/10 text-green-500",
              tx.type === 'balance_adjustment' && "bg-gray-500/10 text-gray-500"
            )}
            aria-hidden="true"
          >
            {tx.type === 'expense' && <ArrowDownCircle size={16} />}
            {tx.type === 'transfer_out' && <ArrowUpRight size={16} />}
            {tx.type === 'transfer_in' && <ArrowDownLeft size={16} />}
            {tx.type === 'balance_adjustment' && <RefreshCw size={16} />}
          </div>
        )}

        {/* Main content area — button for detail */}
        <button
          type="button"
          onClick={handleMainClick}
          onKeyDown={handleMainKeyDown}
          className="flex-1 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 focus-visible:rounded-lg"
          aria-label={accessibleLabel}
        >
          <div className="flex items-center gap-2">
            <p className="font-medium text-[14px] truncate">
              {tx.type === 'balance_adjustment' ? t('Balance Adjustment') : (
                searchTerm ? <SearchHighlight text={tx.description} searchTerm={searchTerm} /> : tx.description
              )}
            </p>
          </div>
          <p className="text-[12px] text-[var(--text-secondary)]">
            <span className="sr-only">{tx.type === 'expense' ? t('home.typeExpense') : tx.type === 'transfer_out' || tx.type === 'transfer_in' ? t('home.typeTransfer') : t('home.typeAdjustment')}: </span>
            {categoryName}
            {' · '}
            {displayDateShort(tx.date, i18n.language)}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--border)] text-[var(--text-primary)] font-medium">
              {walletMap[tx.walletId]?.name || t('Unknown Wallet')}
            </span>
            {tx.notes && (
              <p className="text-[11px] text-[var(--text-secondary)] italic truncate">
                {tx.notes}
              </p>
            )}
          </div>
        </button>

        {/* Amount — single formatted string, no separate minus */}
        <div className="text-right shrink-0">
          <p className={cn(
            "font-mono font-semibold text-[15px]",
            isExpenseOrTransferOut ? "text-[var(--expense)]" : "text-[var(--accent)]"
          )}>
            {formatSignedCurrency(tx.amount, hideAmount)}
          </p>
        </div>

        {/* Kebab menu — sibling, not nested */}
        {!isSelectionMode && (
          <div ref={menuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(!isMenuOpen);
              }}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
              aria-label={actionsLabel}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              aria-controls={isMenuOpen ? `tx-menu-${tx.id}` : undefined}
            >
              <MoreVertical size={16} />
            </button>
            {isMenuOpen && (
              <div
                id={`tx-menu-${tx.id}`}
                role="menu"
                className="absolute right-0 top-full mt-1 w-44 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg z-30 py-1"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    onViewDetail?.() ?? onClick();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg)] transition-colors text-left"
                >
                  <Eye size={14} />
                  {t('View Detail')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    onEdit();
                  }}
                  disabled={tx.type === 'transfer_in' || tx.type === 'transfer_out' || tx.type === 'balance_adjustment'}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg)] transition-colors text-left disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Edit2 size={14} />
                  {t('Edit')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    onDelete();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors text-left"
                >
                  <Trash2 size={14} />
                  {t('Delete')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
