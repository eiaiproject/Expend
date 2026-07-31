import { db } from '../db/db';
import Papa from 'papaparse';
import { sanitizeCsvRows, sanitizeCsvField } from './importExportService';
import { createDataSnapshot, restoreFromSnapshot, incrementChangeCount } from './backupService';
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
            // Formula-injection guard (master.md 11): strings that look like
            // spreadsheet formulas are stored as literal text.
            description: sanitizeCsvField(recipient || 'Imported') as string,
            amount,
            type,
            notes: sanitizeCsvField(row.notes || '') as string,
            transferGroupId: row.transferGroupId || undefined,
          });
        });

        resolve({ rows: validRows, errors });
      },
    });
  });
}

/**
 * Normalize free text so 'Kopi Senja', 'kopi  senja' and 'KOPI SENJA' fingerprint alike.
 */
export function normalizeFingerprintText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Testable transaction fingerprint (master.md 11): date, amount, type, wallet
 * and normalized description. Enough to catch a re-imported CSV without
 * treating every repeated coffee as a duplicate.
 */
export function computeTransactionFingerprint(row: {
  date: string;
  amount: number;
  type: string;
  walletId?: number;
  description?: string;
}): string {
  return [row.date, row.amount, row.type, row.walletId ?? '', normalizeFingerprintText(row.description ?? '')].join('|');
}

/** Load every existing transaction fingerprint from the DB (master.md 11). */
export async function loadExistingFingerprints(): Promise<Set<string>> {
  const transactions = await db.transactions.toArray();
  return new Set(transactions.map((t) => computeTransactionFingerprint({
    date: t.date,
    amount: t.amount,
    type: t.type,
    walletId: t.walletId,
    description: t.description,
  })));
}

/**
 * Mark which parsed rows match an existing transaction (master.md 11).
 * Returns the same-length boolean array (true = possible duplicate).
 */
export async function detectDuplicateRows(rows: Array<{ date: string; amount: number; type: string; walletId?: number; description?: string }>): Promise<boolean[]> {
  const existing = await loadExistingFingerprints();
  return rows.map((row) => existing.has(computeTransactionFingerprint(row)));
}

export interface CsvImportReport {
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/** Download the failed-row report as a CSV (master.md 11). */
export function downloadCsvErrorReport(errors: string[]): void {
  const csv = Papa.unparse(errors.map((message) => ({ message })));
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `expend_import_errors_${getTodayStr()}.csv`);
}

/**
 * Import validated CSV transactions atomically (master.md 11).
 * When `skipDuplicates` is set, rows whose fingerprint already exists in the
 * DB are skipped; the counts are returned in the report.
 */
export async function importCsvTransactions(
  rows: Array<Record<string, unknown>>,
  options: { skipDuplicates?: boolean; preImportSnapshot?: boolean } = {},
): Promise<CsvImportReport> {
  const report: CsvImportReport = { imported: 0, skipped: 0, failed: 0, errors: [] };
  const existing = options.skipDuplicates ? await loadExistingFingerprints() : null;

  // master.md 11: pre-import snapshot before high-impact imports. If the
  // import fails mid-way, the snapshot is restored so the user's data is
  // exactly as it was before the attempt.
  const snapshot = options.preImportSnapshot ? await createDataSnapshot() : null;
  try {
    await db.transaction('rw', [db.transactions, db.wallets, db.debts, db.debtPayments, db.merchants], async () => {
      for (const row of rows) {
        if (existing?.has(computeTransactionFingerprint(
          row as unknown as { date: string; amount: number; type: string; walletId?: number; description?: string },
        ))) {
          report.skipped += 1;
          continue;
        }
        // No per-row catch: a save failure aborts the atomic transaction and
        // the snapshot is restored below — the user's data is never left in
        // a half-imported state (master.md 11).
        await db.transactions.add(row as never);
        // Auto-create merchant entry for expenses
        if (row.type === 'expense' && row.description) {
          await ensureMerchant(row.description as string);
        }
        report.imported += 1;
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
  } catch (err) {
    if (snapshot) {
      await restoreFromSnapshot(snapshot);
      report.failed = rows.length - report.imported - report.skipped;
      report.errors.push(`Import failed mid-way; previous data restored.`);
    }
    throw err;
  }

  // Track the CSV import for backup metadata
  await incrementChangeCount(report.imported);
  return report;
}
