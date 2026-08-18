import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle } from 'reicon-react';
import { db, type Debt, type Wallet } from '../../db/db';
import { recordDebtPayment } from '../../services/debtService';
import { getKnownErrorMessage, INSUFFICIENT_WALLET_BALANCE_MESSAGE } from '../../services/errors';
import { getTodayStr } from '../../utils/dateUtils';
import { formatCurrency, parseAmount } from '../../utils/formatUtils';
import { AmountInput } from '../AmountInput';
import { cn } from '../../utils/cn';
import { BottomSheetShell } from '../BottomSheetShell';
import { DatePicker } from '../DatePicker';
import { toast } from '../Toaster';
import { WalletSelect } from '../WalletSelect';

interface DebtPaymentSheetProps {
  readonly debt: Debt | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly hideAmount?: boolean;
}

const EMPTY_WALLETS: Wallet[] = [];

export function DebtPaymentSheet({ debt, isOpen, onClose, hideAmount = false }: DebtPaymentSheetProps) {
  const { t } = useTranslation();
  const formId = useId();
  const queriedWallets = useLiveQuery(() => db.wallets.toArray(), [], undefined);
  const wallets = queriedWallets ?? EMPTY_WALLETS;
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
  const hasInsufficientBalance = isPayable && rawAmount > 0 && selectedWallet != null && rawAmount > walletBalance;
  const remainingAfterPayment = Math.max(0, debt.remainingAmount - rawAmount);
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
      toast.add(t('debt.toastPaymentRecorded'));
      onClose();
    } catch (error) {
      toast.add(getKnownErrorMessage(error, t, 'Save payment failed'));
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
      size="full"
      footer={
        <button
          type="submit"
          form={formId}
          disabled={isSubmitting || hasInsufficientBalance || rawAmount <= 0}
          className="w-full min-h-[48px] rounded-xl bg-[var(--accent-fill)] py-3 font-bold text-[var(--accent-ink)] shadow-lg shadow-[var(--accent-fill)]/20 transition-transform active:scale-95 disabled:opacity-50"
        >
          {title}
        </button>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
        {/* Debt info */}
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--bg)] p-4">
          <p className="font-bold">{debt.personName}</p>
          {debt.title && <p className="text-xs text-[var(--text-secondary)]">{debt.title}</p>}
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {t('debt.payCurrentOutstanding')}: <span className="font-mono font-bold">{formatCurrency(debt.remainingAmount, hideAmount)}</span>
          </p>
        </div>

        {/* Amount */}
        <div>
          <AmountInput
            id={`${formId}-amount`}
            value={amount}
            onChange={setAmount}
            label={t('debt.payPayment')}
            required
          />
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
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-2 min-h-[44px] text-xs font-bold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Payment preview */}
        {rawAmount > 0 && (
          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--bg)] p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-secondary)]">{t('debt.payCurrentOutstanding')}</span>
              <span className="font-mono font-bold">{formatCurrency(debt.remainingAmount, hideAmount)}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-[var(--text-secondary)]">{t('debt.payPayment')}</span>
              <span className="font-mono font-bold text-[var(--warning)]">-{formatCurrency(rawAmount, hideAmount)}</span>
            </div>
            <div className="border-t border-[var(--border)] mt-2 pt-2 flex items-center justify-between text-sm font-bold">
              <span>{t('debt.payRemaining')}</span>
              <span className={cn('font-mono', remainingAfterPayment === 0 ? 'text-[var(--success)]' : 'text-[var(--text-primary)]')}>
                {formatCurrency(remainingAfterPayment, hideAmount)}
              </span>
            </div>
          </div>
        )}

        {/* Wallet */}
        <div>
          <label htmlFor={`${formId}-wallet`} className="block text-sm font-medium mb-1.5">
            {isPayable ? t('debt.payFromWallet') : t('debt.payToWallet')} *
          </label>
          <WalletSelect
            id={`${formId}-wallet`}
            value={walletId}
            wallets={wallets}
            placeholder={t('Select wallet')}
            onChange={setWalletId}
          />
          {hasInsufficientBalance && (
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-[var(--warning)]/20 bg-[var(--warning-bg)] p-3 text-xs text-[var(--warning)]">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{t(INSUFFICIENT_WALLET_BALANCE_MESSAGE)}</span>
            </div>
          )}
          {selectedWallet && rawAmount > 0 && !hasInsufficientBalance && (
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              {t('debt.payWalletImpact')}: <span className="font-mono font-bold">
                {isPayable ? '-' : '+'}{formatCurrency(rawAmount, hideAmount)}
              </span>
            </p>
          )}
        </div>

        {/* Date */}
        <DatePicker
          id={`${formId}-date`}
          value={date}
          onChange={setDate}
          label={t('Date')}
          required
        />

        {/* Notes */}
        <div>
          <label htmlFor={`${formId}-notes`} className="block text-sm font-medium mb-1.5">
            {t('Notes')}
          </label>
          <input
            id={`${formId}-notes`}
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
          />
        </div>
      </form>
    </BottomSheetShell>
  );
}
