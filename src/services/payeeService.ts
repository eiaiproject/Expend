import { db, type Transaction } from '../db/db';
import { normaliseDate } from '../utils/dateUtils';

export interface PayeeStats {
  name: string;
  totalExpense: number;
  transactionCount: number;
  averageAmount: number;
  lastTransactionDate: string;
  mostCommonCategory: number | null;
  mostCommonWallet: number;
}

/**
 * Normalizes payee name for consistent grouping.
 * - Trims whitespace
 * - Collapses repeated spaces
 * - Normalizes case for grouping but preserves a "nice" display name
 */
export function normalizePayeeName(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  // Simple title casing for display
  return trimmed
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generates a list of payees and their statistics from expense transactions.
 */
export async function getPayeeStatsFromTransactions(): Promise<PayeeStats[]> {
  const transactions = await db.transactions
    .where('type')
    .equals('expense')
    .toArray();

  const categories = await db.categories.toArray();
  const wallets = await db.wallets.toArray();

  const payeeMap = new Map<string, {
    total: number,
    count: 0,
    dates: string[],
    categories: Record<number, number>,
    wallets: Record<number, number>
  }>();

  for (const tx of transactions) {
    const normalized = normalizePayeeName(tx.description);
    if (!normalized) continue;

    if (!payeeMap.has(normalized)) {
      payeeMap.set(normalized, {
        total: 0,
        count: 0,
        dates: [],
        categories: {},
        wallets: {},
      });
    }

    const stats = payeeMap.get(normalized)!;
    stats.total += tx.amount;
    stats.count++;
    stats.dates.push(normaliseDate(tx.date));
    
    if (tx.categoryId) {
      stats.categories[tx.categoryId] = (stats.categories[tx.categoryId] || 0) + 1;
    }
    stats.wallets[tx.walletId] = (stats.wallets[tx.walletId] || 0) + 1;
  }

  const results: PayeeStats[] = [];

  for (const [name, data] of payeeMap.entries()) {
    const lastTransactionDate = data.dates.sort().reverse()[0] || '1970-01-01';
    
    const categoryEntries = Object.entries(data.categories);
    let mostCommonCategory: number | null = null;
    if (categoryEntries.length > 0) {
      const [catId] = categoryEntries.reduce((a, b) => (a[1] > b[1] ? a : b));
      mostCommonCategory = parseInt(catId);
    }

    const walletEntries = Object.entries(data.wallets);
    let mostCommonWallet: number = 1;
    if (walletEntries.length > 0) {
      const [walletId] = walletEntries.reduce((a, b) => (a[1] > b[1] ? a : b));
      mostCommonWallet = parseInt(walletId);
    }

    results.push({
      name,
      totalExpense: data.total,
      transactionCount: data.count,
      averageAmount: data.total / data.count,
      lastTransactionDate,
      mostCommonCategory,
      mostCommonWallet,
    });
  }

  return results.sort((a, b) => b.totalExpense - a.totalExpense);
}

/**
 * Filters transactions by a specific payee name.
 */
export async function filterTransactionsByPayee(payeeName: string): Promise<Transaction[]> {
  const transactions = await db.transactions.toArray();
  return transactions.filter(tx => normalizePayeeName(tx.description) === payeeName);
}
