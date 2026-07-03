import { Transaction, Category } from '../db/db';
import { parseDate, getTodayStr, getYesterdayStr, getMonthStartStr, getNextMonthStartStr, normaliseDate } from '../utils/dateUtils';

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
 * Compute month boundaries for the current month as YYYY-MM-DD strings.
 * Uses local date strings to avoid timezone-induced day shifting.
 */
export function getMonthBoundaries(): { start: string; end: string } {
  return { start: getMonthStartStr(), end: getNextMonthStartStr() };
}

/**
 * Get today and yesterday as YYYY-MM-DD strings.
 */
export function getDayBoundaries(): { todayStr: string; yesterdayStr: string } {
  return { todayStr: getTodayStr(), yesterdayStr: getYesterdayStr() };
}

/**
 * Calculate daily spending (today vs yesterday).
 * Uses string comparison on YYYY-MM-DD dates for timezone-safe logic.
 */
export function computeDailySpending(transactions: Transaction[]): DailySpending {
  const { todayStr, yesterdayStr } = getDayBoundaries();

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
  const { start: monthStart, end: nextMonthStart } = getMonthBoundaries();

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

/**
 * Generate a smart spending insight based on current data.
 * Returns null when no notable insight is found.
 */
export function generateInsight(
  transactions: Transaction[],
  categories: Category[],
  t: (key: string) => string
): SpendingInsight | null {
  // 1. Budget alerts
  const budgetStatuses = computeBudgetStatuses(transactions, categories);
  for (const bs of budgetStatuses) {
    if (bs.isOverBudget) {
      return {
        text: `${t('Budget alert')}: ${bs.categoryName} ${t('exceeded budget')}!`,
        type: 'warning',
        color: 'text-white',
      };
    }
    if (bs.isNearLimit) {
      return {
        text: `${t('Budget alert')}: ${bs.categoryName} ${t('near budget limit')}.`,
        type: 'info',
        color: 'text-white',
      };
    }
  }

  // 2. Today vs Yesterday comparison
  const todayResult = computeDailySpending(transactions);
  const { today, yesterday } = todayResult;
  if (today > 0 && yesterday > 0) {
    const diff = ((today - yesterday) / yesterday) * 100;
    if (Math.abs(diff) > 10) {
      return {
        text: diff > 0
          ? `${t('Spending up')} ${diff.toFixed(0)}% compared to yesterday.`
          : `${t('Spending down')} ${Math.abs(diff).toFixed(0)}% compared to yesterday.`,
        type: diff > 0 ? 'warning' : 'success',
        color: 'text-white',
      };
    }
  }

  // 3. Top spending category this month
  const monthBoundaries = getMonthBoundaries();
  const monthStart = monthBoundaries.start;
  const nextMonthStart = monthBoundaries.end;
  const monthTxs = transactions.filter(
    (t) => t.type === 'expense' && normaliseDate(t.date) >= monthStart && normaliseDate(t.date) < nextMonthStart
  );

  if (monthTxs.length > 0) {
    const catTotals: Record<number, number> = {};
    for (const tx of monthTxs) {
      if (tx.categoryId) catTotals[tx.categoryId] = (catTotals[tx.categoryId] || 0) + tx.amount;
    }

    const entries = Object.entries(catTotals);
    if (entries.length > 0) {
      const topEntry = entries.reduce((a, b) => (a[1] > b[1] ? a : b));
      const topCatId = parseInt(topEntry[0]);
      const topCat = categories.find((c) => c.id === topCatId);

      if (topCat) {
        return {
          text: `${topCat.name} ${t('is your top spending category this month')}.`,
          type: 'info',
          color: 'text-white',
        };
      }
    }
  }

  return null;
}
