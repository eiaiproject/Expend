import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDownLeft, ArrowUpRight, Wallet as WalletIcon } from 'lucide-react';
import { db, type Debt, type DebtType, type Wallet } from '../../db/db';
import { createDebt, updateDebt } from '../../services/debtService';
import { getTodayStr } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/formatUtils';
import { cn } from '../../utils/cn';
import { BottomSheetShell } from '../BottomSheetShell';
import { DatePicker } from '../DatePicker';
import { toast } from '../Toaster';

interface DebtFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  hideAmount?: boolean;
  debtToEdit?: Debt | null;
}

const EMPTY_WALLETS: Wallet[] = [];

function parseAmount(value: string): number {
  return parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
}

function formatAmountInput(value: string): string {
  const raw = value.replace(/[^0-9]/g, '');
  return raw ? parseInt(raw, 10).toLocaleString('id-ID') : '';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Save debt failed';
}

export function DebtFormSheet({ isOpen, onClose, hideAmount = false, debtToEdit = null }: DebtFormSheetProps) {
  const { t } = useTranslation();
  const formId = useId();
  const queriedWallets = useLiveQuery(() => db.wallets.toArray(), [], undefined);
  const wallets = queriedWallets ?? EMPTY_WALLETS;
  const isEdit = !!debtToEdit;

  const [step, setStep] = useState<'type' | 'details'>('type');
  const [type, setType] = useState<DebtType>('payable');
  const [personName, setPersonName] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [walletId, setWalletId] = useState('');
  const [startDate, setStartDate] = useState(getTodayStr());
  const [dueDate, setDueDate] = useState('');
  const [noDueDate, setNoDueDate] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (debtToEdit) {
      setStep('details');
      setType(debtToEdit.type);
      setPersonName(debtToEdit.personName);
      setTitle(debtToEdit.title ?? '');
      setAmount(debtToEdit.principalAmount.toLocaleString('id-ID'));
      setWalletId(String(debtToEdit.walletId));
      setStartDate(debtToEdit.startDate);
      setDueDate(debtToEdit.dueDate ?? '');
      setNoDueDate(!debtToEdit.dueDate);
      setNotes(debtToEdit.notes ?? '');
      return;
    }

    setStep('type');
    setType('payable');
    setPersonName('');
    setTitle('');
    setAmount('');
    setWalletId(wallets[0]?.id != null ? String(wallets[0].id) : '');
    setStartDate(getTodayStr());
    setDueDate('');
    setNoDueDate(false);
    setNotes('');
  }, [debtToEdit, isOpen, wallets]);

  useEffect(() => {
    if (isOpen && !walletId && wallets[0]?.id != null) {
      setWalletId(String(wallets[0].id));
    }
  }, [isOpen, walletId, wallets]);

  const selectedWallet = useMemo(
    () => wallets.find((wallet) => wallet.id === Number(walletId)),
    [walletId, wallets],
  );

  const rawAmount = parseAmount(amount);
  const isPayable = type === 'payable';
  const titleText = isEdit
    ? (isPayable ? t('Edit Payable') : t('Edit Receivable'))
    : step === 'type'
      ? t('Record Payable')
      : isPayable
        ? t('I Owe')
        : t('I Lend');

  const impactText = isPayable
    ? t('wallet increases', { wallet: selectedWallet?.name ?? t('Wallet'), amount: formatCurrency(rawAmount, hideAmount) })
    : t('wallet decreases', { wallet: selectedWallet?.name ?? t('Wallet'), amount: formatCurrency(rawAmount, hideAmount) });

  const handleSelectType = (nextType: DebtType) => {
    setType(nextType);
    setStep('details');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSubmitting(true);
    try {
      const payload = {
        personName,
        title,
        principalAmount: rawAmount,
        walletId: Number(walletId),
        startDate,
        dueDate: noDueDate ? null : dueDate || null,
        notes,
      };

      if (debtToEdit) {
        await updateDebt(debtToEdit.id, payload);
        toast.add(t('Debt updated'));
      } else {
        await createDebt({ ...payload, type });
        toast.add(isPayable ? t('Debt recorded') : t('Receivable recorded'));
      }

      onClose();
    } catch (error) {
      toast.add(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheetShell
      isOpen={isOpen}
      onClose={onClose}
      title={titleText}
      ariaLabel={titleText}
      heightClass="h-[90vh]"
    >
      {step === 'type' && !isEdit ? (
        <div className="px-3 py-4 space-y-4">
          <p className="text-sm font-medium text-[var(--text-secondary)]">{t('What happened?')}</p>
          <button
            type="button"
            onClick={() => handleSelectType('payable')}
            className="w-full rounded-[16px] border border-[var(--border)] bg-[var(--bg)] p-4 text-left transition-colors hover:border-amber-500/60"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-500/10 p-2 text-amber-500">
                <ArrowDownLeft size={20} />
              </div>
              <div>
                <h3 className="font-bold">{t('I Owe Money')}</h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{t('I Owe Money Desc')}</p>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => handleSelectType('receivable')}
            className="w-full rounded-[16px] border border-[var(--border)] bg-[var(--bg)] p-4 text-left transition-colors hover:border-[var(--accent)]/60"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-[var(--accent)]/10 p-2 text-[var(--accent)]">
                <ArrowUpRight size={20} />
              </div>
              <div>
                <h3 className="font-bold">{t('I Lent Money')}</h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{t('I Lent Money Desc')}</p>
              </div>
            </div>
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="px-3 py-4 space-y-5">
          <div>
            <label htmlFor={`${formId}-person`} className="block text-sm font-medium mb-1">
              {isPayable ? t('From whom?') : t('To whom?')} *
            </label>
            <input
              id={`${formId}-person`}
              type="text"
              required
              value={personName}
              onChange={(event) => setPersonName(event.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 focus:outline-none focus:border-[var(--accent)]"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-title`} className="block text-sm font-medium mb-1">
              {t('Title')}
            </label>
            <input
              id={`${formId}-title`}
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 focus:outline-none focus:border-[var(--accent)]"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-amount`} className="block text-sm font-medium mb-1">
              {t('Amount')} *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-[var(--text-secondary)]">
                {t('Currency Symbol')}
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
          </div>

          <div>
            <label htmlFor={`${formId}-wallet`} className="block text-sm font-medium mb-1">
              {isPayable ? t('Money into wallet') : t('Money from wallet')} *
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
          </div>

          <DatePicker
            id={`${formId}-start-date`}
            value={startDate}
            onChange={setStartDate}
            label={t('Loan date')}
            required
          />

          <div className="space-y-2">
            <DatePicker
              id={`${formId}-due-date`}
              value={dueDate}
              onChange={(value) => {
                setDueDate(value);
                if (value) setNoDueDate(false);
              }}
              label={t('Due date')}
            />
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={noDueDate}
                onChange={(event) => {
                  setNoDueDate(event.target.checked);
                  if (event.target.checked) setDueDate('');
                }}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              {t('No due date')}
            </label>
          </div>

          <div>
            <label htmlFor={`${formId}-notes`} className="block text-sm font-medium mb-1">
              {t('Notes')}
            </label>
            <textarea
              id={`${formId}-notes`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-24 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--bg)] p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">{t('Balance impact')}</p>
            <p className={cn('mt-2 font-mono text-sm font-bold', isPayable ? 'text-[var(--accent)]' : 'text-amber-500')}>
              {impactText}
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {isPayable ? t('Payable active increases') : t('Receivable active increases')}
            </p>
          </div>

          <div className="pt-2 pb-6">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-[var(--accent)] py-4 font-bold text-white shadow-lg shadow-[var(--accent)]/20 transition-transform active:scale-95 disabled:opacity-50"
            >
              {isEdit ? t('Save Changes') : isPayable ? t('Save Payable') : t('Save Receivable')}
            </button>
          </div>
        </form>
      )}
    </BottomSheetShell>
  );
}
