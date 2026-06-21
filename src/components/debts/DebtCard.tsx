import { useTranslation } from 'react-i18next';
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { differenceInCalendarDays, format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { type Debt, type DebtPayment, type Wallet } from '../../db/db';
import { calculateDebtStatus, isDebtClosed } from '../../services/debtService';
import { cn } from '../../utils/cn';
import { formatCurrency } from '../../utils/formatUtils';
import { getTodayStr, parseDate } from '../../utils/dateUtils';

interface DebtCardProps {
  debt: Debt;
  payments: readonly DebtPayment[];
  wallet?: Wallet;
  hideAmount?: boolean;
  onClick: () => void;
  onPayment: () => void;
}

function getDueLabel(debt: Debt, t: (key: string, options?: Record<string, string | number>) => string): string {
  if (!debt.dueDate) return t('No due date label');

  const today = parseDate(getTodayStr());
  const dueDate = parseDate(debt.dueDate);
  const diff = differenceInCalendarDays(dueDate, today);

  if (diff < 0) return t('Overdue days', { days: Math.abs(diff) });
  if (diff === 0) return t('Due today');
  if (diff === 1) return t('Due tomorrow');
  if (diff <= 7) return t('Due in days', { days: diff });
  return format(dueDate, 'dd MMM', { locale: localeId });
}

export function DebtCard({ debt, payments, wallet, hideAmount = false, onClick, onPayment }: DebtCardProps) {
  const { t } = useTranslation();
  const status = calculateDebtStatus(debt, payments);
  const isPayable = debt.type === 'payable';
  const paidRatio = debt.principalAmount > 0
    ? Math.min(100, Math.max(0, ((debt.principalAmount - debt.remainingAmount) / debt.principalAmount) * 100))
    : 0;
  const closed = isDebtClosed(status);

  const statusLabel = {
    open: t('Status Active'),
    partial: t('Status Partial'),
    paid: t('Status Paid'),
    overdue: t('Status Overdue'),
    written_off: t('Status Written Off'),
  }[status];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'w-full cursor-pointer rounded-[16px] border bg-[var(--card)] p-4 text-left shadow-sm transition-all active:scale-[0.98] hover:border-[var(--accent)]/40',
        status === 'overdue' ? 'border-red-500/30' : 'border-[var(--border)]',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            isPayable ? 'bg-amber-500/10 text-amber-500' : 'bg-[var(--accent)]/10 text-[var(--accent)]',
            status === 'overdue' && 'bg-red-500/10 text-red-500',
            closed && 'bg-green-500/10 text-green-500',
          )}
          aria-hidden="true"
        >
          {status === 'overdue' ? (
            <AlertTriangle size={18} />
          ) : closed ? (
            <CheckCircle2 size={18} />
          ) : isPayable ? (
            <ArrowDownLeft size={18} />
          ) : (
            <ArrowUpRight size={18} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[var(--text-primary)]">{debt.personName}</p>
              {debt.title && (
                <p className="truncate text-xs text-[var(--text-secondary)]">{debt.title}</p>
              )}
            </div>
            <div className="text-right">
              <p className={cn('font-mono text-sm font-bold', isPayable ? 'text-amber-500' : 'text-[var(--accent)]')}>
                {formatCurrency(debt.remainingAmount, hideAmount)}
              </p>
              <span className={cn(
                'mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                isPayable ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300' : 'bg-[var(--accent)]/10 text-[var(--accent)]',
              )}>
                {isPayable ? t('Payable') : t('Receivable')}
              </span>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-secondary)]">
            <span>{statusLabel}</span>
            <span aria-hidden="true">•</span>
            <span className={status === 'overdue' ? 'text-red-500' : undefined}>{getDueLabel(debt, t)}</span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-secondary)]">
            <span>{wallet?.name ?? t('Wallet not found')}</span>
            {!hideAmount && (
              <>
                <span aria-hidden="true">•</span>
                <span>{t('Part paid percent', { percent: paidRatio.toFixed(0) })}</span>
              </>
            )}
            {hideAmount && debt.remainingAmount < debt.principalAmount && (
              <>
                <span aria-hidden="true">•</span>
                <span>{t('Partially paid')}</span>
              </>
            )}
          </div>

          {!hideAmount && (
            <div className="mt-3 h-2 rounded-full bg-[var(--border)]" aria-label={t('Part paid percent', { percent: paidRatio.toFixed(0) })}>
              <div
                className={cn('h-full rounded-full', isPayable ? 'bg-amber-500' : 'bg-[var(--accent)]')}
                style={{ width: `${paidRatio}%` }}
              />
            </div>
          )}

          {!closed && (
            <div className="mt-4">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onPayment();
                }}
                onKeyDown={(event) => event.stopPropagation()}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-xs font-bold text-white shadow-lg shadow-[var(--accent)]/10"
              >
                <Clock size={14} className="mr-1.5" />
                {isPayable ? t('Pay debt') : t('Receive payment')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
