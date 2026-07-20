import { useState, useEffect } from 'react';
import { Check } from 'reicon-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../utils/cn';
import { BottomSheetShell } from './BottomSheetShell';
import type { PayeeSortConfig, PayeeSortField } from '../services/payeeService';

interface PayeeSortSheetProps {
  isOpen: boolean;
  onClose: () => void;
  sortConfig: PayeeSortConfig;
  onApply: (config: PayeeSortConfig) => void;
}

const SORT_OPTIONS: { field: PayeeSortField; labelKey: string; order: 'asc' | 'desc'; descLabelKey: string }[] = [
  { field: 'totalExpense', labelKey: 'Total Spent', order: 'desc', descLabelKey: 'Highest First' },
  { field: 'totalExpense', labelKey: 'Total Spent', order: 'asc', descLabelKey: 'Lowest First' },
  { field: 'lastTransactionDate', labelKey: 'Last Date', order: 'desc', descLabelKey: 'Newest First' },
  { field: 'lastTransactionDate', labelKey: 'Last Date', order: 'asc', descLabelKey: 'Oldest First' },
  { field: 'transactionCount', labelKey: 'Count', order: 'desc', descLabelKey: 'Highest First' },
  { field: 'transactionCount', labelKey: 'Count', order: 'asc', descLabelKey: 'Lowest First' },
  { field: 'averageAmount', labelKey: 'Average', order: 'desc', descLabelKey: 'Highest First' },
  { field: 'averageAmount', labelKey: 'Average', order: 'asc', descLabelKey: 'Lowest First' },
  { field: 'name', labelKey: 'Name', order: 'asc', descLabelKey: 'A to Z' },
  { field: 'name', labelKey: 'Name', order: 'desc', descLabelKey: 'Z to A' },
];

export function PayeeSortSheet({ isOpen, onClose, sortConfig, onApply }: PayeeSortSheetProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<{ field: PayeeSortField; order: 'asc' | 'desc' }>({
    field: sortConfig.field,
    order: sortConfig.order,
  });

  useEffect(() => {
    if (isOpen) {
      setSelected({ field: sortConfig.field, order: sortConfig.order });
    }
  }, [isOpen, sortConfig.field, sortConfig.order]);

  const handleApply = () => {
    onApply(selected);
    onClose();
  };

  return (
    <BottomSheetShell
      isOpen={isOpen}
      onClose={onClose}
      title={t('Sort Payees')}
      ariaLabel={t('Sort Payees')}
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
          {SORT_OPTIONS.map((opt) => {
            const isSelected = selected.field === opt.field && selected.order === opt.order;
            return (
              <button
                key={`${opt.field}-${opt.order}`}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelected({ field: opt.field, order: opt.order })}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-xl text-sm transition-colors border flex items-center justify-between",
                  isSelected
                    ? "bg-[var(--accent-fill)] text-[var(--accent-ink)] border-[var(--accent-fill)]"
                    : "bg-[var(--bg)] text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--accent)]"
                )}
              >
                <div className="flex flex-col">
                  <span className="font-bold">{t(opt.labelKey)}</span>
                  <span className="text-xs opacity-70">{t(opt.descLabelKey)}</span>
                </div>
                {isSelected && <Check size={16} />}
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={handleApply}
            className="w-full bg-[var(--accent-fill)] text-[var(--accent-ink)] font-bold py-4 rounded-xl active:scale-95 transition-transform shadow-lg shadow-[var(--accent-fill)]/20"
          >
            {t('Apply')}
          </button>
        </div>
      </div>
    </BottomSheetShell>
  );
}
