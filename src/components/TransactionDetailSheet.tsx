import { useTranslation } from 'react-i18next';
import { Transaction } from '../db/db';
import { Edit2, Trash2, Repeat } from 'lucide-react';
import { displayDateFull } from '../utils/dateUtils';
import { formatCurrency } from '../utils/formatUtils';
import { BottomSheetShell } from './BottomSheetShell';

interface TransactionDetailSheetProps {
  tx: Transaction | null;
  onClose: () => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
  onRepeat: (tx: Transaction) => void;
}

export function TransactionDetailSheet({ tx, onClose, onEdit, onDelete, onRepeat }: TransactionDetailSheetProps) {
  const { t, i18n } = useTranslation();

  const handleDelete = async () => {
    if (!tx || !tx.id) return;
    if (navigator.vibrate) navigator.vibrate(50);

    // Delegate deletion + paired transfer cleanup + undo toast + category cleanup to parent
    onDelete(tx);
    
    onClose();
  };

  if (!tx) return null;

  return (
    <BottomSheetShell
      isOpen={!!tx}
      onClose={onClose}
      title={tx.description || t('Transaction Details')}
      ariaLabel={tx.description || t('Transaction Details')}
      zIndex={60}
    >
      <div className="px-6 py-8 flex flex-col gap-4">
        <div className="text-center">
               <p className="text-[var(--text-secondary)] text-sm mb-1">{displayDateFull(tx.date, i18n.language)}</p>
               <h2 className="text-2xl font-bold mb-2">{tx.description}</h2>
               <p className={(tx.type === 'expense' || tx.type === 'transfer_out' || (tx.type === 'balance_adjustment' && tx.amount < 0)) ? "text-[var(--expense)] text-3xl font-mono font-bold" : "text-[var(--accent)] text-3xl font-mono font-bold"}>
                 {(tx.type === 'expense' || tx.type === 'transfer_out' || (tx.type === 'balance_adjustment' && tx.amount < 0)) ? '-' : '+'}{formatCurrency(tx.amount)}
               </p>
               {tx.notes && <p className="mt-4 text-sm bg-[var(--bg)] p-3 rounded-lg inline-block text-left">{tx.notes}</p>}
            </div>

            <button 
              onClick={() => { onClose(); onRepeat(tx); }}
              className="w-full flex items-center justify-center gap-2 py-4 bg-[var(--accent-fill)] text-[var(--accent-ink)] rounded-xl font-bold active:scale-95 transition-transform shadow-lg shadow-[var(--accent-fill)]/20"
            >
              <Repeat size={18} /> {t('Repeat Transaction')}
            </button>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => { onClose(); onEdit(tx); }}
                disabled={tx.type === 'transfer_in' || tx.type === 'transfer_out' || tx.type === 'balance_adjustment'}
                title={(tx.type === 'transfer_in' || tx.type === 'transfer_out') ? t('Editing transfers is not supported in this version.') : undefined}
                className="flex items-center justify-center gap-2 py-4 bg-[var(--bg)] rounded-xl font-bold disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Edit2 size={18} /> {t('Edit')}
              </button>
              <button 
                onClick={handleDelete}
                className="flex items-center justify-center gap-2 py-4 bg-red-500/10 text-red-600 rounded-xl font-bold"
              >
                <Trash2 size={18} /> {t('Delete')}
              </button>
            </div>
        </div>
    </BottomSheetShell>
  );
}
