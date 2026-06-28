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
    const lastTransactionDate = data.dates.sort().reverse()[0];
    
    const mostCommonCategory = Object.entries(data.categories)
      .reduce((a, b) => (a[1] > b[1] ? a : b), [null, 0])[0] 
      ? parseInt(Object.entries(data.categories).reduce((a, b) => (a[1] > b[1] ? a : b))[0])
      : null;

    const mostCommonWallet = parseInt(
      Object.entries(data.wallets).reduce((a, b) => (a[1] > b[1] ? a : b))[0]
    );

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
 * Returns a list of suggested payees based on a query.
 */
export async function getPayeeSuggestions(query: string): Promise<string[]> {
  if (!query.trim()) return [];
  
  const transactions = await db.transactions
    .where('type')
    .equals('expense')
    .toArray();

  const payees = new Set<string>();
  const normalizedQuery = query.toLowerCase().trim();

  for (const tx of transactions) {
    const desc = tx.description;
    if (desc.toLowerCase().includes(normalizedQuery)) {
      payees.add(normalizePayeeName(desc));
    }
  }

  return Array.from(payees).slice(0, 10);
}

/**
 * Filters transactions by a specific payee name.
 */
export async function filterTransactionsByPayee(payeeName: string): Promise<Transaction[]> {
  const transactions = await db.transactions.toArray();
  return transactions.filter(tx => normalizePayeeName(tx.description) === payeeName);
}
