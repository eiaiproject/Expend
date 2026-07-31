import { Transaction, Category } from '../db/db';
import { FALLBACK_CATEGORY_NAME } from '../utils/constants';
import { getTodayStr, getYesterdayStr, getMonthStartStr, getNextMonthStartStr, normaliseDate } from '../utils/dateUtils';

export interface BudgetStatus {
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  budget: number;
  spent: number;
  remaining: number;
  percentage: number;
  isOverBudget: boolean;
  isNearLimit: boolean;
}

export interface DailySpending {
  today: number;
  yesterday: number;
}

export interface SpendingInsight {
  text: string;
  type: 'warning' | 'info' | 'success';
  color: string;
}


/**
 * Calculate daily spending (today vs yesterday).
 * Uses string comparison on YYYY-MM-DD dates for timezone-safe logic.
 */
export function computeDailySpending(transactions: Transaction[]): DailySpending {
  const todayStr = getTodayStr();
  const yesterdayStr = getYesterdayStr();

  let today = 0;
  let yesterday = 0;

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const txDate = normaliseDate(tx.date);

    if (txDate === todayStr) {
      today += tx.amount;
    } else if (txDate === yesterdayStr) {
      yesterday += tx.amount;
    }
  }

  return { today, yesterday };
}

/**
 * Calculate budget status for all categories that have budgets set.
 */
export function computeBudgetStatuses(
  transactions: Transaction[],
  categories: Category[]
): BudgetStatus[] {
  const monthStart = getMonthStartStr();
  const nextMonthStart = getNextMonthStartStr();

  const statuses: BudgetStatus[] = [];

  for (const cat of categories) {
    if (!cat.budget || cat.budget <= 0) continue;

    let spent = 0;
    for (const tx of transactions) {
      if (tx.categoryId === cat.id && tx.type === 'expense') {
        const txDate = normaliseDate(tx.date);
        // String comparison works because YYYY-MM-DD is lexicographically ordered
        if (txDate >= monthStart && txDate < nextMonthStart) {
          spent += tx.amount;
        }
      }
    }

    const percentage = Math.min((spent / cat.budget) * 100, 100);
    const remaining = Math.max(cat.budget - spent, 0);

    statuses.push({
      categoryId: cat.id!,
      categoryName: cat.name,
      categoryColor: cat.color,
      budget: cat.budget,
      spent,
      remaining,
      percentage,
      isOverBudget: spent >= cat.budget,
      isNearLimit: percentage >= 80 && spent < cat.budget,
    });
  }

  return statuses;
}

/** First matching budget alert (over-budget takes precedence over near-limit). */
function buildBudgetAlert(
  budgetStatuses: BudgetStatus[],
  t: (key: string, options?: Record<string, string | number>) => string,
): SpendingInsight | null {
  for (const bs of budgetStatuses) {
    const categoryName = bs.categoryName === FALLBACK_CATEGORY_NAME ? t('Other') : bs.categoryName;
    if (bs.isOverBudget) {
      return {
        text: `${t('Budget alert')}: ${categoryName} ${t('exceeded budget')}!`,
        type: 'warning',
        color: 'text-white',
      };
    }
    if (bs.isNearLimit) {
      return {
        text: `${t('Budget alert')}: ${categoryName} ${t('near budget limit')}.`,
        type: 'info',
        color: 'text-white',
      };
    }
  }
  return null;
}

/** Insight when today's spending differs meaningfully from yesterday's. */
function buildDailyComparison(
  daily: DailySpending,
  t: (key: string, options?: Record<string, string | number>) => string,
): SpendingInsight | null {
  const { today, yesterday } = daily;
  if (today <= 0 || yesterday <= 0) return null;
  const diff = ((today - yesterday) / yesterday) * 100;
  if (Math.abs(diff) <= 10) return null;
  return {
    text: diff > 0
      ? t('Spending up compared to yesterday', { percent: diff.toFixed(0) })
      : t('Spending down compared to yesterday', { percent: Math.abs(diff).toFixed(0) }),
    type: diff > 0 ? 'warning' : 'success',
    color: 'text-white',
  };
}

/** Insight naming the top spending category for the current month. */
function buildTopCategoryInsight(
  transactions: Transaction[],
  categories: Category[],
  t: (key: string, options?: Record<string, string | number>) => string,
): SpendingInsight | null {
  const monthStart = getMonthStartStr();
  const nextMonthStart = getNextMonthStartStr();
  const monthTxs = transactions.filter(
    (tx) => tx.type === 'expense' && normaliseDate(tx.date) >= monthStart && normaliseDate(tx.date) < nextMonthStart
  );
  if (monthTxs.length === 0) return null;

  const catTotals: Record<number, number> = {};
  for (const tx of monthTxs) {
    if (tx.categoryId) catTotals[tx.categoryId] = (catTotals[tx.categoryId] || 0) + tx.amount;
  }

  const entries = Object.entries(catTotals);
  if (entries.length === 0) return null;
  const topEntry = entries.reduce((a, b) => (a[1] > b[1] ? a : b), entries[0] as [string, number]);
  const topCat = categories.find((c) => c.id === Number.parseInt(topEntry[0]));
  if (!topCat) return null;

  return {
    text: `${topCat.name} ${t('is your top spending category this month')}.`,
    type: 'info',
    color: 'text-white',
  };
}

/**
 * Generate a smart spending insight based on current data.
 * Returns null when no notable insight is found.
 */
export function generateInsight(
  transactions: Transaction[],
  categories: Category[],
  t: (key: string, options?: Record<string, string | number>) => string
): SpendingInsight | null {
  // 1. Budget alerts
  const budgetAlert = buildBudgetAlert(computeBudgetStatuses(transactions, categories), t);
  if (budgetAlert) return budgetAlert;

  // 2. Today vs Yesterday comparison
  const dailyComparison = buildDailyComparison(computeDailySpending(transactions), t);
  if (dailyComparison) return dailyComparison;

  // 3. Top spending category this month
  return buildTopCategoryInsight(transactions, categories, t);
}
