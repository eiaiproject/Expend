import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownCircle, ArrowUpRight, ArrowDownLeft, Refresh, Edit2, Trash2, More, Eye, CheckCircle } from 'reicon-react';
import { cn } from '../../utils/cn';
import { FALLBACK_CATEGORY_NAME } from '../../utils/constants';
import { formatCurrencyValue, formatTransactionAmount } from '../../utils/formatUtils';
import { displayDateShort } from '../../utils/dateUtils';
import { SearchHighlight } from '../SearchHighlight';
import type { Transaction, Category, Wallet } from '../../db/db';

interface TransactionCardProps {
  readonly tx: Transaction;
  readonly categoryMap: Record<number, Category | undefined>;
  readonly walletMap: Record<number, Wallet | undefined>;
  readonly searchTerm: string;
  readonly hideAmount: boolean;
  readonly isSelectionMode: boolean;
  readonly isSelected: boolean;
  readonly onSelect: (id: number) => void;
  readonly onClick: () => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly onViewDetail?: () => void;
}

function txTypeLabel(tx: Transaction, t: (key: string, opts?: any) => string): string {
  switch (tx.type) {
    case 'expense': return t('home.typeExpense');
    case 'transfer_out':
    case 'transfer_in': return t('home.typeTransfer');
    case 'balance_adjustment': return t('Balance Adjustment');
    default: return tx.type;
  }
}

function txAccessibleLabel(tx: Transaction, categoryName: string, hideAmount: boolean, t: (key: string, opts?: any) => string): string {
  const typeLabel = txTypeLabel(tx, t);
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

/** Transaction type icon chip (extracted — friction audit B5). */
function TypeIcon({ tx }: { readonly tx: Transaction }) {
  return (
    <div className={cn("w-8 h-8 rounded-full shrink-0 flex items-center justify-center",
      tx.type === 'expense' && 'bg-[var(--danger-bg)] text-[var(--danger)]',
      tx.type === 'transfer_out' && 'bg-[var(--warning-bg)] text-[var(--warning)]',
      tx.type === 'transfer_in' && 'bg-[var(--success-bg)] text-[var(--success)]',
      tx.type === 'balance_adjustment' && 'bg-[var(--info-bg)] text-[var(--info)]'
    )} aria-hidden="true">
      {tx.type === 'expense' && <ArrowDownCircle size={16} />}
      {tx.type === 'transfer_out' && <ArrowUpRight size={16} />}
      {tx.type === 'transfer_in' && <ArrowDownLeft size={16} />}
      {tx.type === 'balance_adjustment' && <Refresh size={16} />}
    </div>
  );
}

/** Kebab-menu row (extracted — friction audit B5). */
function TxMenuItem({
  icon,
  label,
  tone = 'default',
  disabled,
  onAction,
  onClose,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly tone?: 'default' | 'danger';
  readonly disabled?: boolean;
  readonly onAction: () => void;
  readonly onClose: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
        onAction();
      }}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors text-left",
        tone === 'danger'
          ? "text-[var(--danger)] hover:bg-[var(--danger-bg)]"
          : "text-[var(--text-primary)] hover:bg-[var(--bg)]",
        disabled && "opacity-30 cursor-not-allowed"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// NOSONAR S3776 — cognitive complexity is inherent to this business logic
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

  const resolveCategoryName = () => {
    if (!tx.categoryId) return '-';
    const mapped = categoryMap[tx.categoryId]?.name;
    if (mapped && mapped !== FALLBACK_CATEGORY_NAME) return mapped;
    if (mapped === FALLBACK_CATEGORY_NAME) return t('Other');
    return '-';
  };
  const categoryName = resolveCategoryName();
  
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

  const descriptionNode = (() => {
    if (tx.type === 'balance_adjustment') return t('Balance Adjustment');
    if (searchTerm) return <SearchHighlight text={tx.description} searchTerm={searchTerm} />;
    return tx.description;
  })();

  const typeIcon = !isSelectionMode ? <TypeIcon tx={tx} /> : null;

  return (
    <article
      className={cn("relative rounded-[16px] bg-[var(--card)] border transition-[border-color,background-color,box-shadow]",
        isSelectionMode && isSelected ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/20" : "border-[var(--border)]", // ponytail: flattened ternary
        isMenuOpen && "z-50"
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
              ? "bg-[var(--accent-fill)] border-[var(--accent-fill)] text-[var(--accent-ink)]" 
              : "border-[var(--border)] text-transparent"
          )} aria-hidden="true">
            <CheckCircle size={14} />
          </div>
        )}

        {/* Type icon */}
        {typeIcon}

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
              {descriptionNode}
            </p>
          </div>
          <p className="text-[12px] text-[var(--text-secondary)]">
            <span className="sr-only">{txTypeLabel(tx, t)}: </span>
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
            {formatTransactionAmount(tx.type, tx.amount, hideAmount)}
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
              <More size={16} />
            </button>
            {isMenuOpen && (
              <div
                id={`tx-menu-${tx.id}`}
                role="menu"
                className="absolute right-0 top-full mt-1 w-44 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg z-50 py-1"
              >
                <TxMenuItem
                  icon={<Eye size={14} />}
                  label={t('View Detail')}
                  onAction={() => onViewDetail?.() ?? onClick()}
                  onClose={() => setIsMenuOpen(false)}
                />
                <TxMenuItem
                  icon={<Edit2 size={14} />}
                  label={t('Edit')}
                  disabled={tx.type === 'transfer_in' || tx.type === 'transfer_out' || tx.type === 'balance_adjustment'}
                  onAction={onEdit}
                  onClose={() => setIsMenuOpen(false)}
                />
                <TxMenuItem
                  icon={<Trash2 size={14} />}
                  label={t('Delete')}
                  tone="danger"
                  onAction={onDelete}
                  onClose={() => setIsMenuOpen(false)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
