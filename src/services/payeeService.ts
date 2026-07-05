import { db, type Transaction } from '../db/db';
import { normaliseDate } from '../utils/dateUtils';

export interface PayeeStats {
  key: string;
  name: string;
  totalExpense: number;
  transactionCount: number;
  averageAmount: number;
  lastTransactionDate: string;
  mostCommonCategory: number | null;
  mostCommonWallet: number;
}

/**
 * Normalizes payee name for display.
 * - Trims whitespace
 * - Collapses repeated spaces
 * - Preserves user casing, including acronyms and brand casing
 */
export function normalizePayeeName(raw: string): string {
  if (!raw) return '';
  return raw.trim().replace(/\s+/g, ' ');
}

/**
 * Normalizes payee name for case-insensitive grouping.
 */
export function normalizePayeeKey(raw: string): string {
  return normalizePayeeName(raw).toLowerCase();
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
    name: string,
    total: number,
    count: 0,
    dates: string[],
    categories: Record<number, number>,
    wallets: Record<number, number>
  }>();

  for (const tx of transactions) {
    const name = normalizePayeeName(tx.description);
    const key = normalizePayeeKey(tx.description);
    if (!key) continue;

    if (!payeeMap.has(key)) {
      payeeMap.set(key, {
        name,
        total: 0,
        count: 0,
        dates: [],
        categories: {},
        wallets: {},
      });
    }

    const stats = payeeMap.get(key)!;
    stats.total += tx.amount;
    stats.count++;
    stats.dates.push(normaliseDate(tx.date));
    
    if (tx.categoryId) {
      stats.categories[tx.categoryId] = (stats.categories[tx.categoryId] || 0) + 1;
    }
    stats.wallets[tx.walletId] = (stats.wallets[tx.walletId] || 0) + 1;
  }

  const results: PayeeStats[] = [];

  for (const [key, data] of payeeMap.entries()) {
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
      key,
      name: data.name,
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
  const payeeKey = normalizePayeeKey(payeeName);
  const transactions = await db.transactions
    .where('type')
    .equals('expense')
    .toArray();
  return transactions.filter(tx => normalizePayeeKey(tx.description) === payeeKey);
}
