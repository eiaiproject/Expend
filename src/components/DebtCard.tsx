import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { cn } from '../utils/cn';
import { formatCurrencyIntl } from '../utils/formatUtils';
import { Debt } from '../db/db';
import { HandCoins, ArrowUpRight, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

interface DebtCardProps {
  debt: Debt;
  onClick?: () => void;
}

export function DebtCard({ debt, onClick }: DebtCardProps) {
  const { t } = useTranslation();

  const isPayable = debt.type === 'payable';
  const paidPercentage = debt.amount > 0 ? ((debt.amount - debt.remainingAmount) / debt.amount) * 100 : 0;

  const statusConfig = {
    pending: { label: t('Pending'), color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    partial: { label: t('Partial'), color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    settled: { label: t('Settled'), color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    overdue: { label: t('Overdue'), color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  };

  const statusInfo = statusConfig[debt.status];
  const isOverdue = debt.status === 'overdue';

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left bg-[var(--card)] p-4 rounded-[16px] border transition-all",
        "hover:shadow-md active:scale-[0.98]",
        isOverdue
          ? "border-red-300 dark:border-red-700"
          : "border-[var(--border)] hover:border-[var(--accent)]/30"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
          isPayable
            ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
            : "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
        )}>
          {isPayable ? <ArrowUpRight size={20} /> : <HandCoins size={20} />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-[15px] truncate">{debt.contactName}</p>
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0", statusInfo.color)}>
              {statusInfo.label}
            </span>
          </div>

          <p className="text-sm text-[var(--text-secondary)] truncate mt-0.5">{debt.description}</p>

          {/* Progress Bar */}
          <div className="mt-3">
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-[var(--text-secondary)]">
                {formatCurrencyIntl(debt.amount - debt.remainingAmount)} / {formatCurrencyIntl(debt.amount)}
              </span>
              <span className="font-medium">{paidPercentage.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  isPayable ? "bg-orange-500" : "bg-green-500"
                )}
                style={{ width: `${paidPercentage}%` }}
              />
            </div>
          </div>

          {/* Due Date */}
          {debt.dueDate && (
            <div className={cn(
              "flex items-center gap-1 mt-2 text-[11px]",
              isOverdue ? "text-red-600 dark:text-red-400 font-medium" : "text-[var(--text-secondary)]"
            )}>
              {isOverdue ? <AlertTriangle size={12} /> : <Clock size={12} />}
              <span>
                {isOverdue ? t('Overdue') : t('Due')}: {format(parseISO(debt.dueDate), 'dd MMM yyyy')}
              </span>
            </div>
          )}

          {/* Settled indicator */}
          {debt.status === 'settled' && (
            <div className="flex items-center gap-1 mt-2 text-[11px] text-green-600 dark:text-green-400">
              <CheckCircle2 size={12} />
              <span>{t('Fully Paid')}</span>
            </div>
          )}
        </div>

        {/* Amount */}
        <div className="text-right shrink-0">
          <p className={cn(
            "font-mono font-bold text-[15px]",
            isPayable ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"
          )}>
            {isPayable ? '-' : '+'} {formatCurrencyIntl(debt.remainingAmount)}
          </p>
          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{t('Remaining')}</p>
        </div>
      </div>
    </button>
  );
}
