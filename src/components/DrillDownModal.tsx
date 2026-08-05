import { useTranslation } from 'react-i18next';
import { useEscapeKeyClose } from '../hooks/useEscapeKeyClose';
import { Transaction } from '../db/db';
import { FALLBACK_CATEGORY_NAME } from '../utils/constants';
import { displayDateShort } from '../utils/dateUtils';
import { usePrivacy } from '../contexts/PrivacyContext';
import { X } from 'reicon-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface DrillDownModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly transactions: Transaction[];
  readonly categoryMap: Record<number, { name: string; color: string } | undefined>;
}

export function DrillDownModal({ isOpen, onClose, title, transactions, categoryMap }: DrillDownModalProps) {
  const { t, i18n } = useTranslation();
  const { hideAmount } = usePrivacy();
  const dialogRef = useFocusTrap(isOpen);

  useEscapeKeyClose(isOpen, onClose);

  return (
    <>
      {isOpen && (
        <dialog
          ref={dialogRef as unknown as React.RefObject<HTMLDialogElement>}
          open
          aria-label={title}
          className="w-full sm:max-w-lg bg-[var(--card)] rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col border-0 backdrop:bg-black/50 backdrop:backdrop-blur-sm fixed m-0 max-w-full animate-in fade-in slide-in-from-bottom-full sm:slide-in-from-bottom-4 sm:zoom-in-95 duration-300 ease-out"
          style={{ zIndex: 50 }}
        >
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h2 className="text-lg font-bold truncate">{title}</h2>
              <button type="button" onClick={onClose} className="p-2 rounded-full bg-[var(--bg)] shrink-0" aria-label={t('Close')}>
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
                          {displayDateShort(tx.date, i18n.language)} • {(cat?.name === FALLBACK_CATEGORY_NAME ? t('Other') : cat?.name) || t('Other')}
                        </p>
                      </div>
                      <span className={`font-mono text-sm font-semibold ml-3 ${tx.type === 'expense' || (tx.type === 'balance_adjustment' && tx.amount < 0) ? 'text-[var(--expense)]' : 'text-[var(--accent)]'}`}>
                        {(() => {
                          if (hideAmount) return '•••••';
                          const sign = tx.type === 'expense' || (tx.type === 'balance_adjustment' && tx.amount < 0) ? '-' : '+';
                          return `${sign}Rp ${Math.abs(tx.amount).toLocaleString('id-ID')}`;
                        })()}
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
          </dialog>
      )}
    </>
  );
}
