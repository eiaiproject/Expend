import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Wallet, Ban } from 'reicon-react';
import { db, type Debt, type DebtType, type Wallet as WalletType } from '../../db/db';
import { createDebt, updateDebt } from '../../services/debtService';
import { getKnownErrorMessage, INSUFFICIENT_WALLET_BALANCE_MESSAGE } from '../../services/errors';
import { getTodayStr } from '../../utils/dateUtils';
import { formatCurrency, parseAmount, formatAmountInput } from '../../utils/formatUtils';
import { cn } from '../../utils/cn';
import { BottomSheetShell } from '../BottomSheetShell';
import { DatePicker } from '../DatePicker';
import { toast } from '../Toaster';
import { WalletSelect } from '../WalletSelect';

interface DebtFormSheetProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly hideAmount?: boolean;
  readonly debtToEdit?: Debt | null;
}

const EMPTY_WALLETS: WalletType[] = [];
const EMPTY_DEBTS: Debt[] = [];

export function DebtFormSheet({ isOpen, onClose, hideAmount = false, debtToEdit = null }: DebtFormSheetProps) {
  const { t } = useTranslation();
  const formId = useId();
  const queriedWallets = useLiveQuery(() => db.wallets.toArray(), [], undefined);
  const queriedDebts = useLiveQuery(() => db.debts.toArray(), [], undefined);
  const wallets = queriedWallets ?? EMPTY_WALLETS;
  const debts = queriedDebts ?? EMPTY_DEBTS;
  const isEdit = !!debtToEdit;

  const [step, setStep] = useState<'type' | 'details'>('type');
  const [type, setType] = useState<DebtType>('payable');
  const [personName, setPersonName] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [walletId, setWalletId] = useState('');
  const [hasWalletMovement, setHasWalletMovement] = useState(true);
  const [startDate, setStartDate] = useState(getTodayStr());
  const [dueDate, setDueDate] = useState('');
  const [noDueDate, setNoDueDate] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPersonSuggestions, setShowPersonSuggestions] = useState(false);
  const personInputRef = useRef<HTMLInputElement>(null);
  const suggestionIndexRef = useRef(-1);

  useEffect(() => {
    if (!isOpen) return;

    if (debtToEdit) {
      setStep('details');
      setType(debtToEdit.type);
      setPersonName(debtToEdit.personName);
      setTitle(debtToEdit.title ?? '');
      setAmount(debtToEdit.principalAmount.toLocaleString('id-ID'));
      setWalletId(String(debtToEdit.walletId));
      setHasWalletMovement(true);
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
    setHasWalletMovement(true);
    setStartDate(getTodayStr());
    setDueDate('');
    setNoDueDate(false);
    setNotes('');
  }, [debtToEdit, isOpen, wallets]);

  useEffect(() => {
    if (isOpen && !walletId && !debtToEdit && wallets[0]?.id != null) {
      setWalletId(String(wallets[0].id));
    }
  }, [isOpen, walletId, wallets, debtToEdit]);

  const selectedWallet = useMemo(
    () => wallets.find((wallet) => wallet.id === Number(walletId)),
    [walletId, wallets],
  );

  const personSuggestions = useMemo(() => {
    const query = personName.toLowerCase().trim();
    const allNames = Array.from(new Set(debts.map(d => d.personName)));
    return (
      query
        ? allNames.filter(name => name.toLowerCase().includes(query))
        : allNames
    ).slice(0, 10);
  }, [personName, debts]);

  const rawAmount = parseAmount(amount);
  const isPayable = type === 'payable';
  const walletBalance = selectedWallet ? (selectedWallet.currentBalance ?? selectedWallet.initialBalance) : 0;
  const hasInsufficientBalance = isEdit && !isPayable && rawAmount > 0 && selectedWallet != null && rawAmount > walletBalance;

  const titleText = (() => {
    if (isEdit) return isPayable ? t('Edit Payable') : t('Edit Receivable');
    if (step === 'type') return t('debt.formWhat');
    return isPayable ? t('I Owe') : t('I Lend');
  })();

  const impactText = (() => {
    if (!hasWalletMovement) return t('debt.formNoImpact');
    return isPayable
      ? t('wallet increases', { wallet: selectedWallet?.name ?? t('Wallet'), amount: formatCurrency(rawAmount, hideAmount) })
      : t('wallet decreases', { wallet: selectedWallet?.name ?? t('Wallet'), amount: formatCurrency(rawAmount, hideAmount) });
  })();

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
        walletId: hasWalletMovement ? Number(walletId) : (wallets[0]?.id ?? 1),
        startDate,
        dueDate: noDueDate ? null : dueDate || null,
        notes,
      };

      if (debtToEdit) {
        await updateDebt(debtToEdit.id, payload);
        toast.add(t('Debt updated'));
      } else {
        await createDebt({ ...payload, type });
        toast.add(isPayable ? t('debt.toastDebtRecorded') : t('debt.toastReceivableRecorded'));
      }

      onClose();
    } catch (error) {
      toast.add(getKnownErrorMessage(error, t, 'Save debt failed'));
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
          <p className="text-sm font-medium text-[var(--text-secondary)]">{t('debt.formWhat')}</p>
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
                <h3 className="font-bold">{t('debt.formIOwe')}</h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{t('debt.formIOweDesc')}</p>
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
                <h3 className="font-bold">{t('debt.formOwedToMe')}</h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{t('debt.formOwedToMeDesc')}</p>
              </div>
            </div>
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="px-3 py-4 space-y-5">
          {/* Person */}
          <div className="relative">
            <label htmlFor={`${formId}-person`} className="block text-sm font-medium mb-1">
              {t('debt.formPerson')} *
            </label>
            <input
              ref={personInputRef}
              id={`${formId}-person`}
              type="text"
              required
              value={personName}
              onChange={(event) => {
                setPersonName(event.target.value);
                setShowPersonSuggestions(true);
              }}
              onFocus={() => setShowPersonSuggestions(true)}
              onBlur={() => setTimeout(() => setShowPersonSuggestions(false), 150)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (!showPersonSuggestions || personSuggestions.length === 0) return;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  suggestionIndexRef.current = Math.min(suggestionIndexRef.current + 1, personSuggestions.length - 1);
                  setPersonName(personSuggestions[suggestionIndexRef.current]!);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  suggestionIndexRef.current = Math.max(suggestionIndexRef.current - 1, 0);
                  setPersonName(personSuggestions[suggestionIndexRef.current]!);
                } else if (e.key === 'Enter' && suggestionIndexRef.current >= 0) {
                  e.preventDefault();
                  setPersonName(personSuggestions[suggestionIndexRef.current]!);
                  setShowPersonSuggestions(false);
                }
              }}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
              autoComplete="off"
            />
            {showPersonSuggestions && personSuggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] py-1 shadow-lg max-h-48 overflow-auto">
                {personSuggestions.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      onMouseDown={() => {
                        setPersonName(name);
                        setShowPersonSuggestions(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--bg)] transition-colors"
                    >
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Title */}
          <div>
            <label htmlFor={`${formId}-title`} className="block text-sm font-medium mb-1">
              {t('Title')}
            </label>
            <input
              id={`${formId}-title`}
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
              autoComplete="off"
            />
          </div>

          {/* Amount */}
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
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] py-3 pl-12 pr-4 font-mono text-xl font-bold focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
                placeholder="0"
              />
            </div>
          </div>

          {/* Wallet movement */}
          <div>
            <p className="block text-sm font-medium mb-2">
              {isPayable ? t('debt.formFundsReceived') : t('debt.formFundsProvided')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setHasWalletMovement(true)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold transition-colors',
                  hasWalletMovement
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)]',
                )}
                aria-pressed={hasWalletMovement}
              >
                <Wallet size={16} />
                {t('debt.formYesWallet')}
              </button>
              <button
                type="button"
                onClick={() => setHasWalletMovement(false)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold transition-colors',
                  !hasWalletMovement
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)]',
                )}
                aria-pressed={!hasWalletMovement}
              >
                <Ban size={16} />
                {t('debt.formNoWallet')}
              </button>
            </div>
          </div>

          {/* Wallet select — only when wallet movement */}
          {hasWalletMovement && (
            <div>
              <label htmlFor={`${formId}-wallet`} className="block text-sm font-medium mb-1">
                {isPayable ? t('Money into wallet') : t('Money from wallet')} *
              </label>
              <WalletSelect
                id={`${formId}-wallet`}
                value={walletId}
                wallets={wallets}
                placeholder={t('Select wallet')}
                onChange={setWalletId}
              />
              {hasInsufficientBalance && (
                <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-300">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>{t(INSUFFICIENT_WALLET_BALANCE_MESSAGE)}</span>
                </div>
              )}
            </div>
          )}

          {/* Dates */}
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

          {/* Notes */}
          <div>
            <label htmlFor={`${formId}-notes`} className="block text-sm font-medium mb-1">
              {t('Notes')}
            </label>
            <textarea
              id={`${formId}-notes`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-24 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
            />
          </div>

          {/* Balance impact */}
          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--bg)] p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">{t('debt.formBalanceImpact')}</p>
            <p className={cn('mt-2 font-mono text-sm font-bold', !hasWalletMovement ? 'text-[var(--text-secondary)]' : isPayable ? 'text-[var(--accent)]' : 'text-amber-500')}>
              {/* NOSONAR (S3358) — simple color ternary, extract would harm readability */}
              {impactText}
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {(() => {
                if (!hasWalletMovement) return t('debt.formNoImpact');
                return isPayable ? t('Payable active increases') : t('Receivable active increases');
              })()}
            </p>
          </div>

          {/* Submit */}
          <div className="pt-2 pb-6">
            <button
              type="submit"
              disabled={isSubmitting || hasInsufficientBalance}
              className="w-full min-h-[48px] rounded-xl bg-[var(--accent)] py-3 font-bold text-white shadow-lg shadow-[var(--accent)]/20 transition-transform active:scale-95 disabled:opacity-50"
            >
              {(() => {
                if (isEdit) return t('Save Changes');
                return isPayable ? t('Save Payable') : t('Save Receivable');
              })()}
            </button>
          </div>
        </form>
      )}
    </BottomSheetShell>
  );
}
