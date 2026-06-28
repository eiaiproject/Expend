import { db, Transaction, Category } from '../db/db';
import { parseDate } from '../utils/dateUtils';
import i18n from '../i18n/init';
import { getTransactionsByDateRange } from './transactionService';

export interface MonthlyReportData {
  month: number;
  year: number;
  monthName: string;
  totalExpense: number;
  avgDailyExpense: number;
  highestDayExpense: number;
  lowestDayExpense: number;
  categoryBreakdown: CategoryBreakdownItem[];
  healthScore: number;
  healthLabel: string;
  healthColor: string;
  insights: InsightItem[];
  transactionCount: number;
}

export interface CategoryBreakdownItem {
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  total: number;
  percentage: number;
  transactionCount: number;
}

export interface InsightItem {
  type: 'warning' | 'success' | 'info' | 'tip';
  icon: string;
  title: string;
  description: string;
}



/**
 * Get the previous month's date range.
 */
function getPreviousMonthRange(): { start: Date; end: Date; month: number; year: number } {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const month = lastMonth.getMonth();
  const year = lastMonth.getFullYear();
  
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59);
  
  return { start, end, month, year };
}

/**
 * Format date to YYYY-MM-DD string.
 */
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get month name based on locale.
 */
function getMonthName(month: number, locale: string = 'id'): string {
  // Use Intl for proper locale handling
  const date = new Date(2024, month, 1);
  return new Intl.DateTimeFormat(locale, { month: 'long' }).format(date);
}

/**
 * Generate comprehensive monthly report data.
 */
export async function generateMonthlyReport(locale: string = 'id'): Promise<MonthlyReportData | null> {
  const { start, end, month, year } = getPreviousMonthRange();
  const startDateStr = formatDate(start);
  const endDateStr = formatDate(end);
  
  // Get only expense transactions for the previous month report window.
  const transactions = await getTransactionsByDateRange(startDateStr, endDateStr, 'expense');
  
  if (transactions.length === 0) {
    return null; // No expense data for previous month
  }
  
  const categories = await db.categories.toArray();
  const categoryMap: Record<number, Category> = {};
  categories.forEach(c => { if (c.id) categoryMap[c.id] = c; });
  
  // All fetched transactions are already expenses (filtered by type above)
  const expenses = transactions;
  
  // Calculate totals
  const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);
  
  // Daily expense calculation
  const daysInMonth = end.getDate();
  const dailyExpenses: Record<number, number> = {};
  
  for (let d = 1; d <= daysInMonth; d++) {
    dailyExpenses[d] = 0;
  }
  
  expenses.forEach(t => {
    const tDate = parseDate(t.date);
    const day = tDate.getUTCDate();
    dailyExpenses[day] = (dailyExpenses[day] || 0) + t.amount;
  });
  
  const avgDailyExpense = daysInMonth > 0 
    ? totalExpense / daysInMonth 
    : 0;

  const dailyExpenseValues = Object.values(dailyExpenses);
  const highestDayExpense = dailyExpenseValues.length > 0 ? Math.max(...dailyExpenseValues) : 0;
  const lowestDayExpense = dailyExpenseValues.length > 0 ? Math.min(...dailyExpenseValues) : 0;
  
  // Category breakdown
  const categoryTotals: Record<number, { total: number; count: number }> = {};
  expenses.forEach(t => {
    const catId = t.categoryId || 0;
    if (!categoryTotals[catId]) {
      categoryTotals[catId] = { total: 0, count: 0 };
    }
    categoryTotals[catId].total += t.amount;
    categoryTotals[catId].count++;
  });
  
  const categoryBreakdown: CategoryBreakdownItem[] = Object.entries(categoryTotals)
    .map(([catId, data]) => {
      const cat = categoryMap[parseInt(catId)];
      return {
        categoryId: parseInt(catId),
        categoryName: cat?.name || i18n.t('Other'),
        categoryColor: cat?.color || '#6B7280',
        total: data.total,
        percentage: totalExpense > 0 ? (data.total / totalExpense) * 100 : 0,
        transactionCount: data.count,
      };
    })
    .sort((a, b) => b.total - a.total);
  

  
  // Health score calculation
  const healthScore = calculateHealthScore(totalExpense, expenses, categoryBreakdown);
  const healthLabel = getHealthLabel(healthScore);
  const healthColor = getHealthColor(healthScore);
  
  const insights = generateInsights(
    totalExpense, 
    categoryBreakdown, 
    avgDailyExpense
  );
  
  return {
    month,
    year,
    monthName: getMonthName(month, locale),
    totalExpense,
    avgDailyExpense,
    highestDayExpense: dailyExpenseValues.length > 0 ? Math.max(...dailyExpenseValues) : 0,
    lowestDayExpense: dailyExpenseValues.length > 0 ? Math.min(...dailyExpenseValues) : 0,
    categoryBreakdown,
    healthScore,
    healthLabel,
    healthColor,
    insights,
    transactionCount: expenses.length,
  };
}

/**
 * Calculate financial health score (0-100).
 */
function calculateHealthScore(
  totalExpense: number,
  expenses: Transaction[],
  categoryBreakdown: CategoryBreakdownItem[]
): number {
  let score = 50; // Base score
  
  // Category diversification
  if (categoryBreakdown.length >= 3) score += 10;
  if (categoryBreakdown.length >= 5) score += 5;
  
  // Top category dominance (lower is better)
  if (categoryBreakdown.length > 0) {
    const topCategoryPercentage = categoryBreakdown[0]?.percentage ?? 0;
    if (topCategoryPercentage <= 30) score += 10; // Well diversified
    else if (topCategoryPercentage <= 50) score += 5; // Moderate
    else score -= 5; // Too concentrated
  }
  
  // Transaction consistency (more transactions = more tracking)
  if (expenses.length >= 20) score += 5;
  
  // Spending trend (compared to previous month)
  // This is already factored in via insights
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Get health label based on score.
 */
function getHealthLabel(score: number): string {
  const t = i18n.t.bind(i18n);
  if (score >= 80) return t('Health Excellent');
  if (score >= 60) return t('Health Good');
  if (score >= 40) return t('Health Fair');
  if (score >= 20) return t('Health Needs Attention');
  return t('Health Critical');
}

/**
 * Get health color based on score.
 */
function getHealthColor(score: number): string {
  // Returns CSS variable names for theme consistency
  if (score >= 80) return 'var(--color-success, #10B981)';
  if (score >= 60) return 'var(--color-info, #3B82F6)';
  if (score >= 40) return 'var(--color-warning, #F59E0B)';
  if (score >= 20) return 'var(--color-warning, #F97316)';
  return 'var(--color-error, #EF4444)';
}

/**
 * Generate insights based on spending patterns.
 */
function generateInsights(
  totalExpense: number,
  categoryBreakdown: CategoryBreakdownItem[],
  avgDailyExpense: number
): InsightItem[] {
  const t = i18n.t.bind(i18n);
  const insights: InsightItem[] = [];
  
  if (categoryBreakdown.length > 0) {
    const top = categoryBreakdown[0];
    if (top && top.percentage > 40) {
      insights.push({
        type: 'warning',
        icon: '!',
        title: t('Insight Expense Concentration'),
        description: t('Insight Expense Concentration Desc', { name: top.categoryName, pct: top.percentage.toFixed(0) }),
      });
    } else if (top) {
      insights.push({
        type: 'success',
        icon: '+',
        title: t('Insight Good Diversification'),
        description: t('Insight Good Diversification Desc', { count: categoryBreakdown.length }),
      });
    }
  }
  
  const foodCategory = categoryBreakdown.find(c => 
    c.categoryName.toLowerCase().includes('food') || 
    c.categoryName.toLowerCase().includes('makan')
  );
  if (foodCategory && foodCategory.percentage > 30) {
    insights.push({
      type: 'tip',
      icon: '~',
      title: t('Insight Food Saving Tip'),
      description: t('Insight Food Saving Tip Desc', { pct: foodCategory.percentage.toFixed(0) }),
    });
  }
  
  if (avgDailyExpense > 0) {
    insights.push({
      type: 'tip',
      icon: '*',
      title: t('Insight Daily Average'),
      description: t('Insight Daily Average Desc', { amount: avgDailyExpense.toLocaleString('id-ID') }),
    });
  }
  
  return insights.slice(0, 5);
}

/**
 * Check if the user should see the monthly report popup.
 * Returns true if:
 * 1. It's the 1st-3rd of the month
 * 2. User hasn't dismissed/skipped the report for this month yet
 */
export function shouldShowMonthlyReport(): boolean {
  try {
    const now = new Date();
    const dayOfMonth = now.getDate();
    
    // Show on days 1-3 of the month
    if (dayOfMonth > 3) return false;
    
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dismissedKey = `expend_report_dismissed_${currentMonthKey}`;
    const downloadedKey = `expend_report_downloaded_${currentMonthKey}`;
    
    if (localStorage.getItem(dismissedKey) === 'true') return false;
    if (localStorage.getItem(downloadedKey) === 'true') return false;
    
    return true;
  } catch {
    // Private browsing or storage full — don't block app
    return false;
  }
}

/**
 * Mark the report as dismissed for the current month.
 */
export function dismissMonthlyReport(): void {
  try {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    localStorage.setItem(`expend_report_dismissed_${currentMonthKey}`, 'true');
  } catch { /* storage unavailable */ }
}

/**
 * Mark the report as downloaded for the current month.
 */
export function markReportDownloaded(): void {
  try {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    localStorage.setItem(`expend_report_downloaded_${currentMonthKey}`, 'true');
  } catch { /* storage unavailable */ }
}

/**
 * Get previous month name for display.
 */
export function getPreviousMonthName(locale: string = 'id'): string {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return getMonthName(lastMonth.getMonth(), locale);
}
