import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Skeleton } from '../components/Skeleton';
import { FALLBACK_CATEGORY_NAME } from '../utils/constants';
import {
  displayDateShort,
  displayDateFull,
  displayMonthShort,
  getTodayStr,
  getWeekStartStr,
  getMonthStartStr,
  normaliseDate,
  toDateKey,
  toMonthKey,
  getMonthPrefix,
  daysBetweenDateOnly,
} from '../utils/dateUtils';
import { formatCurrency } from '../utils/formatUtils';
import { usePrivacy } from '../contexts/PrivacyContext';
import { DrillDownModal } from '../components/DrillDownModal';
import { EmptyState } from '../components/EmptyState';
import { ChartBar, ChevronDown, ChevronUp } from 'reicon-react';
import { cn } from '../utils/cn';

// ── Types ──────────────────────────────────────────────────────

type Period = 'week' | 'month' | 'all';
type TrendPoint = { date: string; amount: number; rawDate: string };
type MonthPoint = { month: string; amount: number; monthIndex: number; year: number };
type CategoryPoint = { id: number | null; name: string; value: number; color: string };

// ── Period helpers ─────────────────────────────────────────────

function getPeriodRange(period: Period, now = new Date()) {
  const todayStr = getTodayStr(now);
  if (period === 'week') {
    const startStr = getWeekStartStr(now);
    return { start: startStr, end: todayStr, startLabel: startStr, endLabel: todayStr };
  }
  if (period === 'month') {
    const startStr = getMonthStartStr(now);
    return { start: startStr, end: todayStr, startLabel: startStr, endLabel: todayStr };
  }
  // all: find earliest expense transaction date
  return { start: '0000-01-01', end: todayStr, startLabel: '', endLabel: todayStr };
}

function getPrevPeriodRange(period: Period, now = new Date()) {
  if (period === 'week') {
    const end = new Date(now);
    end.setDate(end.getDate() - 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return { start: getTodayStr(start), end: getTodayStr(end) };
  }
  if (period === 'month') {
    const thisMonthStart = getMonthStartStr(now);
    const daysInThisMonth = daysBetweenDateOnly(thisMonthStart, getTodayStr(now));
    const prevEnd = new Date(now);
    prevEnd.setDate(prevEnd.getDate() - daysInThisMonth - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - daysInThisMonth);
    return { start: getTodayStr(prevStart), end: getTodayStr(prevEnd) };
  }
  return null; // no comparison for all time
}

function formatDateRange(start: string, end: string, locale?: string): string {
  const s = normaliseDate(start);
  const e = normaliseDate(end);
  const fmt = (d: string) => displayDateShort(d, locale);
  if (s === e) return fmt(s);
  return `${fmt(s)}–${fmt(e)}`;
}

function daysInRange(start: string, end: string): number {
  return Math.max(1, daysBetweenDateOnly(start, end) + 1);
}

// ── Chart components ───────────────────────────────────────────

function MiniBarChart({ data, onSelect, hideAmount }: { readonly data: MonthPoint[]; readonly onSelect?: (item: MonthPoint) => void; readonly hideAmount?: boolean }) {
  const max = Math.max(1, ...data.map(item => item.amount));
  return (
    <ul className="grid h-full grid-cols-6 gap-2 px-1 pb-1 pt-2 list-none" aria-label="Monthly comparison">
      {data.map(item => {
        const height = item.amount > 0 ? Math.max(8, (item.amount / max) * 100) : 0;
        const label = hideAmount ? '•••••' : formatCurrency(item.amount);
        if (onSelect) {
          return (
            <li key={`${item.year}-${item.monthIndex}`} className="contents">
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="grid min-w-0 grid-rows-[1fr_auto] gap-2 rounded-md px-1 py-1 text-center hover:bg-[var(--bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] min-h-[44px]"
                aria-label={`${item.month}: ${label}`}
              >
                <span className="flex items-end justify-center rounded bg-[var(--bg)]">
                  <span
                    className="w-full max-w-8 rounded-t bg-[var(--accent)] transition-[height] duration-200"
                    style={{ height: `${height}%` }}
                  />
                </span>
                <span className="truncate font-mono text-[10px] text-[var(--text-secondary)]">{item.month}</span>
              </button>
            </li>
          );
        }
        return (
          <li
            key={`${item.year}-${item.monthIndex}`}
            className="grid min-w-0 grid-rows-[1fr_auto] gap-2 rounded-md px-1 py-1 text-center"
            aria-label={`${item.month}: ${label}`}
          >
            <span className="flex items-end justify-center rounded bg-[var(--bg)]">
              <span
                className="w-full max-w-8 rounded-t bg-[var(--accent)] transition-[height] duration-200"
                style={{ height: `${height}%` }}
              />
            </span>
            <span className="truncate font-mono text-[10px] text-[var(--text-secondary)]">{item.month}</span>
          </li>
        );
      })}
    </ul>
  );
}

function MiniLineChart({ data, hideAmount }: { readonly data: TrendPoint[]; readonly hideAmount?: boolean }) {
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
        {/* Zero baseline */}
        <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="var(--border)" strokeWidth="1" />
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
      <div className="flex justify-between gap-2 font-mono text-[10px] text-[var(--text-secondary)]" aria-hidden="true">
        {labels.map(item => (
          <span key={item.rawDate} className="truncate">{item.date}</span>
        ))}
      </div>
    </div>
  );
}

function CategoryDonut({ data }: { readonly data: CategoryPoint[] }) {
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

// ── Expandable data table section ──────────────────────────────

function DataTableToggle({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const tableId = useMemo(() => `stats-table-${Math.random().toString(36).slice(2, 8)}`, []); // NOSONAR
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={tableId}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg)] min-h-[36px]"
      >
        {label}
        {open ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
      </button>
      {open && (
        <div id={tableId} className="overflow-x-auto">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Main StatsView ─────────────────────────────────────────────

export default function StatsView() {
// NOSONAR S3776 — cognitive complexity is inherent to this business logic
  const { t, i18n } = useTranslation();
  const { hideAmount } = usePrivacy();
  const [period, setPeriod] = useState<Period>('month');
  const [walletFilter, setWalletFilter] = useState<number | null>(null);

  const allTransactions = useLiveQuery(() => db.transactions.toArray(), [], undefined);
  const transactions = useLiveQuery(() => db.transactions.where('type').equals('expense').toArray(), [], undefined);
  const categories = useLiveQuery(() => db.categories.toArray(), [], undefined);
  const allWallets = useLiveQuery(() => db.wallets.toArray(), [], undefined) ?? [];

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

  // Period range
  const periodRange = useMemo(() => getPeriodRange(period), [period]);
  const prevPeriodRange = useMemo(() => getPrevPeriodRange(period), [period]);

  // Filter expenses by period + wallet
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    const { start, end } = periodRange;
    return transactions.filter(tx => {
      const txDate = normaliseDate(tx.date);
      if (txDate < start || txDate > end) return false;
      if (walletFilter != null && tx.walletId !== walletFilter) return false;
      return true;
    });
  }, [transactions, periodRange, walletFilter]);

  // Previous period expenses (no wallet filter for comparison)
  const prevFilteredTransactions = useMemo(() => {
    if (!transactions || !prevPeriodRange) return [];
    const { start, end } = prevPeriodRange;
    return transactions.filter(tx => {
      const txDate = normaliseDate(tx.date);
      return txDate >= start && txDate <= end;
    });
  }, [transactions, prevPeriodRange]);

  // All expenses for aggregation (by date and month)
  const expenseAggregates = useMemo(() => {
    const byDate = new Map<string, number>();
    const byMonth = new Map<string, number>();
    if (!transactions) return { byDate, byMonth };
    for (const tx of transactions) {
      const dateKey = normaliseDate(tx.date);
      const monthKey = getMonthPrefix(dateKey);
      byDate.set(dateKey, (byDate.get(dateKey) ?? 0) + tx.amount);
      byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + tx.amount);
    }
    return { byDate, byMonth };
  }, [transactions]);

  // ── Summary ────────────────────────────────────────────────

  const summary = useMemo(() => {
    const total = filteredTransactions.reduce((s, tx) => s + tx.amount, 0);
    const count = filteredTransactions.length;
    const { start, end } = periodRange;
    const days = daysInRange(start, end);
    const prevTotal = prevFilteredTransactions.reduce((s, tx) => s + tx.amount, 0);
    const prevCount = prevFilteredTransactions.length;

    let avgLabel = '';
    let avgValue = 0;
    if (period === 'week' || period === 'month') {
      const activeDays = new Set(filteredTransactions.map(tx => normaliseDate(tx.date))).size || 1;
      avgValue = total / activeDays;
      avgLabel = t('stats.dailyAverage');
    } else {
      // all time: per transaction
      avgValue = count > 0 ? total / count : 0;
      avgLabel = t('stats.perTransaction');
    }

    return { total, count, avgLabel, avgValue, prevTotal, prevCount, days };
  }, [filteredTransactions, prevFilteredTransactions, periodRange, period, t]);

  // ── Date range label ───────────────────────────────────────

  const dateRangeLabel = useMemo(() => {
    if (period === 'all') {
      // Find earliest expense date
      if (!transactions || transactions.length === 0) return '';
      const earliest = transactions.map(tx => tx.date).reduce((min, date) => (date < min ? date : min));
      return t('stats.dateRangeAll', { date: displayDateFull(earliest, i18n.language) });
    }
    return formatDateRange(periodRange.start, periodRange.end, i18n.language);
  }, [period, periodRange, transactions, t, i18n.language]);

  // ── Trend data ─────────────────────────────────────────────

  const trendData = useMemo(() => {
    if (!transactions) return [];
    const now = new Date();
    const { start, end } = periodRange;

    if (period === 'week' || period === 'month') {
      // Daily trend
      const startD = new Date(normaliseDate(start) + 'T12:00:00Z');
      const endD = new Date(normaliseDate(end) + 'T12:00:00Z');
      const days: Date[] = [];
      for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d));
      }
      return days.map(day => ({
        date: displayDateShort(day, i18n.language),
        amount: expenseAggregates.byDate.get(toDateKey(day)) ?? 0,
        rawDate: toDateKey(day),
      }));
    }

    // All time: monthly trend (last 12 months)
    const months: MonthPoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = toMonthKey(d);
      months.push({
        month: displayMonthShort(d, i18n.language),
        amount: expenseAggregates.byMonth.get(key) ?? 0,
        monthIndex: d.getMonth(),
        year: d.getFullYear(),
      });
    }
    return months.map(m => ({
      date: m.month,
      amount: m.amount,
      rawDate: `${m.year}-${String(m.monthIndex + 1).padStart(2, '0')}`,
    }));
  }, [transactions, period, periodRange, i18n.language, expenseAggregates]);

  // ── Monthly comparison (last 6 months) ─────────────────────

  const monthlyComparisonData = useMemo(() => {
    if (!transactions) return [];
    const now = new Date();
    const last6Months = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return d;
    });
    return last6Months.map(monthStart => ({
      month: displayMonthShort(monthStart, i18n.language),
      amount: expenseAggregates.byMonth.get(toMonthKey(monthStart)) ?? 0,
      monthIndex: monthStart.getMonth(),
      year: monthStart.getFullYear(),
    }));
  }, [transactions, i18n.language, expenseAggregates]);

  // ── Category breakdown ─────────────────────────────────────

  const categoryData = useMemo(() => {
    const catSums = new Map<number, number>();
    let uncategorizedSum = 0;
    filteredTransactions.forEach(tx => {
      if (tx.categoryId != null) {
        catSums.set(tx.categoryId, (catSums.get(tx.categoryId) ?? 0) + tx.amount);
      } else {
        uncategorizedSum += tx.amount;
      }
    });

    const result: CategoryPoint[] = [];
    for (const [catId, amount] of catSums) {
      const cat = categoryMap[catId];
      result.push({
        id: catId,
        name: (cat?.name === FALLBACK_CATEGORY_NAME ? t('Other') : cat?.name) || t('Other'),
        value: amount,
        color: cat?.color || 'var(--text-secondary)',
      });
    }
    if (uncategorizedSum > 0) {
      result.push({ id: null, name: t('Other'), value: uncategorizedSum, color: 'var(--text-secondary)' });
    }
    return result.sort((a, b) => b.value - a.value);
  }, [filteredTransactions, categoryMap, t]);

  const categoryTotal = categoryData.reduce((sum, item) => sum + item.value, 0);
  const activeCategoryCount = categoryData.filter(c => c.value > 0).length;

  // ── Drill-down transactions ────────────────────────────────

  const drillDownTransactions = useMemo(() => {
    if (!drillDownCategory || !allTransactions) return [];
    return allTransactions
      .filter(tx => tx.type === 'expense' && tx.categoryId === drillDownCategory.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [drillDownCategory, allTransactions]);

  const drillDownMonthTransactions = useMemo(() => {
    if (!drillDownMonthKey || !allTransactions) return [];
    const { monthIndex, year } = drillDownMonthKey;
    return allTransactions
      .filter(tx => {
        if (tx.type !== 'expense') return false;
        const d = new Date(normaliseDate(tx.date) + 'T12:00:00Z');
        return d.getUTCMonth() === monthIndex && d.getUTCFullYear() === year;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [drillDownMonthKey, allTransactions]);

  // ── Trend unique days count (for insufficient data) ────────

  const trendDaysWithData = useMemo(() => {
    const { start, end } = periodRange;
    let count = 0;
    for (const [dateKey, amount] of expenseAggregates.byDate) {
      if (dateKey >= start && dateKey <= end && amount > 0) count++;
    }
    return count;
  }, [expenseAggregates, periodRange]);

  // ── States ─────────────────────────────────────────────────

  const isLoading = transactions === undefined || categories === undefined;
  const hasAnyExpenses = !isLoading && (transactions?.length ?? 0) > 0;
  const hasNoDataInPeriod = !isLoading && hasAnyExpenses && filteredTransactions.length === 0;
  const isEmpty = !isLoading && !hasAnyExpenses;
  const showInsufficientTrend = (period === 'week' || period === 'month') && trendDaysWithData <= 1;

  const periodLabel = (() => {
    if (period === 'week') return t('stats.periodWeek');
    if (period === 'month') return t('stats.periodMonth');
    return t('stats.periodAll');
  })();

  // ── Comparison text ────────────────────────────────────────

  const comparisonText = useMemo(() => {
    if (period === 'all') return null;
    if (summary.prevTotal === 0 && summary.total === 0) return t('stats.comparisonNotEnough');
    if (summary.prevTotal === 0) return t('stats.comparisonNotEnough');

    const diff = summary.total - summary.prevTotal;
    const absDiff = Math.abs(diff);
    const formattedDiff = formatCurrency(absDiff, hideAmount);

    if (absDiff === 0) return t('stats.comparisonSame');
    if (diff > 0) return t('stats.comparisonHigher', { diff: formattedDiff });
    return t('stats.comparisonLower', { diff: formattedDiff });
  }, [period, summary, t, hideAmount]);

  const comparisonContext = useMemo(() => {
    if (period === 'week') return t('stats.comparisonPrevWeek');
    if (period === 'month') return t('stats.comparisonPrevMonth');
    return '';
  }, [period, t]);

  // ── Chart summaries (sr-only) ──────────────────────────────

  const monthlyCompSummary = monthlyComparisonData
    .map(item => `${item.month}: ${hideAmount ? t('stats.amountHidden') : formatCurrency(item.amount)}`)
    .join(', ');

  const trendSummary = trendData
    .map(item => `${item.date}: ${hideAmount ? t('stats.amountHidden') : formatCurrency(item.amount)}`)
    .join(', ');

  const categorySummary = categoryData.length > 0
    ? categoryData.map(item => `${item.name}: ${hideAmount ? t('stats.amountHidden') : formatCurrency(item.value)}`).join(', ')
    : t('No transactions in this view');

  // ── Render ─────────────────────────────────────────────────

  // Empty state: no expenses at all
  if (isEmpty) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t('stats.statistics')}</h1>
        <EmptyState
          icon={<ChartBar size={36} />}
          title={t('stats.emptyFirstUse')}
          description={t('stats.emptyFirstUseDesc')}
          action={{ label: t('stats.emptyFirstUseCta'), onClick: () => window.location.href = '/' }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* H1 */}
      <h1 className="text-2xl font-bold">{t('stats.statistics')}</h1>

      {/* Period selector — native radio fieldset */}
      <fieldset>
        <legend className="sr-only">{t('stats.period')}</legend>
        <div className="flex bg-[var(--card)] rounded-lg p-1 border border-[var(--border)]">
          {([
            { value: 'week' as Period, label: t('stats.periodWeek') },
            { value: 'month' as Period, label: t('stats.periodMonth') },
            { value: 'all' as Period, label: t('stats.periodAll') },
          ]).map(({ value, label }) => (
            <label
              key={value}
              className={cn(
                'flex-1 text-center py-2 text-sm font-bold rounded-md cursor-pointer min-h-[44px] flex items-center justify-center transition-colors',
                period === value
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg)]',
              )}
            >
              <input
                type="radio"
                name="stats-period"
                value={value}
                checked={period === value}
                onChange={() => setPeriod(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Date range */}
      {dateRangeLabel && (
        <p className="text-xs font-medium text-[var(--text-secondary)]" aria-live="polite">{dateRangeLabel}</p>
      )}

      {/* Wallet filter — only if >1 wallet */}
      {allWallets.length > 1 && (
        <div>
          <label htmlFor="stats-wallet-filter" className="sr-only">{t('All Wallets')}</label>
          <select
            id="stats-wallet-filter"
            value={walletFilter ?? ''}
            onChange={(e) => setWalletFilter(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 min-h-[44px]"
          >
            <option value="">{t('All Wallets')}</option>
            {allWallets.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* No data in period */}
      {hasNoDataInPeriod && (
        <EmptyState
          icon={<ChartBar size={36} />}
          title={walletFilter != null ? t('stats.emptyNoWalletSpending') : t('stats.emptyNoPeriodSpending')}
          description={t('stats.emptyNoPeriodSpendingDesc')}
          action={walletFilter != null ? { label: t('All Wallets'), onClick: () => setWalletFilter(null) } : undefined}
        />
      )}

      {/* Summary metrics */}
      {!hasNoDataInPeriod && (
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">{t('stats.totalSpending')}</p>
          <p className="font-mono text-3xl font-bold">{formatCurrency(summary.total, hideAmount)}</p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-secondary)]">
            <span>
              {summary.count === 1
                ? t('stats.transactionCount_one', { count: summary.count })
                : t('stats.transactionCount', { count: summary.count })
              }
            </span>
            {summary.count > 0 && (
              <span>
                {hideAmount ? '•••••' : formatCurrency(summary.avgValue)} {summary.avgLabel}
              </span>
            )}
          </div>

          {/* Comparison */}
          {comparisonText && comparisonContext && (
            <p className="mt-2 text-xs text-[var(--text-secondary)]">{comparisonContext.replace('{{diff}}', comparisonText)}</p>
          )}
        </div>
      )}

      {/* ── Monthly Comparison ───────────────────────────────── */}
      {!hasNoDataInPeriod && (
        <figure className="bg-[var(--card)] p-4 rounded-[16px] shadow-sm border border-[var(--border)]">
          <figcaption>
            <h2 className="text-sm font-bold mb-1 text-[var(--text-secondary)] uppercase tracking-wider">{t('stats.monthlyComparison')}</h2>
            <p className="sr-only">{monthlyCompSummary}</p>
          </figcaption>
          <div className="h-48" role="img" aria-label={monthlyCompSummary}>
            {isLoading ? (
              <Skeleton className="w-full h-full rounded-lg" />
            ) : (
              <MiniBarChart
                data={monthlyComparisonData}
                hideAmount={hideAmount}
                onSelect={(item) => setDrillDownMonthKey({ label: item.month, monthIndex: item.monthIndex, year: item.year })}
              />
            )}
          </div>
          <DataTableToggle label={t('stats.viewData')}>
            <table className="w-full text-xs mt-2">
              <caption className="sr-only">{t('stats.monthlyComparison')}</caption>
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th scope="col" className="text-left py-2 font-bold text-[var(--text-secondary)]">{t('stats.tablePeriod')}</th>
                  <th scope="col" className="text-right py-2 font-bold text-[var(--text-secondary)]">{t('stats.tableSpending')}</th>
                  <th scope="col" className="text-right py-2 font-bold text-[var(--text-secondary)]">{t('stats.tableTransactions')}</th>
                </tr>
              </thead>
              <tbody>
                {monthlyComparisonData.map(item => {
                  const count = expenseAggregates.byMonth.get(toMonthKey(new Date(item.year, item.monthIndex, 1))) !== undefined
                    ? (allTransactions ?? []).filter(tx => tx.type === 'expense' && getMonthPrefix(normaliseDate(tx.date)) === toMonthKey(new Date(item.year, item.monthIndex, 1))).length
                    : 0;
                  return (
                    <tr key={`${item.year}-${item.monthIndex}`} className="border-b border-[var(--border)]">
                      <td className="py-1.5">{item.month} {item.year}</td>
                      <td className="py-1.5 text-right font-mono">{hideAmount ? '•••••' : formatCurrency(item.amount)}</td>
                      <td className="py-1.5 text-right font-mono">{count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataTableToggle>
        </figure>
      )}

      {/* ── Spending Trend ───────────────────────────────────── */}
      {!hasNoDataInPeriod && (
        <figure className="bg-[var(--card)] p-4 rounded-[16px] shadow-sm border border-[var(--border)]">
          <figcaption>
            <h2 className="text-sm font-bold mb-1 text-[var(--text-secondary)] uppercase tracking-wider">{t('stats.spendingTrend')} · {periodLabel}</h2>
            <p className="sr-only">{trendSummary}</p>
          </figcaption>
          {showInsufficientTrend ? (
            <div className="py-8 text-center">
              <p className="text-sm font-bold text-[var(--text-secondary)]">{t('stats.trendNotEnough')}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">{t('stats.trendNotEnoughDesc', { count: trendDaysWithData })}</p>
            </div>
          ) : (
            <>
              <div className="h-48" role="img" aria-label={trendSummary}>
                {isLoading ? (
                  <Skeleton className="w-full h-full rounded-lg" />
                ) : (
                  <MiniLineChart data={trendData} hideAmount={hideAmount} />
                )}
              </div>
              <DataTableToggle label={t('stats.viewData')}>
                <table className="w-full text-xs mt-2">
                  <caption className="sr-only">{t('stats.spendingTrend')}</caption>
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th scope="col" className="text-left py-2 font-bold text-[var(--text-secondary)]">{t('stats.tableDate')}</th>
                      <th scope="col" className="text-right py-2 font-bold text-[var(--text-secondary)]">{t('stats.tableSpending')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trendData.filter(p => p.amount > 0).map(point => (
                      <tr key={point.rawDate} className="border-b border-[var(--border)]">
                        <td className="py-1.5">{point.date}</td>
                        <td className="py-1.5 text-right font-mono">{hideAmount ? '•••••' : formatCurrency(point.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTableToggle>
            </>
          )}
        </figure>
      )}

      {/* ── Category Breakdown ───────────────────────────────── */}
      {!hasNoDataInPeriod && (
        <figure className="bg-[var(--card)] p-4 rounded-[16px] shadow-sm border border-[var(--border)]">
          <figcaption>
            <h2 className="text-sm font-bold mb-4 text-[var(--text-secondary)] uppercase tracking-wider">{t('stats.spendingByCategory')}</h2>
          </figcaption>

          {activeCategoryCount === 1 ? (
            /* Single category — no donut */
            <div className="py-4 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">{t('stats.topCategory')}</p>
              <p className="mt-2 font-bold text-lg">{categoryData[0]?.name}</p>
              <p className="font-mono text-sm text-[var(--text-secondary)]">
                {hideAmount ? '•••••' : formatCurrency(categoryData[0]?.value ?? 0)} · 100%
              </p>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">{t('stats.allSpendingInOneCategory')}</p>
            </div>
          ) : (
            /* Multiple categories — donut + list */
            <>
              <div className="h-64 relative" role="img" aria-label={categorySummary}>
                {isLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Skeleton className="w-40 h-40 rounded-full" />
                  </div>
                ) : (
                  <CategoryDonut data={categoryData} />
                )}
                {!isLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xs text-[var(--text-secondary)]">{t('Total')}</span>
                    <span className="font-mono font-bold">{formatCurrency(categoryTotal, hideAmount)}</span>
                  </div>
                )}
              </div>

              <ul className="mt-4 space-y-2 list-none" aria-label={t('stats.spendingByCategory')}>
                {categoryData.map((item) => (
                  <li key={item.id ?? 'other'} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} aria-hidden="true" />
                      <span className="text-sm font-medium truncate">{item.name}</span>
                    </div>
                    <div className="font-mono text-sm flex items-baseline shrink-0 ml-2">
                      <span>{hideAmount ? '•••••' : formatCurrency(item.value)}</span>
                      {categoryTotal > 0 && (
                        <span className="text-[10px] text-[var(--text-secondary)] ml-1">
                          ({Math.round((item.value / categoryTotal) * 100)}%)
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          <DataTableToggle label={t('stats.viewData')}>
            <table className="w-full text-xs mt-2">
              <caption className="sr-only">{t('stats.spendingByCategory')}</caption>
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th scope="col" className="text-left py-2 font-bold text-[var(--text-secondary)]">{t('stats.tableCategory')}</th>
                  <th scope="col" className="text-right py-2 font-bold text-[var(--text-secondary)]">{t('stats.tableSpending')}</th>
                  <th scope="col" className="text-right py-2 font-bold text-[var(--text-secondary)]">{t('stats.tablePercentage')}</th>
                  <th scope="col" className="text-right py-2 font-bold text-[var(--text-secondary)]">{t('stats.tableTransactions')}</th>
                </tr>
              </thead>
              <tbody>
                {categoryData.map(item => {
                  const count = filteredTransactions.filter(tx => tx.categoryId === item.id).length;
                  return (
                    <tr key={item.id ?? 'other'} className="border-b border-[var(--border)]">
                      <td className="py-1.5 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} aria-hidden="true" />
                        {item.name}
                      </td>
                      <td className="py-1.5 text-right font-mono">{hideAmount ? '•••••' : formatCurrency(item.value)}</td>
                      <td className="py-1.5 text-right font-mono">
                        {categoryTotal > 0 ? `${Math.round((item.value / categoryTotal) * 100)}%` : '—'}
                      </td>
                      <td className="py-1.5 text-right font-mono">{count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataTableToggle>
        </figure>
      )}

      {/* Drill-down modals */}
      <DrillDownModal
        isOpen={!!drillDownCategory}
        onClose={() => setDrillDownCategory(null)}
        title={drillDownCategory?.name || ''}
        transactions={drillDownTransactions}
        categoryMap={categoryMap}
      />
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

