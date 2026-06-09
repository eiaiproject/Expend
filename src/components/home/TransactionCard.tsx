import { useTranslation } from 'react-i18next';
import { ArrowDownCircle, ArrowUpRight, ArrowDownLeft, RefreshCw, Edit2, Trash2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../utils/cn';
import { formatCurrencyValue } from '../../utils/formatUtils';
import { parseDate } from '../../utils/dateUtils';
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
  onDragEnd: (direction: 'left' | 'right') => void;
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
  onDragEnd,
}: TransactionCardProps) {
  const { t } = useTranslation();

  const renderAmountValue = (amount: number) => formatCurrencyValue(amount, hideAmount);
  
  const isExpenseOrTransferOut = tx.type === 'expense' || tx.type === 'transfer_out' || 
    (tx.type === 'balance_adjustment' && tx.amount < 0);

  return (
    <div className="relative group overflow-hidden rounded-[16px]">
      {/* Action Buttons Background */}
      {!isSelectionMode && (
        <div className="absolute inset-0 flex items-center justify-between px-4 z-0">
          <div className="bg-blue-500 text-white p-2 rounded-lg flex items-center gap-1 text-xs font-bold">
            <Edit2 size={16} /> {t('Edit')}
          </div>
          <div className="bg-red-500 text-white p-2 rounded-lg flex items-center gap-1 text-xs font-bold">
            <Trash2 size={16} /> {t('Delete')}
          </div>
        </div>
      )}

      {/* Transaction Card */}
      <div 
        className={cn(
          "relative z-10 bg-[var(--card)] p-4 rounded-[16px] flex items-center shadow-sm border transition-all cursor-pointer hover:shadow-md hover:border-[var(--accent)]/30 active:scale-[0.98]",
          isSelectionMode 
            ? (isSelected ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/20" : "border-[var(--border)] hover:border-[var(--border)]") 
            : "border-[var(--border)]"
        )}
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
      </div>
    </div>
  );
}
