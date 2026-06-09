import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { Transaction } from '../db/db';
import { format } from 'date-fns';
import { parseDate } from '../utils/dateUtils';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface DrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  transactions: Transaction[];
  categoryMap: Record<number, { name: string; color: string } | undefined>;
}

export function DrillDownModal({ isOpen, onClose, title, transactions, categoryMap }: DrillDownModalProps) {
  const { t, i18n } = useTranslation();
  const dialogRef = useFocusTrap(isOpen);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-full sm:max-w-lg bg-[var(--card)] rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h2 className="text-lg font-bold truncate">{title}</h2>
              <button onClick={onClose} className="p-2 rounded-full bg-[var(--bg)] shrink-0" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {transactions.length === 0 ? (
                <p className="text-center text-[var(--text-secondary)] py-8 text-sm">
                  {t('No transactions in this view')}
                </p>
              ) : (
                transactions.map(tx => {
                  const cat = categoryMap[tx.categoryId ?? -1];
                  return (
                    <div key={tx.id} className="flex items-center justify-between p-3 bg-[var(--bg)] rounded-xl">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{tx.description}</p>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          {format(parseDate(tx.date), 'dd MMM')} • {cat?.name || t('Other')}
                        </p>
                      </div>
                      <span className={`font-mono text-sm font-semibold ml-3 ${tx.type === 'expense' || (tx.type === 'balance_adjustment' && tx.amount < 0) ? 'text-[var(--expense)]' : 'text-[var(--accent)]'}`}>
                        {tx.type === 'expense' || (tx.type === 'balance_adjustment' && tx.amount < 0) ? '-' : '+'}Rp {Math.abs(tx.amount).toLocaleString('id-ID')}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
            <div className="p-4 border-t border-[var(--border)]">
              <p className="text-xs text-[var(--text-secondary)] text-center">
                {transactions.length} {t('transactions')}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
