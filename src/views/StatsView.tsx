import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';
import { format, startOfMonth, eachDayOfInterval, subDays, subMonths } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Skeleton } from '../components/Skeleton';
import { useTheme } from '../contexts/ThemeContext';
import { parseDate } from '../utils/dateUtils';
import { formatCurrency } from '../utils/formatUtils';
import { DrillDownModal } from '../components/DrillDownModal';
import { EmptyState } from '../components/EmptyState';
import { BarChart3 } from 'lucide-react';

export default function StatsView() {
  const { t, i18n } = useTranslation();
  const [period, setPeriod] = useState<'all' | 'month' | 'week'>('month');
  const { theme } = useTheme();

  const tooltipStyle = useMemo(() => ({
    borderRadius: '8px',
    border: 'none',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    fontSize: '12px',
    backgroundColor: 'var(--card)',
    color: 'var(--text-primary)',
  }), []);

  const formatTooltipValue = useCallback((value: unknown) => formatCurrency(Number(value ?? 0)), []);

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
    return transactions.filter(t => {
      if (period === 'all') return true;
      const tDate = parseDate(t.date);
      if (period === 'month') {
        return tDate.getUTCMonth() === now.getUTCMonth() && tDate.getUTCFullYear() === now.getUTCFullYear();
      }
      if (period === 'week') {
        const weekAgo = subDays(now, 6);
        const weekAgoStart = new Date(weekAgo.getFullYear(), weekAgo.getMonth(), weekAgo.getDate());
        return tDate >= weekAgoStart && tDate <= now;
      }
      return true;
    });
  }, [transactions, period]);

  const expenseAggregates = useMemo(() => {
    const byDate = new Map<string, number>();
    const byMonth = new Map<string, number>();

    if (!transactions) return { byDate, byMonth };

    for (const transaction of transactions) {
      const parsed = parseDate(transaction.date);
      const dateKey = format(parsed, 'yyyy-MM-dd');
      const monthKey = format(parsed, 'yyyy-MM');

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
      days = eachDayOfInterval({ start: subDays(now, 6), end: now });
    } else if (period === 'month') {
      days = eachDayOfInterval({ start: startOfMonth(now), end: now });
    } else {
      days = eachDayOfInterval({ start: subDays(now, 29), end: now });
    }

    return days.map(day => ({
      date: format(day, 'dd MMM', { locale: i18n.language === 'id' ? localeId : undefined }),
      amount: expenseAggregates.byDate.get(format(day, 'yyyy-MM-dd')) ?? 0
    }));
  }, [transactions, period, i18n.language, expenseAggregates]);

  const monthlyComparisonData = useMemo(() => {
    if (!transactions) return [];
    const now = new Date();
    const last6Months = Array.from({ length: 6 }).map((_, i) => startOfMonth(subMonths(now, 5 - i)));
    
    return last6Months.map(monthStart => {
      return {
        month: format(monthStart, 'MMM', { locale: i18n.language === 'id' ? localeId : undefined }),
        amount: expenseAggregates.byMonth.get(format(monthStart, 'yyyy-MM')) ?? 0
      };
    });
  }, [transactions, i18n.language, expenseAggregates]);

  // Get transactions for the drill-down category
  const drillDownTransactions = useMemo(() => {
    if (!drillDownCategory || !allTransactions) return [];
    return allTransactions
      .filter(t => t.categoryId === drillDownCategory.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [drillDownCategory, allTransactions]);

  // Get transactions for the drill-down month key
  const drillDownMonthTransactions = useMemo(() => {
    if (!drillDownMonthKey || !allTransactions) return [];
    const { monthIndex, year } = drillDownMonthKey;
    return allTransactions
      .filter(t => {
        const d = parseDate(t.date);
        return d.getUTCMonth() === monthIndex && d.getUTCFullYear() === year;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [drillDownMonthKey, allTransactions]);

  const data = useMemo(() => {
    const sums: Record<number, number> = {};
    filteredTransactions.forEach(t => {
      if (t.categoryId) {
        sums[t.categoryId] = (sums[t.categoryId] || 0) + t.amount;
      }
    });

    return Object.entries(sums)
      .map(([catId, amount]) => {
        const cat = categoryMap[parseInt(catId)];
        return {
          id: parseInt(catId),
          name: cat?.name || t('Other'),
          value: amount,
          color: cat?.color || 'var(--text-secondary)'
        };
      })
      .sort((a, b) => b.value - a.value);
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
    <div className="p-4 space-y-6 pb-24">
      <h1 className="text-2xl font-bold">{t('Stats')}</h1>

      {hasNoData && (
        <EmptyState
          icon={<BarChart3 size={36} />}
          title={t('No transactions yet')}
          description={t('Add your first expense to start seeing statistics.')}
        />
      )}

      <div className="flex bg-[var(--card)] rounded-lg p-1 border border-[var(--border)]" aria-label={t('Filter Date Range')}>
        {(['week', 'month', 'all'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            aria-pressed={period === p}
            className={`flex-1 py-1.5 text-sm rounded-md font-medium capitalize ${
              period === p ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)]'
            }`}
          >
            {p === 'all' ? t('All') : p === 'month' ? t('Month') : t('Week')}
          </button>
        ))}
      </div>

      {/* Monthly Comparison Chart */}
      <div className="bg-[var(--card)] p-4 rounded-xl shadow-sm border border-[var(--border)]">
        <h2 className="text-sm font-bold mb-4 text-[var(--text-secondary)] uppercase tracking-wider">{t('Monthly Comparison')}</h2>
        <p className="sr-only">{monthlyComparisonSummary}</p>
        <div className="h-48" role="img" aria-label={monthlyComparisonSummary}>
          {isLoading ? (
            <Skeleton className="w-full h-full rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyComparisonData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                />
                <YAxis hide />
                <Tooltip 
                  formatter={formatTooltipValue}
                  contentStyle={tooltipStyle}
                  cursor={{ fill: 'var(--accent)', opacity: 0.1 }}
                />
                <Bar 
                  dataKey="amount" 
                  fill="var(--accent)" 
                  radius={[4, 4, 0, 0]} 
                  barSize={30}
                  onClick={(entry: unknown) => {
                    const e = entry as { month?: string; payload?: typeof monthlyComparisonData[number] } | undefined;
                    if (e?.month && e?.payload) {
                      const idx = monthlyComparisonData.indexOf(e.payload);
                      if (idx >= 0) {
                        const monthStart = subMonths(new Date(), 5 - idx);
                        setDrillDownMonthKey({
                          label: e.month,
                          monthIndex: monthStart.getMonth(),
                          year: monthStart.getFullYear(),
                        });
                      }
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Trend Chart */}
      <div className="bg-[var(--card)] p-4 rounded-xl shadow-sm border border-[var(--border)]">
        <h2 className="text-sm font-bold mb-4 text-[var(--text-secondary)] uppercase tracking-wider">{t('Spending Trend')} ({period === 'all' ? t('Last 30 Days') : period === 'month' ? t('This Month') : t('This Week')})</h2>
        <p className="sr-only">{trendSummary}</p>
        <div className="h-48" role="img" aria-label={trendSummary}>
          {isLoading ? (
            <Skeleton className="w-full h-full rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                  minTickGap={20}
                />
                <YAxis hide />
                <Tooltip 
                  formatter={formatTooltipValue}
                  contentStyle={tooltipStyle}
                />
                <Line 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="var(--accent)" 
                  strokeWidth={3} 
                  dot={false}
                  activeDot={{ r: 6, fill: 'var(--accent)', stroke: 'var(--card)', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-[var(--card)] p-4 rounded-xl shadow-sm border border-[var(--border)]">
        <p className="sr-only">{categorySummary}</p>
        <div className="h-64 relative" role="img" aria-label={categorySummary}>
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Skeleton className="w-40 h-40 rounded-full" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  onClick={(entry: unknown) => {
                    const e = entry as { id?: number; name?: string; color?: string } | undefined;
                    if (e?.id) {
                      const cat = categoryMap[e.id];
                      setDrillDownCategory({ id: e.id, name: e.name || '', color: e.color || cat?.color || 'var(--text-secondary)' });
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} cursor="pointer" />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={formatTooltipValue}
                  contentStyle={tooltipStyle}
                />
              </PieChart>
            </ResponsiveContainer>
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
                        const cat = categoryMap[item.id];
                        if (cat) {
                          setDrillDownCategory({ id: item.id, name: item.name, color: item.color || cat.color });
                        }
                      }}
                      className="flex items-center gap-2 hover:underline text-left"
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
                      <span className="text-sm font-medium">{item.name === t('Other') ? t('Other') : item.name}</span>
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
