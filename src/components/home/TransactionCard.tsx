import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownCircle, ArrowUpRight, ArrowDownLeft, RefreshCw, Edit2, Trash2, CheckCircle2, MoreVertical, Eye } from 'lucide-react';
import { cn } from '../../utils/cn';
import { FALLBACK_CATEGORY_NAME } from '../../utils/categoryDisplay';
import { formatCurrencyValue } from '../../utils/formatUtils';
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

  // Close menu on click outside
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isSelectionMode) {
        onSelect(tx.id!);
        return;
      }
      onClick();
    }
  };

  return (
    <div className={cn("relative group rounded-[16px]", isMenuOpen && "z-40")}>
      {/* Transaction Card */}
      <div
        className={cn(
          "relative z-10 bg-[var(--card)] p-4 rounded-[16px] flex items-center shadow-sm border transition-[border-color,background-color,box-shadow] select-none",
          isSelectionMode 
            ? (isSelected ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/20" : "border-[var(--border)]") 
            : "border-[var(--border)]"
        )}
        role="button"
        tabIndex={0}
        data-testid="transaction-row"
        data-tx-id={tx.id}
        data-tx-type={tx.type}
        onKeyDown={handleKeyDown}
        onClick={() => {
          if (isSelectionMode) {
            onSelect(tx.id!);
          } else {
            onClick();
          }
        }}
      >
        {isSelectionMode && (
          <div className={cn(
            "w-5 h-5 rounded-full border-2 mr-4 flex items-center justify-center transition-colors shrink-0",
            isSelected
              ? "bg-[var(--accent)] border-[var(--accent)] text-white" 
              : "border-[var(--border)] text-transparent"
          )}>
            <CheckCircle2 size={14} />
          </div>
        )}
        
        {!isSelectionMode && (
          <div 
            className={cn(
              "w-8 h-8 rounded-full mr-4 mt-0.5 shrink-0 flex items-center justify-center",
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
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-[14px] truncate">
              {tx.type === 'balance_adjustment' ? t('Balance Adjustment') : (
                searchTerm ? <SearchHighlight text={tx.description} searchTerm={searchTerm} /> : tx.description
              )}
            </p>
          </div>
          <p className="text-[12px] text-[var(--text-secondary)]">
            {categoryName} • {displayDateShort(tx.date, i18n.language)}
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
        </div>

        <div className="text-right ml-2">
          <p className={cn(
            "font-mono font-semibold text-[15px] inline-flex items-baseline",
            isExpenseOrTransferOut ? "text-[var(--expense)]" : "text-[var(--accent)]"
          )}>
            <span className="w-4 text-right mr-1">
              {isExpenseOrTransferOut ? '-' : '+'}
            </span>

            <span>{renderAmountValue(tx.amount)}</span>
          </p>
        </div>

        {/* Kebab Menu Button */}
        {!isSelectionMode && (
          <div ref={menuRef} className="relative ml-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(!isMenuOpen);
              }}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg)] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label={t('Open transaction actions')}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
            >
              <MoreVertical size={16} />
            </button>
            {isMenuOpen && (
              <div
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
    </div>
  );
}
