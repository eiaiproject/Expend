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

export type PayeeSortField = 'name' | 'totalExpense' | 'transactionCount' | 'averageAmount' | 'lastTransactionDate';

export interface PayeeSortConfig {
  field: PayeeSortField;
  order: 'asc' | 'desc';
}

export interface PayeeTransactionFilters {
  categoryIds?: number[];
  walletIds?: number[];
  startDate?: string;
  endDate?: string;
}

export interface PayeeAggregateFilters {
  minTotalExpense?: number;
  maxTotalExpense?: number;
  minTransactionCount?: number;
  maxTransactionCount?: number;
}

export interface GetPayeeStatsOptions {
  transactionFilters?: PayeeTransactionFilters;
  aggregateFilters?: PayeeAggregateFilters;
  sort?: PayeeSortConfig;
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
export async function getPayeeStatsFromTransactions(options?: GetPayeeStatsOptions): Promise<PayeeStats[]> {
  const { transactionFilters, aggregateFilters, sort } = options ?? {};

  // 1. Fetch expense transactions
  let transactions = await db.transactions
    .where('type')
    .equals('expense')
    .toArray();

  // 2. Apply transaction-level filters (before grouping)
  if (transactionFilters) {
    const { categoryIds, walletIds, startDate, endDate } = transactionFilters;
    if (categoryIds && categoryIds.length > 0) {
      transactions = transactions.filter(tx => tx.categoryId != null && categoryIds.includes(tx.categoryId));
    }
    if (walletIds && walletIds.length > 0) {
      transactions = transactions.filter(tx => walletIds.includes(tx.walletId));
    }
    if (startDate) {
      transactions = transactions.filter(tx => normaliseDate(tx.date) >= startDate);
    }
    if (endDate) {
      transactions = transactions.filter(tx => normaliseDate(tx.date) <= endDate);
    }
  }

  // 3. Group into payee stats
  const payeeMap = new Map<string, {
    name: string,
    total: number,
    count: number,
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

  // 4. Apply aggregate-level filters (after grouping)
  let filtered = results;
  if (aggregateFilters) {
    const { minTotalExpense, maxTotalExpense, minTransactionCount, maxTransactionCount } = aggregateFilters;
    if (minTotalExpense != null) {
      filtered = filtered.filter(p => p.totalExpense >= minTotalExpense);
    }
    if (maxTotalExpense != null) {
      filtered = filtered.filter(p => p.totalExpense <= maxTotalExpense);
    }
    if (minTransactionCount != null) {
      filtered = filtered.filter(p => p.transactionCount >= minTransactionCount);
    }
    if (maxTransactionCount != null) {
      filtered = filtered.filter(p => p.transactionCount <= maxTransactionCount);
    }
  }

  // 5. Sort
  if (sort) {
    const { field, order } = sort;
    const dir = order === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return dir * aVal.localeCompare(bVal);
      }
      return dir * ((aVal as number) - (bVal as number));
    });
  } else {
    filtered.sort((a, b) => b.totalExpense - a.totalExpense);
  }

  return filtered;
}

/**
 * Filters transactions by a specific payee name.
 */
export async function filterTransactionsByPayee(
  payeeName: string,
  transactionFilters?: PayeeTransactionFilters,
): Promise<Transaction[]> {
  const payeeKey = normalizePayeeKey(payeeName);
  let transactions = await db.transactions
    .where('type')
    .equals('expense')
    .toArray();

  // Filter by payee first
  transactions = transactions.filter(tx => normalizePayeeKey(tx.description) === payeeKey);

  // Apply additional transaction-level filters
  if (transactionFilters) {
    const { categoryIds, walletIds, startDate, endDate } = transactionFilters;
    if (categoryIds && categoryIds.length > 0) {
      transactions = transactions.filter(tx => tx.categoryId != null && categoryIds.includes(tx.categoryId));
    }
    if (walletIds && walletIds.length > 0) {
      transactions = transactions.filter(tx => walletIds.includes(tx.walletId));
    }
    if (startDate) {
      transactions = transactions.filter(tx => normaliseDate(tx.date) >= startDate);
    }
    if (endDate) {
      transactions = transactions.filter(tx => normaliseDate(tx.date) <= endDate);
    }
  }

  return transactions;
}
