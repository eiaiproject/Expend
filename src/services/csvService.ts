import { db } from '../db/db';
import Papa from 'papaparse';
import { sanitizeCsvRows } from './importExportService';
import { getTodayStr } from '../utils/dateUtils';
import { downloadBlob } from '../utils/downloadUtils';
import { VALID_TX_TYPES } from '../utils/constants';
import { recomputeWalletCurrentBalances } from '../utils/balanceUtils';
import { ensureMerchant } from './merchantService';

export interface TransactionCsvRow {
  date: string;
  wallet: string;
  category: string;
  recipient: string;
  amount: string;
  notes: string;
  type: string;
  transferGroupId: string;
}

export interface DebtCsvRow {
  type: string;
  personName: string;
  title: string;
  principalAmount: string;
  remainingAmount: string;
  wallet: string;
  startDate: string;
  dueDate: string;
  status: string;
  notes: string;
}

export interface DebtPaymentCsvRow {
  debtId: string;
  personName: string;
  date: string;
  wallet: string;
  amount: string;
  paymentType: string;
  notes: string;
}

/**
 * Export transactions to CSV.
 */
export async function exportTransactionsCsv(): Promise<void> {
  const transactions = await db.transactions.toArray();
  const wallets = await db.wallets.toArray();
  const categories = await db.categories.toArray();

  const walletMap = new Map(wallets.map(w => [w.id!, w.name]));
  const categoryMap = new Map(categories.map(c => [c.id!, c.name]));

  const rows: TransactionCsvRow[] = transactions.map(tx => ({
    date: tx.date,
    wallet: walletMap.get(tx.walletId) || 'Unknown',
    category: tx.categoryId ? categoryMap.get(tx.categoryId!) || 'Unknown' : '',
    recipient: tx.description,
    amount: tx.amount.toString(),
    notes: tx.notes || '',
    type: tx.type,
    transferGroupId: tx.transferGroupId || '',
  }));

  const csv = Papa.unparse(sanitizeCsvRows(rows));

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `expend_transactions_${getTodayStr()}.csv`);
}

/**
 * Export debts to CSV.
 */
export async function exportDebtsCsv(): Promise<void> {
  const debts = await db.debts.toArray();
  const wallets = await db.wallets.toArray();
  const walletMap = new Map(wallets.map(w => [w.id!, w.name]));

  const rows: DebtCsvRow[] = debts.map(d => ({
    type: d.type,
    personName: d.personName,
    title: d.title || '',
    principalAmount: d.principalAmount.toString(),
    remainingAmount: d.remainingAmount.toString(),
    wallet: walletMap.get(d.walletId) || 'Unknown',
    startDate: d.startDate,
    dueDate: d.dueDate || '',
    status: d.status || 'open',
    notes: d.notes || '',
  }));

  const csv = Papa.unparse(sanitizeCsvRows(rows));

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `expend_debts_${getTodayStr()}.csv`);
}

/**
 * Export debt payments to CSV.
 */
export async function exportDebtPaymentsCsv(): Promise<void> {
  const payments = await db.debtPayments.toArray();
  const debts = await db.debts.toArray();
  const wallets = await db.wallets.toArray();
  
  const debtMap = new Map(debts.map(d => [d.id, d.personName]));
  const walletMap = new Map(wallets.map(w => [w.id!, w.name]));

  const rows: DebtPaymentCsvRow[] = payments.map(p => ({
    debtId: p.debtId,
    personName: debtMap.get(p.debtId) || 'Unknown',
    date: p.date,
    wallet: walletMap.get(p.walletId) || 'Unknown',
    amount: p.amount.toString(),
    paymentType: p.type,
    notes: p.notes || '',
  }));

  const csv = Papa.unparse(sanitizeCsvRows(rows));

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `expend_payments_${getTodayStr()}.csv`);
}

/**
 * Parse and validate CSV transaction rows.
 */
export async function parseTransactionsCsv(file: File): Promise<{ rows: any[]; errors: string[] }> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        const errors: string[] = [];
        const validRows: any[] = [];

        const wallets = await db.wallets.toArray();
        const walletMap = new Map(wallets.map(w => [w.name.toLowerCase(), w.id!]));
        const categories = await db.categories.toArray();
        const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id!]));

        rows.forEach((row: any, index: number) => {
          const rowNum = index + 1;
          const date = row.date;
          const walletName = row.wallet;
          const categoryName = row.category;
          const recipient = row.recipient;
          const amountStr = row.amount;
          const type = row.type;

          if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            errors.push(`Row ${rowNum}: Invalid date format (expected YYYY-MM-DD).`);
            return;
          }

          if (!walletName || !walletMap.has(walletName.toLowerCase())) {
            errors.push(`Row ${rowNum}: Wallet "${walletName}" not found.`);
            return;
          }

          if (type === 'expense') {
            if (!recipient || recipient.trim() === '') {
              errors.push(`Row ${rowNum}: Recipient is required for expenses.`);
              return;
            }
            if (!categoryName || !categoryMap.has(categoryName.toLowerCase())) {
              errors.push(`Row ${rowNum}: Category "${categoryName}" not found.`);
              return;
            }
          }

          if (!type || !VALID_TX_TYPES.includes(type as typeof VALID_TX_TYPES[number])) {
            errors.push(`Row ${rowNum}: Invalid type "${type}". Allowed: ${VALID_TX_TYPES.join(', ')}.`);
            return;
          }

          const amount = Number.parseFloat(amountStr);
          if (!Number.isFinite(amount)) {
            errors.push(`Row ${rowNum}: Amount must be a valid number.`);
            return;
          }

          if (type === 'balance_adjustment') {
            if (amount === 0) {
              errors.push(`Row ${rowNum}: Balance adjustment amount must not be zero.`);
              return;
            }
          } else if (amount <= 0) {
            errors.push(`Row ${rowNum}: Amount must be a positive number.`);
            return;
          }

          validRows.push({
            date,
            walletId: walletMap.get(walletName.toLowerCase()!),
            categoryId: type === 'expense' ? categoryMap.get(categoryName.toLowerCase()!) : null,
            description: recipient || 'Imported',
            amount,
            type,
            notes: row.notes || '',
            transferGroupId: row.transferGroupId || undefined,
          });
        });

        resolve({ rows: validRows, errors });
      },
    });
  });
}

/**
 * Import validated CSV transactions.
 */
export async function importCsvTransactions(rows: any[]): Promise<void> {
  await db.transaction('rw', [db.transactions, db.wallets, db.debts, db.debtPayments, db.merchants], async () => {
    for (const row of rows) {
      await db.transactions.add(row);
      // Auto-create merchant entry for expenses
      if (row.type === 'expense' && row.description) {
        await ensureMerchant(row.description);
      }
    }

    const wallets = await db.wallets.toArray();
    const transactions = await db.transactions.toArray();
    const debts = await db.debts.toArray();
    const debtPayments = await db.debtPayments.toArray();
    
    const recomputed = recomputeWalletCurrentBalances(wallets, transactions, debts, debtPayments);
    for (const w of recomputed) {
      await db.wallets.update(w.id!, {
        currentBalance: w.currentBalance,
        lastUpdated: new Date().toISOString(),
      });
    }
  });
}
