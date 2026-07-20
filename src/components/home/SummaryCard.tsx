import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowDownCircle, TrendUp, TrendDown, ChartBar } from 'reicon-react';
import { cn } from '../../utils/cn';
import { formatCurrency, formatBalance } from '../../utils/formatUtils';
import { Skeleton } from '../Skeleton';
import type { SpendingInsight } from '../../services/budgetService';

interface SummaryCardProps {
  isLoading: boolean;
  walletsTotal: number;
  totalExpense: number;
  expensePeriod: 'month' | 'all';
  onToggleExpensePeriod: () => void;
  dailySummary: { today: number; yesterday: number };
  smartInsight: SpendingInsight | null;
  hideAmount: boolean;
}

export function SummaryCard({
  isLoading,
  walletsTotal,
  totalExpense,
  expensePeriod,
  onToggleExpensePeriod,
  dailySummary,
  smartInsight,
  hideAmount,
}: SummaryCardProps) {
  const { t, i18n } = useTranslation();

  const renderAmount = (amount: number) => formatCurrency(amount, hideAmount);
  const renderBalance = (amount: number) => formatBalance(amount, hideAmount);

  const periodLabel = expensePeriod === 'month' ? t('home.periodThisMonth') : t('home.periodAllTime');

  return (
    <div className="space-y-4">
      {/* Balance Card */}
      <div className="bg-[var(--accent-fill)] rounded-[16px] p-6 text-[var(--accent-ink)] shadow-lg">
        <p className="text-[var(--accent-ink)]/70 text-sm font-medium">{t('home.totalBalance')}</p>
        {isLoading ? (
          <Skeleton className="h-9 w-40 bg-[var(--accent-ink)]/20 mt-1" />
        ) : (
          <p className="text-[28px] font-bold font-mono mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {renderBalance(walletsTotal)}
          </p>
        )}
        <p className="text-[var(--accent-ink)]/60 text-xs mt-1">{t('home.fromAllWallets')}</p>
      </div>

      {/* Expense Summary */}
      <div className="bg-[var(--card)] rounded-[16px] p-4 border border-[var(--border)]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-[var(--text-secondary)] font-medium">{t('home.monthlyExpenses')}</p>
          <button
            type="button"
            onClick={onToggleExpensePeriod}
            className="text-[10px] text-[var(--accent)] font-bold px-2 py-0.5 rounded-full bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 transition-colors"
            aria-label={`${t('home.expensePeriodLabel')}: ${periodLabel}`}
          >
            {periodLabel}
          </button>
        </div>
        {isLoading ? (
          <Skeleton className="h-6 w-32 mt-1" />
        ) : (
          <div className="flex items-center gap-2">
            <ArrowDownCircle size={16} className="text-[var(--expense)] shrink-0" aria-hidden="true" />
            <p className="font-mono font-bold text-lg" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {renderAmount(totalExpense)}
            </p>
          </div>
        )}
      </div>

      {/* Daily Comparison — compact */}
      {!isLoading && (dailySummary.today > 0 || dailySummary.yesterday > 0) && (
        <div className="bg-[var(--card)] rounded-[16px] p-4 border border-[var(--border)]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)]">{t('Today')}</span>
            <span className="font-mono font-semibold text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {renderAmount(dailySummary.today)}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-[var(--text-secondary)]">{t('Yesterday')}</span>
            <span className="font-mono font-semibold text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {renderAmount(dailySummary.yesterday)}
            </span>
          </div>
        </div>
      )}

      {/* Insight — no pulse animation */}
      {!isLoading && smartInsight && (
        <div className={cn(
          "px-4 py-3 rounded-[16px] bg-[var(--card)] border border-[var(--border)] text-sm flex items-center gap-3",
          smartInsight.type === 'warning' && "border-amber-500/30",
          smartInsight.type === 'success' && "border-green-500/30",
        )}>
          {smartInsight.type === 'warning' ? (
            <TrendUp size={16} className="text-amber-500 shrink-0" aria-hidden="true" />
          ) : smartInsight.type === 'success' ? (
            <TrendDown size={16} className="text-green-500 shrink-0" aria-hidden="true" />
          ) : (
            <ChartBar size={16} className="text-[var(--accent)] shrink-0" aria-hidden="true" />
          )}
          <span className="text-[var(--text-secondary)]">{smartInsight.text}</span>
        </div>
      )}

      {/* View Stats Link */}
      {!isLoading && (
        <Link
          to="/stats"
          className="flex items-center justify-center gap-2 py-3 rounded-[16px] bg-[var(--card)] border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition-colors"
        >
          <ChartBar size={16} aria-hidden="true" />
          {t('home.viewStats')}
        </Link>
      )}
    </div>
  );
}

