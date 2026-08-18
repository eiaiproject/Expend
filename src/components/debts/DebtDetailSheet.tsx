import { useTranslation } from 'react-i18next';
import { ArrowDownLeft, ArrowUpRight, Bell, BellOff, CheckCircle, Edit, Trash2 } from 'reicon-react';
import { type Debt, type DebtPayment, type Wallet } from '../../db/db';
import { archiveDebt, calculateDebtStatus, isDebtClosed, markDebtPaidWithoutCashflow, postponeDebtReminder, setDebtReminder, writeOffReceivable } from '../../services/debtService';
import { getDisplayDebtPaymentNote, getKnownErrorMessage } from '../../services/errors';
import { cn } from '../../utils/cn';
import { displayDateMedium, displayDateShort, getTodayStr } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/formatUtils';
import { BottomSheetShell } from '../BottomSheetShell';
import { confirm } from '../ConfirmDialog';
import { toast } from '../Toaster';

interface DebtDetailSheetProps {
  readonly debt: Debt | null;
  readonly payments: readonly DebtPayment[];
  readonly walletMap: Record<number, Wallet | undefined>;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onPayment: (debt: Debt) => void;
  readonly onEdit: (debt: Debt) => void;
  readonly hideAmount?: boolean;
}

function paymentCopy(debt: Debt, payment: DebtPayment, t: (key: string) => string): { label: string; sign: '+' | '-' | ''; className: string } {
  if (payment.type === 'initial') {
    return debt.type === 'payable'
      ? { label: t('debt.detailLoanReceived'), sign: '+', className: 'text-[var(--accent)]' }
      : { label: t('debt.detailLoanGiven'), sign: '-', className: 'text-[var(--warning)]' };
  }

  if (payment.type === 'repayment') {
    return debt.type === 'payable'
      ? { label: t('debt.detailPayment'), sign: '-', className: 'text-[var(--warning)]' }
      : { label: t('debt.detailReceived'), sign: '+', className: 'text-[var(--accent)]' };
  }

  if (payment.type === 'write_off') {
    return { label: t('debt.detailWrittenOff'), sign: '', className: 'text-[var(--text-secondary)]' };
  }

  return { label: t('debt.detailMarkedPaid'), sign: '', className: 'text-[var(--text-secondary)]' };
}

export function DebtDetailSheet({
  debt,
  payments,
  walletMap,
  isOpen,
  onClose,
  onPayment,
  onEdit,
  hideAmount = false,
}: DebtDetailSheetProps) {
  const { t, i18n } = useTranslation();

  if (!debt) return null;

  const isPayable = debt.type === 'payable';
  const status = calculateDebtStatus(debt, payments);
  const closed = isDebtClosed(status);
  const paidRatio = debt.principalAmount > 0
    ? Math.min(100, Math.max(0, ((debt.principalAmount - debt.remainingAmount) / debt.principalAmount) * 100))
    : 0;
  const sortedPayments = [...payments].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const title = isPayable ? t('Payable detail') : t('Receivable detail');

  const handleMarkPaid = async () => {
    const confirmed = await confirm({
      title: t('Mark as paid?'),
      message: hideAmount
        ? t('Mark paid desc', { type: isPayable ? t('Payable') : t('Receivable') })
        : t('Mark paid desc amount', { type: isPayable ? t('Payable') : t('Receivable') }),
      // Cashflow clarity (master.md 7.6): settling without recording cashflow
      // does not change any wallet balance.
      note: t('debt.cashflowNoChange'),
      confirmLabel: t('Status Paid'),
    });
    if (!confirmed) return;

    try {
      await markDebtPaidWithoutCashflow(debt.id);
      toast.add(t('debt.toastSettled'));
    } catch (error) {
      toast.add(getKnownErrorMessage(error, t, 'Action failed'));
    }
  };

  const handleWriteOff = async () => {
    const confirmed = await confirm({
      title: t('debt.writeOff'),
      message: hideAmount
        ? t('Write off desc')
        : t('Write off desc amount'),
      // Cashflow clarity (master.md 7.6): writing off never changes a wallet balance.
      note: t('debt.cashflowWriteOff'),
      confirmLabel: t('Write Off'),
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await writeOffReceivable(debt.id);
      toast.add(t('debt.toastWrittenOff'));
    } catch (error) {
      toast.add(getKnownErrorMessage(error, t, 'Action failed'));
    }
  };

  const handleReminderChange = async (daysBefore: number | null) => {
    try {
      await setDebtReminder(debt.id, daysBefore);
      toast.add(t('debt.reminderUpdated'));
    } catch (error) {
      toast.add(getKnownErrorMessage(error, t, 'Action failed'));
    }
  };

  const handlePostponeReminder = async () => {
    try {
      await postponeDebtReminder(debt.id);
      toast.add(t('debt.reminderPostponed'));
    } catch (error) {
      toast.add(getKnownErrorMessage(error, t, 'Action failed'));
    }
  };

  const handleArchive = async () => {
    const confirmed = await confirm({
      title: t('Delete debt?'),
      message: t('Delete debt desc'),
      confirmLabel: t('Delete'),
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await archiveDebt(debt.id);
      toast.add(isPayable ? t('Payable deleted') : t('Receivable deleted'));
      onClose();
    } catch (error) {
      toast.add(getKnownErrorMessage(error, t, 'Action failed'));
    }
  };

  return (
    <BottomSheetShell
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      ariaLabel={title}
      size="full"
    >
      <div className="px-4 py-4 space-y-4">
        {/* Debt info */}
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--bg)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-bold">{debt.personName}</p>
              <p className="text-sm text-[var(--text-secondary)]">{isPayable ? t('Payable') : t('Receivable')}</p>
              {debt.title && <p className="mt-2 text-sm">{debt.title}</p>}
            </div>
            <span className={cn(
              'rounded-full px-2.5 py-1 text-xs font-bold',
              status === 'overdue' ? 'bg-[var(--danger-bg)] text-[var(--danger)]' : 'bg-[var(--accent)]/10 text-[var(--accent)]',
            )}>
              {{
                open: t('debt.statusOpen'),
                partial: t('debt.statusPartialSettled'),
                paid: t('debt.statusPaidLabel'),
                overdue: t('debt.statusOverdueLabel'),
                written_off: t('debt.statusWrittenOffLabel'),
              }[status]}
            </span>
          </div>

          {/* Remaining amount */}
          <div className="mt-5">
            <p className="font-mono text-2xl font-bold">{formatCurrency(debt.remainingAmount, hideAmount)}</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {t('debt.detailOutstanding')} / {formatCurrency(debt.principalAmount, hideAmount)}
            </p>
          </div>

          {/* Progress bar */}
          {!hideAmount && (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-[var(--text-secondary)]">
                <span>{t('Part paid percent', { percent: paidRatio.toFixed(0) })}</span>
                <span>{walletMap[debt.walletId]?.name ?? t('Wallet not found')}</span>
              </div>
              <progress
                className="h-2 rounded-full [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-[var(--border)] [&::-webkit-progress-value]:rounded-full"
                value={paidRatio}
                max={100}
                aria-label={t('Part paid percent', { percent: paidRatio.toFixed(0) })}
                style={{ color: isPayable ? '#f59e0b' : 'var(--accent)' } as React.CSSProperties}
              />
            </div>
          )}

          {/* Dates */}
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">{t('Loan date')}</p>
              <p className="mt-1">{displayDateMedium(debt.startDate, i18n.language)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">{t('Due date')}</p>
              <p className="mt-1">{debt.dueDate ? displayDateMedium(debt.dueDate, i18n.language) : t('No due date label')}</p>
            </div>
          </div>

          {debt.notes && (
            <p className="mt-4 rounded-xl bg-[var(--card)] p-3 text-sm text-[var(--text-secondary)]">{debt.notes}</p>
          )}
        </div>

        {/* Primary action */}
        {!closed && (
          <button
            type="button"
            onClick={() => onPayment(debt)}
            className="w-full min-h-[48px] rounded-xl bg-[var(--accent-fill)] py-3 font-bold text-[var(--accent-ink)] shadow-lg shadow-[var(--accent-fill)]/20 active:scale-95"
          >
            {isPayable ? t('Pay debt') : t('Receive payment')}
          </button>
        )}

        {/* Reminder preferences (master.md 7.5) */}
        {!closed && (
          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--bg)] p-4">
            <fieldset>
              <legend className="mb-2 flex items-center gap-2 text-sm font-bold">
                {debt.reminderDaysBefore === null ? <BellOff size={15} className="text-[var(--text-secondary)]" aria-hidden="true" /> : <Bell size={15} className="text-[var(--accent)]" aria-hidden="true" />}
                {t('debt.reminderTitle')}
              </legend>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('debt.reminderTitle')}>
                {([
                  { value: 7, label: t('debt.reminder7') },
                  { value: 3, label: t('debt.reminder3') },
                  { value: 0, label: t('debt.reminderDueDate') },
                  { value: null, label: t('debt.reminderOff') },
                ] as Array<{ value: number | null; label: string }>).map((option) => {
                  const isSelected = option.value === null
                    ? debt.reminderDaysBefore === null
                    : (debt.reminderDaysBefore ?? 7) === option.value;
                  return (
                    <button
                      key={String(option.value)}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => handleReminderChange(option.value)}
                      className={cn(
                        'min-h-[44px] rounded-xl border px-2 py-2.5 text-xs font-bold transition-colors',
                        isSelected
                          ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                          : 'border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] hover:bg-[var(--bg)]',
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {debt.reminderPostponedUntil && debt.reminderPostponedUntil > getTodayStr() && (
                <p className="mt-2 text-xs text-[var(--text-secondary)]">
                  {t('debt.reminderPostponedUntil', { date: displayDateShort(debt.reminderPostponedUntil, i18n.language) })}
                </p>
              )}
              <button
                type="button"
                onClick={handlePostponeReminder}
                className="mt-2 w-full min-h-[44px] rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-xs font-bold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg)]"
              >
                {t('debt.postponeReminder')}
              </button>
            </fieldset>
          </div>
        )}

        {/* Secondary actions */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onEdit(debt)}
            className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-sm font-bold text-[var(--text-secondary)]"
          >
            <Edit size={15} /> {t('debt.editRecord')}
          </button>
          <button
            type="button"
            disabled={closed}
            onClick={handleMarkPaid}
            className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-sm font-bold text-[var(--text-secondary)] disabled:opacity-40"
          >
            <CheckCircle size={15} /> {t('debt.markSettled')}
          </button>
          <button
            type="button"
            onClick={handleArchive}
            className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-bg)] px-3 py-3 text-sm font-bold text-[var(--danger)]"
          >
            <Trash2 size={15} /> {t('Delete')}
          </button>
        </div>

        {/* Write off — only for open receivables */}
        {!isPayable && !closed && (
          <button
            type="button"
            onClick={handleWriteOff}
            className="w-full min-h-[44px] rounded-xl border border-amber-500/30 bg-amber-500/10 py-3 text-sm font-bold text-amber-600 dark:text-amber-300"
          >
            {t('debt.writeOff')}
          </button>
        )}

        {/* Payment history */}
        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">{t('debt.detailPaymentHistory')}</h3>
          {sortedPayments.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">{t('debt.detailNoPayments')}</p>
          ) : (
            <div className="space-y-3">
              {sortedPayments.map((payment) => {
                const copy = paymentCopy(debt, payment, t);
                return (
                  <div key={payment.id} className="flex items-start gap-3 rounded-[16px] border border-[var(--border)] bg-[var(--card)] p-3">
                    <div className={cn('mt-0.5 rounded-full p-2', isPayable ? 'bg-[var(--warning-bg)] text-[var(--warning)]' : 'bg-[var(--accent)]/10 text-[var(--accent)]')}>
                      {copy.sign === '-' ? <ArrowUpRight size={15} aria-hidden="true" /> : <ArrowDownLeft size={15} aria-hidden="true" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold">{displayDateShort(payment.date, i18n.language)} • {copy.label}</p>
                          <p className="mt-1 text-xs text-[var(--text-secondary)]">
                            {walletMap[payment.walletId]?.name ?? t('Wallet not found')}
                          </p>
                        </div>
                        <p className={cn('shrink-0 font-mono text-sm font-bold', copy.className)}>
                          {copy.sign}{formatCurrency(payment.amount, hideAmount)}
                        </p>
                      </div>
                      {payment.notes && (
                        <p className="mt-2 text-xs text-[var(--text-secondary)]">
                          {getDisplayDebtPaymentNote(payment.notes, t)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </BottomSheetShell>
  );
}
