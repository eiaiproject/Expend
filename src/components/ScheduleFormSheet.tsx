import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bell, CalendarDays, PauseCircle, PlayCircle } from 'reicon-react';
import { db, type Schedule, type ScheduleFrequency, type ScheduleMode, type Wallet } from '../db/db';
import { createSchedule, updateSchedule } from '../services/recurringService';
import { getKnownErrorMessage } from '../services/errors';
import { getTodayStr } from '../utils/dateUtils';
import { formatAmountInput, parseAmount } from '../utils/formatUtils';
import { cn } from '../utils/cn';
import { BottomSheetShell } from './BottomSheetShell';
import { CategorySelect } from './CategorySelect';
import { DatePicker } from './DatePicker';
import { toast } from './Toaster';
import { WalletSelect } from './WalletSelect';

interface ScheduleFormSheetProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly scheduleToEdit?: Schedule | null;
}

const FREQUENCIES: Array<{ value: ScheduleFrequency; labelKey: string }> = [
  { value: 'weekly', labelKey: 'recurring.freqWeekly' },
  { value: 'biweekly', labelKey: 'recurring.freqBiweekly' },
  { value: 'monthly', labelKey: 'recurring.freqMonthly' },
  { value: 'yearly', labelKey: 'recurring.freqYearly' },
];

const MODES: Array<{ value: ScheduleMode; labelKey: string; descKey: string }> = [
  { value: 'remind', labelKey: 'recurring.modeRemind', descKey: 'recurring.modeRemindDesc' },
  { value: 'create', labelKey: 'recurring.modeCreate', descKey: 'recurring.modeCreateDesc' },
];

const EMPTY_WALLETS: Wallet[] = [];

export function ScheduleFormSheet({ isOpen, onClose, scheduleToEdit = null }: ScheduleFormSheetProps) {
  const { t } = useTranslation();
  const formId = useId();
  const queriedWallets = useLiveQuery(() => db.wallets.toArray(), [], undefined);
  const queriedCategories = useLiveQuery(() => db.categories.toArray(), [], undefined);
  const wallets = useMemo(() => queriedWallets ?? EMPTY_WALLETS, [queriedWallets]);
  const categories = useMemo(() => queriedCategories ?? [], [queriedCategories]);

  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<ScheduleFrequency>('monthly');
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState('');
  const [noEndDate, setNoEndDate] = useState(true);
  const [categoryName, setCategoryName] = useState('');
  const [walletId, setWalletId] = useState('');
  const [mode, setMode] = useState<ScheduleMode>('remind');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (scheduleToEdit) {
      setPayee(scheduleToEdit.payee ?? '');
      setAmount(scheduleToEdit.amount.toLocaleString('id-ID'));
      setFrequency(scheduleToEdit.frequency);
      setStartDate(scheduleToEdit.startDate);
      setEndDate(scheduleToEdit.endDate ?? '');
      setNoEndDate(!scheduleToEdit.endDate);
      setCategoryName(scheduleToEdit.categoryId != null ? categories.find((c) => c.id === scheduleToEdit.categoryId)?.name ?? '' : '');
      setWalletId(String(scheduleToEdit.walletId));
      setMode(scheduleToEdit.mode);
      setNotes(scheduleToEdit.notes ?? '');
      return;
    }

    setPayee('');
    setAmount('');
    setFrequency('monthly');
    setStartDate(getTodayStr());
    setEndDate('');
    setNoEndDate(true);
    setCategoryName('');
    setWalletId(wallets[0]?.id != null ? String(wallets[0].id) : '');
    setMode('remind');
    setNotes('');
  }, [scheduleToEdit, isOpen, wallets, categories]);

  useEffect(() => {
    if (isOpen && !walletId && !scheduleToEdit && wallets[0]?.id != null) {
      setWalletId(String(wallets[0].id));
    }
  }, [isOpen, walletId, wallets, scheduleToEdit]);

  const selectedCategory = useMemo(
    () => categories.find((cat) => cat.name === categoryName) ?? null,
    [categories, categoryName],
  );

  const rawAmount = parseAmount(amount);
  const isEdit = !!scheduleToEdit;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSubmitting(true);
    try {
      const payload = {
        frequency,
        startDate,
        endDate: noEndDate ? null : endDate || null,
        amount: rawAmount,
        categoryId: selectedCategory?.id ?? null,
        walletId: Number(walletId),
        payee: payee.trim(),
        notes: notes.trim() || undefined,
        mode,
      };

      if (scheduleToEdit) {
        await updateSchedule(scheduleToEdit.id, payload);
        toast.add(t('recurring.toastUpdated'));
      } else {
        await createSchedule(payload);
        toast.add(t('recurring.toastCreated'));
      }

      onClose();
    } catch (error) {
      toast.add(getKnownErrorMessage(error, t, t('recurring.toastError')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = isEdit ? t('recurring.editTitle') : t('recurring.addTitle');

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
          disabled={isSubmitting || rawAmount <= 0 || !payee.trim()}
          className="w-full min-h-[48px] rounded-xl bg-[var(--accent)] py-3 font-bold text-white shadow-lg shadow-[var(--accent)]/20 transition-transform active:scale-95 disabled:opacity-50"
        >
          {isEdit ? t('Save Changes') : t('recurring.addCta')}
        </button>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="px-3 py-4 space-y-5">
        {/* Payee / description */}
        <div>
          <label htmlFor={`${formId}-payee`} className="block text-sm font-medium mb-1">
            {t('recurring.payee')} *
          </label>
          <input
            id={`${formId}-payee`}
            type="text"
            required
            value={payee}
            onChange={(event) => setPayee(event.target.value)}
            placeholder={t('recurring.payeePlaceholder')}
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

        {/* Frequency */}
        <fieldset>
          <legend className="text-sm font-medium text-[var(--text-primary)] mb-2">{t('recurring.frequency')}</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('recurring.frequency')}>
            {FREQUENCIES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={frequency === option.value}
                onClick={() => setFrequency(option.value)}
                className={cn(
                  'rounded-xl border px-3 py-3 text-sm font-bold transition-colors min-h-[48px]',
                  frequency === option.value
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] hover:bg-[var(--bg)]',
                )}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Mode */}
        <fieldset>
          <legend className="text-sm font-medium text-[var(--text-primary)] mb-2">{t('recurring.modeLabel')}</legend>
          <div className="space-y-2" role="radiogroup" aria-label={t('recurring.modeLabel')}>
            {MODES.map((option) => {
              const Icon = option.value === 'remind' ? Bell : PlayCircle;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={mode === option.value}
                  onClick={() => setMode(option.value)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors min-h-[56px]',
                    mode === option.value
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                      : 'border-[var(--border)] bg-[var(--card)] hover:bg-[var(--bg)]',
                  )}
                >
                  <Icon size={18} className={cn('mt-0.5 shrink-0', mode === option.value ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]')} aria-hidden="true" />
                  <span>
                    <span className={cn('block text-sm font-bold', mode === option.value ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]')}>
                      {t(option.labelKey)}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--text-secondary)]">{t(option.descKey)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Browser limitation note */}
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-300">
          <PauseCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{t('recurring.browserLimit')}</span>
        </div>

        {/* Wallet */}
        <div>
          <label htmlFor={`${formId}-wallet`} className="block text-sm font-medium mb-1">
            {t('Wallet')} *
          </label>
          <WalletSelect
            id={`${formId}-wallet`}
            value={walletId}
            wallets={wallets}
            placeholder={t('Select wallet')}
            onChange={setWalletId}
          />
        </div>

        {/* Category */}
        <div>
          <label htmlFor={`${formId}-category`} className="block text-sm font-medium mb-1">
            {t('Category')}
          </label>
          <CategorySelect
            id={`${formId}-category`}
            categories={categories}
            value={categoryName}
            onChange={setCategoryName}
          />
        </div>

        {/* Start date */}
        <DatePicker
          id={`${formId}-start-date`}
          value={startDate}
          onChange={setStartDate}
          label={t('recurring.startDate')}
          required
        />

        {/* End date */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
              <CalendarDays size={15} className="text-[var(--text-secondary)]" aria-hidden="true" />
              {t('recurring.endDate')}
            </span>
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={noEndDate}
                onChange={(event) => {
                  setNoEndDate(event.target.checked);
                  if (event.target.checked) setEndDate('');
                }}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              {t('recurring.noEndDate')}
            </label>
          </div>
          {!noEndDate && (
            <DatePicker
              id={`${formId}-end-date`}
              value={endDate}
              onChange={setEndDate}
            />
          )}
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
            className="min-h-20 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
          />
        </div>
      </form>
    </BottomSheetShell>
  );
}
