import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Transaction } from '../db/db';
import { Edit2, Trash2, Repeat } from 'reicon-react';
import { displayDateFull } from '../utils/dateUtils';
import { formatCurrency } from '../utils/formatUtils';
import { BottomSheetShell } from './BottomSheetShell';

interface TransactionDetailSheetProps {
  readonly tx: Transaction | null;
  readonly onClose: () => void;
  readonly onEdit: (tx: Transaction) => void;
  readonly onDelete: (tx: Transaction) => void;
  readonly onRepeat: (tx: Transaction) => void;
}

export function TransactionDetailSheet({ tx, onClose, onEdit, onDelete, onRepeat }: TransactionDetailSheetProps) {
  const { t, i18n } = useTranslation();

  const handleDelete = async () => {
    if (!tx?.id) return;
    if (navigator.vibrate) navigator.vibrate(50);

    // Delegate deletion + paired transfer cleanup + undo toast + category cleanup to parent
    onDelete(tx);
    
    onClose();
  };

  if (!tx) return null;
  const canRepeat = tx.type === 'expense' || tx.type === 'transfer_in' || tx.type === 'transfer_out';

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
               {tx.description && (
                 <Link
                   to={`/payees?q=${encodeURIComponent(tx.description)}`}
                   className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline rounded-md px-1"
                 >
                   {t('payees.viewPayee')}
                 </Link>
               )}
            </div>

            <button type="button" 
              onClick={() => { onClose(); onRepeat(tx); }}
              disabled={!canRepeat}
              className="w-full flex items-center justify-center gap-2 py-4 bg-[var(--accent-fill)] text-[var(--accent-ink)] rounded-xl font-bold active:scale-95 transition-transform shadow-lg shadow-[var(--accent-fill)]/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              <Repeat size={18} /> {t('Repeat Transaction')}
            </button>

            <div className="grid grid-cols-2 gap-4">
              <button type="button" 
                onClick={() => { onClose(); onEdit(tx); }}
                disabled={tx.type === 'balance_adjustment'}
                className="flex items-center justify-center gap-2 py-4 bg-[var(--bg)] rounded-xl font-bold disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Edit2 size={18} /> {t('Edit')}
              </button>
              <button type="button" 
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
