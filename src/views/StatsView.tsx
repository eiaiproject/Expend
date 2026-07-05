import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Skeleton } from '../components/Skeleton';
import { getCategoryDisplayName } from '../utils/categoryDisplay';
import { displayDateShort, displayMonthShort, getMonthPrefix, normaliseDate, parseDate, toDateKey, toMonthKey } from '../utils/dateUtils';
import { formatCurrency } from '../utils/formatUtils';
import { DrillDownModal } from '../components/DrillDownModal';
import { EmptyState } from '../components/EmptyState';
import { BarChart3 } from 'lucide-react';

type TrendPoint = { date: string; amount: number };
type MonthPoint = { month: string; amount: number; monthIndex: number; year: number };
type CategoryPoint = { id: number | null; name: string; value: number; color: string };

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function startOfMonthDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  for (let day = new Date(start); day <= end; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

function MiniBarChart({ data, onSelect }: { data: MonthPoint[]; onSelect: (item: MonthPoint) => void }) {
  const max = Math.max(1, ...data.map(item => item.amount));

  return (
    <div className="grid h-full grid-cols-6 gap-2 px-1 pb-1 pt-2">
      {data.map(item => {
        const height = item.amount > 0 ? Math.max(8, (item.amount / max) * 100) : 3;
        return (
          <button
            key={`${item.year}-${item.monthIndex}`}
            type="button"
            onClick={() => onSelect(item)}
            className="grid min-w-0 grid-rows-[1fr_auto] gap-2 rounded-md px-1 py-1 text-center hover:bg-[var(--bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            aria-label={`${item.month}: ${formatCurrency(item.amount)}`}
            title={formatCurrency(item.amount)}
          >
            <span className="flex items-end justify-center rounded bg-[var(--bg)]">
              <span
                className="w-full max-w-8 rounded-t bg-[var(--accent)] transition-[height]"
                style={{ height: `${height}%` }}
              />
            </span>
            <span className="truncate font-mono text-[10px] text-[var(--text-secondary)]">{item.month}</span>
          </button>
        );
      })}
    </div>
  );
}

function MiniLineChart({ data }: { data: TrendPoint[] }) {
  const width = 320;
  const height = 150;
  const pad = 10;
  const max = Math.max(1, ...data.map(item => item.amount));
  const step = data.length > 1 ? (width - pad * 2) / (data.length - 1) : 0;
  const points = data
    .map((item, index) => {
      const x = pad + index * step;
      const y = height - pad - (item.amount / max) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');
  const labels = data.filter((_, index) => index === 0 || index === data.length - 1 || index === Math.floor((data.length - 1) / 2));

  return (
    <div className="grid h-full grid-rows-[1fr_auto] gap-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="presentation" aria-hidden="true">
        {[0.25, 0.5, 0.75].map(line => (
          <line
            key={line}
            x1={pad}
            x2={width - pad}
            y1={height * line}
            y2={height * line}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
        ))}
        <polyline fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={points} />
      </svg>
      <div className="flex justify-between gap-2 font-mono text-[10px] text-[var(--text-secondary)]">
        {labels.map(item => (
          <span key={item.date} className="truncate">{item.date}</span>
        ))}
      </div>
    </div>
  );
}

function CategoryDonut({ data }: { data: CategoryPoint[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const stops = total > 0
    ? data.map(item => {
      const start = cursor;
      cursor += (item.value / total) * 100;
      return `${item.color} ${start}% ${cursor}%`;
    }).join(', ')
    : 'var(--border) 0% 100%';

  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <div className="h-44 w-44 rounded-full p-5" style={{ background: `conic-gradient(${stops})` }}>
        <div className="h-full w-full rounded-full bg-[var(--card)]" />
      </div>
    </div>
  );
}

export default function StatsView() {
  const { t, i18n } = useTranslation();
  const [period, setPeriod] = useState<'all' | 'month' | 'week'>('month');

  const allTransactions = useLiveQuery(() => db.transactions.toArray(), [], undefined);
  const transactions = useLiveQuery(() => db.transactions.where('type').equals('expense').toArray(), [], undefined);
  const categories = useLiveQuery(() => db.categories.toArray(), [], undefined);

  // Drill-down state
  const [drillDownCategory, setDrillDownCategory] = useState<{ id: number; name: string; color: string } | null>(null);
  const [drillDownMonthKey, setDrillDownMonthKey] = useState<{ label: string; monthIndex: number; year: number } | null>(null);

  const categoryMap = useMemo(() => {
    if (!categories) return {};
    return categories.reduce((acc, cat) => {
      acc[cat.id!] = cat;
      return acc;
    }, {} as Record<number, import('../db/db').Category>);
  }, [categories]);

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    const now = new Date();
    const todayKey = toDateKey(now);
    const thisMonthKey = toMonthKey(now);
    const weekAgoKey = toDateKey(addDays(now, -6));

    return transactions.filter(t => {
      if (period === 'all') return true;
      const transactionDate = normaliseDate(t.date);
      if (period === 'month') {
        return getMonthPrefix(transactionDate) === thisMonthKey;
      }
      if (period === 'week') {
        return transactionDate >= weekAgoKey && transactionDate <= todayKey;
      }
      return true;
    });
  }, [transactions, period]);

  const expenseAggregates = useMemo(() => {
    const byDate = new Map<string, number>();
    const byMonth = new Map<string, number>();

    if (!transactions) return { byDate, byMonth };

    for (const transaction of transactions) {
      const dateKey = normaliseDate(transaction.date);
      const monthKey = getMonthPrefix(dateKey);

      byDate.set(dateKey, (byDate.get(dateKey) ?? 0) + transaction.amount);
      byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + transaction.amount);
    }

    return { byDate, byMonth };
  }, [transactions]);

  const trendData = useMemo(() => {
    if (!transactions) return [];
    const now = new Date();
    let days: Date[] = [];
    
    if (period === 'week') {
      days = eachDay(addDays(now, -6), now);
    } else if (period === 'month') {
      days = eachDay(startOfMonthDate(now), now);
    } else {
      days = eachDay(addDays(now, -29), now);
    }

    return days.map(day => ({
      date: displayDateShort(day, i18n.language),
      amount: expenseAggregates.byDate.get(toDateKey(day)) ?? 0
    }));
  }, [transactions, period, i18n.language, expenseAggregates]);

  const monthlyComparisonData = useMemo(() => {
    if (!transactions) return [];
    const now = new Date();
    const last6Months = Array.from({ length: 6 }).map((_, i) => addMonths(startOfMonthDate(now), i - 5));
    
    return last6Months.map(monthStart => {
      return {
        month: displayMonthShort(monthStart, i18n.language),
        amount: expenseAggregates.byMonth.get(toMonthKey(monthStart)) ?? 0,
        monthIndex: monthStart.getMonth(),
        year: monthStart.getFullYear(),
      };
    });
  }, [transactions, i18n.language, expenseAggregates]);

  // Get expense transactions for the drill-down category
  const drillDownTransactions = useMemo(() => {
    if (!drillDownCategory || !allTransactions) return [];
    return allTransactions
      .filter(t => t.type === 'expense' && t.categoryId === drillDownCategory.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [drillDownCategory, allTransactions]);

  // Get expense transactions for the drill-down month key
  const drillDownMonthTransactions = useMemo(() => {
    if (!drillDownMonthKey || !allTransactions) return [];
    const { monthIndex, year } = drillDownMonthKey;
    return allTransactions
      .filter(t => {
        if (t.type !== 'expense') return false;
        const d = parseDate(t.date);
        return d.getUTCMonth() === monthIndex && d.getUTCFullYear() === year;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [drillDownMonthKey, allTransactions]);

  const data = useMemo(() => {
    const catSums = new Map<number, number>();
    let uncategorizedSum = 0;
    filteredTransactions.forEach(t => {
      if (t.categoryId != null) {
        catSums.set(t.categoryId, (catSums.get(t.categoryId) ?? 0) + t.amount);
      } else {
        uncategorizedSum += t.amount;
      }
    });

    const result: CategoryPoint[] = [];
    for (const [catId, amount] of catSums) {
      const cat = categoryMap[catId];
      result.push({
        id: catId,
        name: getCategoryDisplayName(cat?.name, t) || t('Other'),
        value: amount,
        color: cat?.color || 'var(--text-secondary)' 
      });
    }
    if (uncategorizedSum > 0) {
      result.push({ id: null, name: t('Other'), value: uncategorizedSum, color: 'var(--text-secondary)' });
    }

    return result.sort((a, b) => b.value - a.value);
  }, [filteredTransactions, categoryMap, t]);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const isLoading = transactions === undefined || categories === undefined;
  const hasNoData = !isLoading && filteredTransactions.length === 0;
  const monthlyComparisonSummary = monthlyComparisonData
    .map(item => `${item.month}: ${formatCurrency(item.amount)}`)
    .join(', ');
  const trendSummary = trendData
    .map(item => `${item.date}: ${formatCurrency(item.amount)}`)
    .join(', ');
  const categorySummary = data.length > 0
    ? data.map(item => `${item.name}: ${formatCurrency(item.value)}`).join(', ')
    : t('No transactions in this view');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('Stats')}</h1>

      {hasNoData && (
        <EmptyState
          icon={<BarChart3 size={36} />}
          title={t('No transactions yet')}
          description={t('Add your first expense to start seeing statistics.')}
        />
      )}

      <div className="flex bg-[var(--card)] rounded-lg p-1 border border-[var(--border)]" role="radiogroup" aria-label={t('Filter Date Range')}>
        {(['week', 'month', 'all'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            role="radio"
            aria-checked={period === p}
            className={`flex-1 py-1.5 text-sm rounded-md font-medium capitalize ${
              period === p ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)]'
            }`}
          >
            {p === 'all' ? t('All') : p === 'month' ? t('Month') : t('Week')}
          </button>
        ))}
      </div>

      {/* Monthly Comparison Chart */}
      <div className="bg-[var(--card)] p-4 rounded-[16px] shadow-sm border border-[var(--border)]">
        <h2 className="text-sm font-bold mb-4 text-[var(--text-secondary)] uppercase tracking-wider">{t('Monthly Comparison')}</h2>
        <p className="sr-only">{monthlyComparisonSummary}</p>
        <div className="h-48" role="img" aria-label={monthlyComparisonSummary}>
          {isLoading ? (
            <Skeleton className="w-full h-full rounded-lg" />
          ) : (
            <MiniBarChart
              data={monthlyComparisonData}
              onSelect={(item) => {
                setDrillDownMonthKey({
                  label: item.month,
                  monthIndex: item.monthIndex,
                  year: item.year,
                });
              }}
            />
          )}
        </div>
      </div>

      {/* Trend Chart */}
      <div className="bg-[var(--card)] p-4 rounded-[16px] shadow-sm border border-[var(--border)]">
        <h2 className="text-sm font-bold mb-4 text-[var(--text-secondary)] uppercase tracking-wider">{t('Spending Trend')} ({period === 'all' ? t('Last 30 Days') : period === 'month' ? t('This Month') : t('This Week')})</h2>
        <p className="sr-only">{trendSummary}</p>
        <div className="h-48" role="img" aria-label={trendSummary}>
          {isLoading ? (
            <Skeleton className="w-full h-full rounded-lg" />
          ) : (
            <MiniLineChart data={trendData} />
          )}
        </div>
      </div>

      <div className="bg-[var(--card)] p-4 rounded-[16px] shadow-sm border border-[var(--border)]">
        <p className="sr-only">{categorySummary}</p>
        <div className="h-64 relative" role="img" aria-label={categorySummary}>
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Skeleton className="w-40 h-40 rounded-full" />
            </div>
          ) : (
            <CategoryDonut data={data} />
          )}
          {!isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs text-[var(--text-secondary)]">{t('Total')}</span>
              <span className="font-mono font-bold">{formatCurrency(total)}</span>
            </div>
          )}
        </div>

        <div className="mt-6 space-y-4">
          {isLoading ? (
            [1, 2, 3].map(i => <Skeleton key={i} className="w-full h-5 rounded" />)
          ) : (
            <>
              <p className="sr-only">{t('Top categories')}: {categorySummary}</p>
              <div role="list" aria-label={t('Top categories')}>
                {data.map((item, i) => (
                  <div key={i} className="flex items-center justify-between" role="listitem">
                    <button
                      type="button"
                      onClick={() => {
                        if (item.id == null) return;
                        const cat = categoryMap[item.id];
                        if (cat) {
                          setDrillDownCategory({ id: item.id, name: item.name, color: item.color || cat.color });
                        }
                      }}
                      className="flex items-center gap-2 hover:underline text-left"
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
                      <span className="text-sm font-medium">{item.name}</span>
                    </button>
                    <div className="font-mono text-sm flex items-baseline">
                      <span>{formatCurrency(item.value)}</span>
                      {total > 0 && (
                        <span className="text-[10px] text-[var(--text-secondary)] ml-1">
                          ({Math.round((item.value / total) * 100)}%)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Category Drill-Down Modal */}
      <DrillDownModal
        isOpen={!!drillDownCategory}
        onClose={() => setDrillDownCategory(null)}
        title={drillDownCategory?.name || ''}
        transactions={drillDownTransactions}
        categoryMap={categoryMap}
      />

      {/* Month Drill-Down Modal */}
      <DrillDownModal
        isOpen={!!drillDownMonthKey}
        onClose={() => setDrillDownMonthKey(null)}
        title={drillDownMonthKey ? `${drillDownMonthKey.label} ${drillDownMonthKey.year}` : ''}
        transactions={drillDownMonthTransactions}
        categoryMap={categoryMap}
      />
    </div>
  );
}
