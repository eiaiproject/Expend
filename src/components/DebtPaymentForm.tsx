import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Debt } from '../db/db';
import { BottomSheetShell } from './BottomSheetShell';
import { format } from 'date-fns';
import { cn } from '../utils/cn';
import { formatCurrencyIntl } from '../utils/formatUtils';
import { Wallet } from 'lucide-react';

interface DebtPaymentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: PaymentFormData) => void;
  debt: Debt | null;
}

export interface PaymentFormData {
  amount: number;
  date: string;
  note?: string;
  createTransaction: boolean;
}

export function DebtPaymentForm({ isOpen, onClose, onSave, debt }: DebtPaymentFormProps) {
  const { t } = useTranslation();
  const formId = useId();
  const amountInputId = `${formId}-payment-amount`;
  const dateInputId = `${formId}-payment-date`;
  const noteInputId = `${formId}-payment-note`;

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const [createTransaction, setCreateTransaction] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!debt) return;

    if (!amount || parseFloat(amount) <= 0) {
      newErrors.amount = t('Amount must be greater than 0');
    } else if (parseFloat(amount) > debt.remainingAmount) {
      newErrors.amount = t('Amount cannot exceed remaining balance');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    const paymentAmount = parseFloat(amount);

    onSave({
      amount: paymentAmount,
      date,
      note: note.trim() || undefined,
      createTransaction,
    });

    // Reset form
    setAmount('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setNote('');
    setCreateTransaction(true);
    setErrors({});
    onClose();
  };

  const handleQuickAmount = (percentage: number) => {
    if (!debt) return;
    const quickAmount = Math.floor(debt.remainingAmount * percentage);
    setAmount(quickAmount.toString());
  };

  if (!debt) return null;

  const isPayable = debt.type === 'payable';

  return (
    <BottomSheetShell isOpen={isOpen} onClose={onClose} title={t('Record Payment')}>
      <div className="px-3 py-4 space-y-4">

        {/* Debt Info */}
        <div className="bg-[var(--bg)] p-3 rounded-xl">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-[var(--text-secondary)]">{debt.contactName}</p>
              <p className="font-medium text-sm">{debt.description}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[var(--text-secondary)]">{t('Remaining')}</p>
              <p className={cn(
                "font-mono font-bold",
                isPayable ? "text-orange-600" : "text-green-600"
              )}>
                {formatCurrencyIntl(debt.remainingAmount)}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount */}
          <div>
            <label htmlFor={amountInputId} className="block text-sm font-medium mb-1.5">{t('Payment Amount')}</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">Rp</span>
              <input
                id={amountInputId}
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (errors.amount) setErrors(prev => ({ ...prev, amount: '' }));
                }}
                placeholder="0"
                min="1"
                max={debt.remainingAmount}
                className={cn(
                  "w-full pl-10 pr-4 py-3 bg-[var(--bg)] border rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] font-mono",
                  errors.amount ? "border-red-500" : "border-[var(--border)]"
                )}
                required
              />
            </div>
            {errors.amount && (
              <p className="text-red-500 text-xs mt-1">{errors.amount}</p>
            )}
          </div>

          {/* Quick Amount Buttons */}
          <div className="flex gap-2">
            {[0.25, 0.5, 0.75, 1].map((percentage) => (
              <button
                key={percentage}
                type="button"
                onClick={() => handleQuickAmount(percentage)}
                className="flex-1 py-2 text-xs font-medium bg-[var(--bg)] border border-[var(--border)] rounded-lg hover:bg-[var(--card)] transition-colors"
              >
                {percentage === 1 ? t('All') : `${percentage * 100}%`}
              </button>
            ))}
          </div>

          {/* Date */}
          <div>
            <label htmlFor={dateInputId} className="block text-sm font-medium mb-1.5">{t('Payment Date')}</label>
            <input
              id={dateInputId}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={format(new Date(), 'yyyy-MM-dd')}
              className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
            />
          </div>

          {/* Note */}
          <div>
            <label htmlFor={noteInputId} className="block text-sm font-medium mb-1.5">{t('Note')} ({t('Optional')})</label>
            <input
              id={noteInputId}
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('e.g. Cash, Transfer')}
              className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
            />
          </div>

          {/* Create Transaction Toggle */}
          {debt.walletId && (
            <label className="flex items-center gap-3 p-3 bg-[var(--bg)] rounded-xl cursor-pointer">
              <input
                type="checkbox"
                className="sr-only"
                checked={createTransaction}
                onChange={(event) => setCreateTransaction(event.target.checked)}
              />
              <div className={cn(
                "w-10 h-6 rounded-full transition-colors relative",
                createTransaction ? "bg-[var(--accent)]" : "bg-[var(--border)]"
              )}>
                <div className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                  createTransaction ? "left-5" : "left-1"
                )} />
              </div>
              <div className="flex items-center gap-2">
                <Wallet size={16} className="text-[var(--text-secondary)]" />
                <span className="text-sm">{t('Record as transaction')}</span>
              </div>
            </label>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className={cn(
              "w-full py-3 rounded-xl font-bold text-white transition-all active:scale-[0.98]",
              isPayable
                ? "bg-orange-500 hover:bg-orange-600"
                : "bg-green-500 hover:bg-green-600"
            )}
          >
            {t('Save Payment')}
          </button>
        </form>
      </div>
    </BottomSheetShell>
  );
}
