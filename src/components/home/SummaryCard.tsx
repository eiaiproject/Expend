import { useTranslation } from 'react-i18next';
import { ArrowDownCircle } from 'lucide-react';
import { motion } from 'motion/react';
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
  const { t } = useTranslation();

  const renderAmount = (amount: number) => formatCurrency(amount, hideAmount);
  const renderBalance = (amount: number) => formatBalance(amount, hideAmount);

  const yesterdayDiff = dailySummary.today > 0 && dailySummary.yesterday > 0
    ? ((dailySummary.today - dailySummary.yesterday) / dailySummary.yesterday) * 100
    : null;

  return (
    <div className="bg-[var(--accent)] rounded-[16px] p-6 text-[var(--accent-on-dark)] shadow-lg space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[var(--accent-on-dark)] text-sm font-medium">{t('Balance')}</p>
          {isLoading ? (
            <Skeleton className="h-9 w-40 bg-[var(--accent-on-dark)]/20 mt-1" />
          ) : (
            <p className="text-[28px] font-bold font-mono">
              {renderBalance(walletsTotal)}
            </p>
          )}
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex bg-black/25 rounded-xl p-3 items-center">
          <ArrowDownCircle size={24} className="text-[var(--accent-on-dark)] mr-3" />
          <div className="flex-1">
            <p className="text-[var(--accent-on-dark)] text-xs font-medium">{t('Total Expenses')}</p>
            <div className="flex mt-1 bg-black/25 rounded-lg p-0.5" role="radiogroup" aria-label={t('Expense period')}>
              <button
                type="button"
                role="radio"
                aria-checked={expensePeriod === 'month'}
                onClick={() => expensePeriod !== 'month' && onToggleExpensePeriod()}
                className={cn(
                  "flex-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all",
                  expensePeriod === 'month'
                    ? "bg-[var(--accent-on-dark)] text-[var(--accent)]"
                    : "text-[var(--accent-on-dark)]/70 hover:text-[var(--accent-on-dark)]"
                )}
              >
                {t('This Month')}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={expensePeriod === 'all'}
                onClick={() => expensePeriod !== 'all' && onToggleExpensePeriod()}
                className={cn(
                  "flex-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all",
                  expensePeriod === 'all'
                    ? "bg-[var(--accent-on-dark)] text-[var(--accent)]"
                    : "text-[var(--accent-on-dark)]/70 hover:text-[var(--accent-on-dark)]"
                )}
              >
                {t('All Time')}
              </button>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-32 bg-[var(--accent-on-dark)]/20 mt-1" />
            ) : (
              <p className="font-mono font-semibold">
                {renderAmount(totalExpense)}
              </p>
            )}
          </div>
        </div>

        {smartInsight && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "px-3 py-2 rounded-lg bg-black/30 text-[11px] font-medium flex items-center gap-2 border border-white/20",
              smartInsight.color
            )}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            {smartInsight.text}
          </motion.div>
        )}

        {!isLoading && (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-black/25 rounded-lg p-3 flex flex-col">
              <span className="text-[10px] text-[var(--accent-on-dark)] uppercase font-bold tracking-wider">{t('Today')}</span>
              <span className="text-sm font-mono font-bold mt-0.5">{renderAmount(dailySummary.today)}</span>
            </div>
            <div className="bg-black/25 rounded-lg p-3 flex flex-col">
              <span className="text-[10px] text-[var(--accent-on-dark)] uppercase font-bold tracking-wider">{t('Yesterday')}</span>
              <span className="text-sm font-mono font-bold mt-0.5">{renderAmount(dailySummary.yesterday)}</span>
            </div>
          </div>
        )}

        {!isLoading && yesterdayDiff !== null && yesterdayDiff !== 0 && (
          <div className="bg-black/25 rounded-lg p-2 flex items-center justify-center">
            <span className="text-[11px] text-[var(--accent-on-dark)]">
              {yesterdayDiff > 0 ? (
                <>
                  <span>+{Math.abs(yesterdayDiff).toFixed(0)}%</span>
                  {' '}{t('vs yesterday')}
                </>
              ) : (
                <>
                  <span>-{Math.abs(yesterdayDiff).toFixed(0)}%</span>
                  {' '}{t('vs yesterday')}
                </>
              )}
            </span>
          </div>
        )}

        {!isLoading && yesterdayDiff === 0 && dailySummary.today > 0 && dailySummary.yesterday > 0 && (
          <div className="bg-black/25 rounded-lg p-2 flex items-center justify-center">
            <span className="text-[11px] text-[var(--accent-on-dark)]">{t('Same as yesterday')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
