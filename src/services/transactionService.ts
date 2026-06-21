import { db, Transaction, type Category, type Wallet } from '../db/db';

export interface TransactionSummary {
  totalExpense: number;
  totalIncome: number;
  totalTransferIn: number;
  totalTransferOut: number;
  totalAdjustment: number;
  netCashflow: number;
}

/**
 * Get all transactions for a given period (date range).
 * Uses compound index [type+date] for faster queries when type is specified.
 */
export async function getTransactionsByDateRange(
  startDate: string,
  endDate: string,
  type?: Transaction['type']
): Promise<Transaction[]> {
  if (type) {
    // Use compound index [type+date] for efficient filtered queries
    return db.transactions
      .where('[type+date]')
      .between([type, startDate], [type, endDate], true, true)
      .toArray();
  }
  return db.transactions
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray();
}

/**
 * Get transactions for a specific wallet within a date range.
 * Uses compound index [walletId+date].
 */
export async function getWalletTransactions(
  walletId: number,
  startDate?: string,
  endDate?: string
): Promise<Transaction[]> {
  if (startDate && endDate) {
    return db.transactions
      .where('[walletId+date]')
      .between([walletId, startDate], [walletId, endDate], true, true)
      .toArray();
  }
  return db.transactions.where('walletId').equals(walletId).toArray();
}

/**
 * Get transactions by type within a date range.
 * Uses compound index [type+date].
 */
export async function getTransactionsByType(
  type: Transaction['type'],
  startDate?: string,
  endDate?: string
): Promise<Transaction[]> {
  if (startDate && endDate) {
    return db.transactions
      .where('[type+date]')
      .between([type, startDate], [type, endDate], true, true)
      .toArray();
  }
  return db.transactions.where('type').equals(type).toArray();
}

/**
 * Compute wallet balance based on all transactions.
 * More efficient than per-transaction iteration by aggregating in a single pass.
 */
export async function computeWalletBalance(walletId: number, initialBalance: number): Promise<number> {
  const transactions = await db.transactions
    .where('walletId')
    .equals(walletId)
    .toArray();

  let balance = initialBalance;
  for (const tx of transactions) {
    if (tx.type === 'expense' || tx.type === 'transfer_out') {
      balance -= tx.amount;
    } else {
      balance += tx.amount;
    }
  }
  return balance;
}

/**
 * Compute balances for all wallets in a single query pass.
 */
export async function computeAllWalletBalances(walletIds: number[]): Promise<Record<number, number>> {
  if (walletIds.length === 0) return {};

  const allTxs = await db.transactions
    .where('walletId')
    .anyOf(walletIds)
    .toArray();

  const balances: Record<number, number> = {};
  for (const tx of allTxs) {
    const isNegative = tx.type === 'expense' || tx.type === 'transfer_out';
    const change = isNegative ? -tx.amount : tx.amount;
    balances[tx.walletId] = (balances[tx.walletId] || 0) + change;
  }
  return balances;
}

/**
 * Get transaction summary (total expense, income, etc) with a single DB pass.
 */
export async function getTransactionSummary(): Promise<TransactionSummary> {
  const allTx = await db.transactions.toArray();

  const summary: TransactionSummary = {
    totalExpense: 0,
    totalIncome: 0,
    totalTransferIn: 0,
    totalTransferOut: 0,
    totalAdjustment: 0,
    netCashflow: 0,
  };

  for (const tx of allTx) {
    switch (tx.type) {
      case 'expense':
        summary.totalExpense += tx.amount;
        break;
      case 'balance_adjustment':
        summary.totalAdjustment += tx.amount;
        break;
      case 'transfer_in':
        summary.totalTransferIn += tx.amount;
        break;
      case 'transfer_out':
        summary.totalTransferOut += tx.amount;
        break;
    }
  }

  summary.netCashflow = summary.totalAdjustment + summary.totalTransferIn - summary.totalTransferOut - summary.totalExpense;
  return summary;
}

/**
 * Map categories by ID for O(1) lookups.
 */
export function buildCategoryMap(categories: Category[]): Record<number, Category> {
  const map: Record<number, Category> = {};
  for (const cat of categories) {
    if (cat.id != null) map[cat.id] = cat;
  }
  return map;
}

/**
 * Map wallets by ID for O(1) lookups.
 */
export function buildWalletMap(wallets: Wallet[]): Record<number, Wallet> {
  const map: Record<number, Wallet> = {};
  for (const w of wallets) {
    if (w.id != null) map[w.id] = w;
  }
  return map;
}
