import { useTranslation } from 'react-i18next';
import { ArrowDownCircle, ArrowUpRight, ArrowDownLeft, RefreshCw, Edit2, Trash2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { cn } from '../../utils/cn';
import { formatCurrencyValue } from '../../utils/formatUtils';
import { parseDate } from '../../utils/dateUtils';
import { SearchHighlight } from '../SearchHighlight';
import type { Transaction, Category, Wallet } from '../../db/db';

const ACTION_WIDTH = 128;
const SWIPE_OPEN_THRESHOLD = -72;
const SWIPE_CLOSE_THRESHOLD = 32;
const SWIPE_OPEN_VELOCITY = -500;
const SWIPE_CLOSE_VELOCITY = 500;

interface TransactionCardProps {
  tx: Transaction;
  categoryMap: Record<number, Category | undefined>;
  walletMap: Record<number, Wallet | undefined>;
  searchTerm: string;
  hideAmount: boolean;
  isSelectionMode: boolean;
  isSelected: boolean;
  isActionOpen: boolean;
  onSelect: (id: number) => void;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onActionOpen: () => void;
  onActionClose: () => void;
}

export function TransactionCard({
  tx,
  categoryMap,
  walletMap,
  searchTerm,
  hideAmount,
  isSelectionMode,
  isSelected,
  isActionOpen,
  onSelect,
  onClick,
  onEdit,
  onDelete,
  onActionOpen,
  onActionClose,
}: TransactionCardProps) {
  const { t } = useTranslation();

  const renderAmountValue = (amount: number) => formatCurrencyValue(amount, hideAmount);
  
  const isExpenseOrTransferOut = tx.type === 'expense' || tx.type === 'transfer_out' || 
    (tx.type === 'balance_adjustment' && tx.amount < 0);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isSelectionMode) {
        onSelect(tx.id!);
        return;
      }
      if (!isActionOpen) {
        onClick();
      }
    }
    if (event.key === 'Escape' && isActionOpen) {
      event.preventDefault();
      onActionClose();
    }
  };

  return (
    <div className="relative group overflow-hidden rounded-[16px]">
      {/* Action Buttons Background */}
      {!isSelectionMode && (
        <div className="absolute inset-0 flex items-center justify-between px-4 z-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="bg-blue-500 text-white p-2 rounded-lg flex items-center gap-1 text-xs font-bold active:scale-95 transition-transform"
            aria-label={t('Edit')}
          >
            <Edit2 size={16} /> {t('Edit')}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="bg-red-500 text-white p-2 rounded-lg flex items-center gap-1 text-xs font-bold active:scale-95 transition-transform"
            aria-label={t('Delete')}
          >
            <Trash2 size={16} /> {t('Delete')}
          </button>
        </div>
      )}

      {/* Transaction Card with Swipe */}
      <motion.div
        drag={isSelectionMode ? false : 'x'}
        dragDirectionLock
        dragElastic={0.08}
        dragConstraints={{ left: -ACTION_WIDTH, right: 0 }}
        animate={{ x: isActionOpen ? -ACTION_WIDTH : 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
        onDragStart={() => {
          if (!isSelectionMode) onActionOpen();
        }}
        onDragEnd={(_, info) => {
          if (isSelectionMode) return;
          if (info.offset.x < SWIPE_OPEN_THRESHOLD || info.velocity.x < SWIPE_OPEN_VELOCITY) {
            onActionOpen();
            return;
          }
          if (info.offset.x > SWIPE_CLOSE_THRESHOLD || info.velocity.x > SWIPE_CLOSE_VELOCITY) {
            onActionClose();
            return;
          }
          if (!isActionOpen) onActionClose();
        }}
        className={cn(
          "relative z-10 bg-[var(--card)] p-4 rounded-[16px] flex items-center shadow-sm border transition-all cursor-grab active:cursor-grabbing select-none",
          isSelectionMode 
            ? (isSelected ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/20" : "border-[var(--border)]") 
            : "border-[var(--border)]"
        )}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={() => {
          if (isSelectionMode) {
            onSelect(tx.id!);
          } else if (!isActionOpen) {
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
            {tx.categoryId ? categoryMap[tx.categoryId]?.name : '-'} • {format(parseDate(tx.date), 'dd MMM')}
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
            <span className="w-8 text-right mr-1 text-[12px] text-[var(--text-secondary)]">Rp</span>
            <span>{renderAmountValue(tx.amount)}</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
