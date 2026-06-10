import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Wallet as WalletIcon } from 'lucide-react';
import { db, type Debt } from '../../db/db';
import { recordDebtPayment } from '../../services/debtService';
import { getTodayStr } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/formatUtils';
import { BottomSheetShell } from '../BottomSheetShell';
import { DatePicker } from '../DatePicker';
import { toast } from '../Toaster';

interface DebtPaymentSheetProps {
  debt: Debt | null;
  isOpen: boolean;
  onClose: () => void;
  hideAmount?: boolean;
}

function parseAmount(value: string): number {
  return parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
}

function formatAmountInput(value: string): string {
  const raw = value.replace(/[^0-9]/g, '');
  return raw ? parseInt(raw, 10).toLocaleString('id-ID') : '';
}

function getErrorMessage(error: unknown, t: (key: string) => string): string {
  return error instanceof Error ? error.message : t('Save payment failed');
}

export function DebtPaymentSheet({ debt, isOpen, onClose, hideAmount = false }: DebtPaymentSheetProps) {
  const { t } = useTranslation();
  const formId = useId();
  const wallets = useLiveQuery(() => db.wallets.toArray(), [], []) ?? [];
  const [amount, setAmount] = useState('');
  const [walletId, setWalletId] = useState('');
  const [date, setDate] = useState(getTodayStr());
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !debt) return;
    setAmount('');
    setWalletId(String(debt.walletId));
    setDate(getTodayStr());
    setNotes('');
  }, [debt, isOpen]);

  const selectedWallet = useMemo(
    () => wallets.find((wallet) => wallet.id === Number(walletId)),
    [walletId, wallets],
  );

  if (!debt) return null;

  const isPayable = debt.type === 'payable';
  const rawAmount = parseAmount(amount);
  const walletBalance = selectedWallet ? (selectedWallet.currentBalance ?? selectedWallet.initialBalance) : 0;
  const showBalanceWarning = isPayable && rawAmount > walletBalance;
  const title = isPayable ? t('Pay debt') : t('Receive payment');

  const setQuickAmount = (ratio: number) => {
    const nextAmount = Math.max(1, Math.round(debt.remainingAmount * ratio));
    setAmount(Math.min(nextAmount, debt.remainingAmount).toLocaleString('id-ID'));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSubmitting(true);
    try {
      await recordDebtPayment({
        debtId: debt.id,
        amount: rawAmount,
        walletId: Number(walletId),
        date,
        notes,
      });
      toast.add(t('Payment recorded'));
      onClose();
    } catch (error) {
      toast.add(getErrorMessage(error, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheetShell
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      ariaLabel={title}
      heightClass="h-[82vh]"
    >
      <form onSubmit={handleSubmit} className="px-3 py-4 space-y-5">
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--bg)] p-4">
          <p className="font-bold">{debt.personName}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {isPayable ? t('Remaining payable') : t('Remaining receivable')}: <span className="font-mono font-bold">{formatCurrency(debt.remainingAmount, hideAmount)}</span>
          </p>
        </div>

        <div>
          <label htmlFor={`${formId}-amount`} className="block text-sm font-medium mb-1">
            {t('Payment amount')} *
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-[var(--text-secondary)]">
              Rp
            </span>
            <input
              id={`${formId}-amount`}
              type="text"
              inputMode="numeric"
              required
              value={amount}
              onChange={(event) => setAmount(formatAmountInput(event.target.value))}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] py-3 pl-12 pr-4 font-mono text-xl font-bold focus:outline-none focus:border-[var(--accent)]"
              placeholder="0"
            />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[
              { label: '25%', ratio: 0.25 },
              { label: '50%', ratio: 0.5 },
              { label: '75%', ratio: 0.75 },
              { label: t('Pay in full'), ratio: 1 },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => setQuickAmount(option.ratio)}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-2 text-xs font-bold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor={`${formId}-wallet`} className="block text-sm font-medium mb-1">
            {isPayable ? 'Keluar dari wallet' : 'Masuk ke wallet'} *
          </label>
          <div className="relative">
            <WalletIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} />
            <select
              id={`${formId}-wallet`}
              required
              value={walletId}
              onChange={(event) => setWalletId(event.target.value)}
              className="w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--bg)] py-3 pl-12 pr-10 focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="" disabled>{t('Select wallet')}</option>
              {wallets.map((wallet) => (
                <option key={wallet.id} value={wallet.id}>{wallet.name}</option>
              ))}
            </select>
          </div>
          {showBalanceWarning && (
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-300">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{t('Wallet balance low')}</span>
            </div>
          )}
        </div>

        <DatePicker
          id={`${formId}-date`}
          value={date}
          onChange={setDate}
          label={t('Date')}
          required
        />

        <div>
          <label htmlFor={`${formId}-notes`} className="block text-sm font-medium mb-1">
            {t('Notes')}
          </label>
          <input
            id={`${formId}-notes`}
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="pt-2 pb-6">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-[var(--accent)] py-4 font-bold text-white shadow-lg shadow-[var(--accent)]/20 transition-transform active:scale-95 disabled:opacity-50"
          >
            {title}
          </button>
        </div>
      </form>
    </BottomSheetShell>
  );
}
