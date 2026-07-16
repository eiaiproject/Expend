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

interface GetPayeeStatsOptions {
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
 * Apply category/wallet/date filters to expense transactions.
 */
function applyTransactionFilters(
  transactions: Transaction[],
  filters?: PayeeTransactionFilters,
): Transaction[] {
  if (!filters) return transactions;
  const { categoryIds, walletIds, startDate, endDate } = filters;
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
  return transactions;
}

/**
 * Generates a list of payees and their statistics from expense transactions.
 */
export async function getPayeeStatsFromTransactions(options?: GetPayeeStatsOptions): Promise<PayeeStats[]> {
  const { transactionFilters, aggregateFilters, sort } = options ?? {};

  // 1. Fetch and filter expense transactions
  let transactions = await db.transactions
    .where('type')
    .equals('expense')
    .toArray();

  transactions = applyTransactionFilters(transactions, transactionFilters);

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
      const [catId] = categoryEntries.reduce((a, b) => (a[1] > b[1] ? a : b), categoryEntries[0]!);
      mostCommonCategory = Number.parseInt(catId);
    }

    const walletEntries = Object.entries(data.wallets);
    let mostCommonWallet: number = 1;
    if (walletEntries.length > 0) {
      const [walletId] = walletEntries.reduce((a, b) => (a[1] > b[1] ? a : b), walletEntries[0]!);
      mostCommonWallet = Number.parseInt(walletId);
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
    filtered = applyAggregateFilters(filtered, aggregateFilters);
  }

  // 5. Sort
  filtered = sortPayeeStats(filtered, sort);

  return filtered;
}

/**
 * Apply aggregate-level filters to payee stats.
 */
function applyAggregateFilters(
  payees: PayeeStats[],
  filters: PayeeAggregateFilters,
): PayeeStats[] {
  const { minTotalExpense, maxTotalExpense, minTransactionCount, maxTransactionCount } = filters;
  return payees.filter(p =>
    (minTotalExpense == null || p.totalExpense >= minTotalExpense) &&
    (maxTotalExpense == null || p.totalExpense <= maxTotalExpense) &&
    (minTransactionCount == null || p.transactionCount >= minTransactionCount) &&
    (maxTransactionCount == null || p.transactionCount <= maxTransactionCount)
  );
}

/**
 * Sort payee stats by field and order.
 */
function sortPayeeStats(
  payees: PayeeStats[],
  sort?: PayeeSortConfig,
): PayeeStats[] {
  if (!sort) return [...payees].sort((a, b) => b.totalExpense - a.totalExpense);
  const { field, order } = sort;
  const dir = order === 'asc' ? 1 : -1;
  return [...payees].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return dir * aVal.localeCompare(bVal);
    }
    return dir * ((aVal as number) - (bVal as number));
  });
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

  transactions = transactions.filter(tx => normalizePayeeKey(tx.description) === payeeKey);
  return applyTransactionFilters(transactions, transactionFilters);
}
