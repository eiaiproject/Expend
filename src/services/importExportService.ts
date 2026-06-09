import {
  db,
  type Category,
  type Debt,
  type DebtPayment,
  type Setting,
  type Transaction,
  type Wallet,
} from '../db/db';
import { findPairedTransfer, assignTransferGroupId } from '../utils/transferUtils';
import { VALID_TX_TYPES, MAX_IMPORT_FILE_SIZE } from '../utils/constants';
import { downloadBlob } from '../utils/downloadUtils';

/**
 * Maximum import file size (10 MB default).
 */
export { MAX_IMPORT_FILE_SIZE };

export const EXPORT_SCHEMA_VERSION = '2.0';

/**
 * Schema for an exported backup JSON.
 */
export interface ExportData {
  version: string;
  exportedAt: string;
  wallets: Wallet[];
  categories: Category[];
  transactions: Transaction[];
  settings: Setting[];
  debts?: Debt[];
  debt_payments?: DebtPayment[];
}

/**
 * Generate a complete export of all user data, sanitizing sensitive settings.
 */
export async function generateExport(): Promise<ExportData> {
  const rawSettings = await db.settings.toArray();
  const sanitizedSettings = rawSettings.filter(s => s.key !== 'security');

  return {
    version: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    wallets: await db.wallets.toArray(),
    categories: await db.categories.toArray(),
    transactions: await db.transactions.toArray(),
    debts: await db.debts.toArray(),
    debt_payments: await db.debt_payments.toArray(),
    settings: sanitizedSettings,
  };
}

const SPREADSHEET_FORMULA_PREFIX = /^[\t\r\n ]*[=+\-@]/;

/**
 * Prefix spreadsheet-formula-looking strings so CSV exports open as literal text.
 */
export function sanitizeCsvField(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (!SPREADSHEET_FORMULA_PREFIX.test(value)) return value;
  return `'${value}`;
}

export function sanitizeCsvRows<T extends object>(rows: T[]): Record<string, unknown>[] {
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, sanitizeCsvField(value)]),
  ));
}

/**
 * Validate that a parsed JSON object is a valid import payload.
 * Returns an array of error messages (empty = valid).
 */
export function validateImportData(json: unknown): string[] {
  const errors: string[] = [];

  if (!json || typeof json !== 'object') {
    return ['Invalid JSON structure.'];
  }

  const data = json as Record<string, unknown>;

  if (!Array.isArray(data.wallets)) {
    errors.push('Missing or invalid "wallets" array.');
  }
  if (!Array.isArray(data.transactions)) {
    errors.push('Missing or invalid "transactions" array.');
  }
  if (!Array.isArray(data.categories)) {
    errors.push('Missing or invalid "categories" array.');
  }
  if (!Array.isArray(data.settings)) {
    errors.push('Missing or invalid "settings" array.');
  }
  if (data.debts !== undefined && !Array.isArray(data.debts)) {
    errors.push('Invalid "debts" array.');
  }
  if (data.debt_payments !== undefined && !Array.isArray(data.debt_payments)) {
    errors.push('Invalid "debt_payments" array.');
  }

  if (errors.length > 0) return errors;

  const wallets: Array<Record<string, unknown | undefined>> = data.wallets as Array<Record<string, unknown>>;
  const categories: Array<Record<string, unknown | undefined>> = data.categories as Array<Record<string, unknown>>;
  const transactions: Array<Record<string, unknown | undefined>> = data.transactions as Array<Record<string, unknown>>;
  const debts: Array<Record<string, unknown | undefined>> = (data.debts ?? []) as Array<Record<string, unknown>>;
  const debtPayments: Array<Record<string, unknown | undefined>> = (data.debt_payments ?? []) as Array<Record<string, unknown>>;

  // Validate wallet fields
  const walletIds = new Set<number>();
  for (let i = 0; i < wallets.length; i++) {
    const w = wallets[i];
    if (!w) {
      errors.push(`Wallet ${i}: entry is null or undefined.`);
      continue;
    }
    if (typeof w.name !== 'string' || !w.name) {
      errors.push(`Wallet ${i}: "name" is required and must be a string.`);
    }
    if (typeof w.initialBalance !== 'number') {
      errors.push(`Wallet "${String(w.name) || i}": "initialBalance" must be a number.`);
    }
    if (typeof w.id === 'number') {
      walletIds.add(w.id as number);
    }
  }

  // Validate category fields
  const categoryIds = new Set<number>();
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    if (!c) {
      errors.push(`Category ${i}: entry is null or undefined.`);
      continue;
    }
    if (typeof c.name !== 'string' || !c.name) {
      errors.push(`Category ${i}: "name" is required and must be a string.`);
    }
    if (typeof c.id === 'number') {
      categoryIds.add(c.id as number);
    }
  }

  // Validate transaction fields
  const transactionIds = new Set<number>();
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    if (!tx) {
      errors.push(`Transaction ${i}: entry is null or undefined.`);
      continue;
    }
    if (typeof tx.id === 'number') {
      transactionIds.add(tx.id);
    }
    if (tx.walletId === undefined || tx.walletId === null || typeof tx.walletId !== 'number') {
      errors.push(`Transaction ${i}: "walletId" is required and must be a number.`);
    } else if (!walletIds.has(tx.walletId as number)) {
      errors.push(`Transaction ${i}: references wallet ID ${tx.walletId} which isn't in the import.`);
    }
    if (!tx.date || typeof tx.date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(tx.date as string)) {
      errors.push(`Transaction ${i}: "date" must be a YYYY-MM-DD string.`);
    }
    if (!tx.description || typeof tx.description !== 'string') {
      errors.push(`Transaction ${i}: "description" is required.`);
    }
    if (!tx.type || !(VALID_TX_TYPES as readonly string[]).includes(tx.type as string)) {
      errors.push(`Transaction ${i}: "type" must be one of: ${VALID_TX_TYPES.join(', ')}.`);
    }
    if (typeof tx.amount !== 'number' || isNaN(tx.amount as number)) {
      errors.push(`Transaction ${i}: "amount" must be a valid number.`);
    }
    if (tx.categoryId !== null && tx.categoryId !== undefined && typeof tx.categoryId !== 'number') {
      errors.push(`Transaction ${i}: "categoryId" must be null or a number.`);
    } else if (tx.categoryId != null && !categoryIds.has(tx.categoryId as number)) {
      errors.push(`Transaction ${i}: references category ID ${tx.categoryId} which isn't in the import.`);
    }
  }

  // Validate debt fields. These arrays are optional for backward compatibility
  // with v1.0 backups created before debt tracking existed.
  const debtIds = new Set<number>();
  const validDebtTypes: ReadonlyArray<Debt['type']> = ['payable', 'receivable'];
  const validDebtStatuses: ReadonlyArray<Debt['status']> = ['pending', 'partial', 'settled', 'overdue'];
  for (let i = 0; i < debts.length; i++) {
    const debt = debts[i];
    if (!debt) {
      errors.push(`Debt ${i}: entry is null or undefined.`);
      continue;
    }
    if (typeof debt.id === 'number') {
      debtIds.add(debt.id);
    }
    if (!validDebtTypes.includes(debt.type as Debt['type'])) {
      errors.push(`Debt ${i}: "type" must be one of: payable, receivable.`);
    }
    if (typeof debt.contactName !== 'string' || !debt.contactName) {
      errors.push(`Debt ${i}: "contactName" is required and must be a string.`);
    }
    if (typeof debt.description !== 'string' || !debt.description) {
      errors.push(`Debt ${i}: "description" is required and must be a string.`);
    }
    if (typeof debt.amount !== 'number' || isNaN(debt.amount)) {
      errors.push(`Debt ${i}: "amount" must be a valid number.`);
    }
    if (typeof debt.remainingAmount !== 'number' || isNaN(debt.remainingAmount)) {
      errors.push(`Debt ${i}: "remainingAmount" must be a valid number.`);
    }
    if (typeof debt.createdAt !== 'string' || !debt.createdAt) {
      errors.push(`Debt ${i}: "createdAt" is required and must be a string.`);
    }
    if (!validDebtStatuses.includes(debt.status as Debt['status'])) {
      errors.push(`Debt ${i}: "status" must be one of: pending, partial, settled, overdue.`);
    }
    if (debt.walletId !== undefined && typeof debt.walletId !== 'number') {
      errors.push(`Debt ${i}: "walletId" must be a number when provided.`);
    } else if (debt.walletId !== undefined && !walletIds.has(debt.walletId)) {
      errors.push(`Debt ${i}: references wallet ID ${debt.walletId} which isn't in the import.`);
    }
    if (debt.categoryId !== undefined && typeof debt.categoryId !== 'number') {
      errors.push(`Debt ${i}: "categoryId" must be a number when provided.`);
    } else if (debt.categoryId !== undefined && !categoryIds.has(debt.categoryId)) {
      errors.push(`Debt ${i}: references category ID ${debt.categoryId} which isn't in the import.`);
    }
  }

  // Validate debt payment fields.
  for (let i = 0; i < debtPayments.length; i++) {
    const payment = debtPayments[i];
    if (!payment) {
      errors.push(`Debt payment ${i}: entry is null or undefined.`);
      continue;
    }
    if (typeof payment.debtId !== 'number') {
      errors.push(`Debt payment ${i}: "debtId" is required and must be a number.`);
    } else if (!debtIds.has(payment.debtId)) {
      errors.push(`Debt payment ${i}: references debt ID ${payment.debtId} which isn't in the import.`);
    }
    if (typeof payment.amount !== 'number' || isNaN(payment.amount)) {
      errors.push(`Debt payment ${i}: "amount" must be a valid number.`);
    }
    if (!payment.date || typeof payment.date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(payment.date as string)) {
      errors.push(`Debt payment ${i}: "date" must be a YYYY-MM-DD string.`);
    }
    if (payment.transactionId !== undefined && typeof payment.transactionId !== 'number') {
      errors.push(`Debt payment ${i}: "transactionId" must be a number when provided.`);
    } else if (
      payment.transactionId !== undefined &&
      transactionIds.size > 0 &&
      !transactionIds.has(payment.transactionId)
    ) {
      errors.push(`Debt payment ${i}: references transaction ID ${payment.transactionId} which isn't in the import.`);
    }
  }

  return errors;
}

/**
 * Import data into the database, replacing all existing data.
 * Uses bulkPut to preserve original IDs and properly handle auto-increment.
 * Normalizes transfer pairs after import.
 */
export async function importData(data: ExportData): Promise<void> {
  // Strip security settings to prevent restoring stolen PIN hash
  const sanitizedSettings = data.settings.filter(s => s.key !== 'security');
  const debts = data.debts ?? [];
  const debtPayments = data.debt_payments ?? [];

  await db.transaction('rw', [db.wallets, db.categories, db.transactions, db.settings, db.debts, db.debt_payments], async () => {
    // Clear existing data
    await db.debt_payments.clear();
    await db.debts.clear();
    await db.wallets.clear();
    await db.categories.clear();
    await db.transactions.clear();
    await db.settings.clear();

    // Import using bulkPut to preserve IDs and avoid auto-increment conflicts
    if (data.wallets.length > 0) await db.wallets.bulkPut(data.wallets);
    if (data.categories.length > 0) await db.categories.bulkPut(data.categories);
    if (data.transactions.length > 0) await db.transactions.bulkPut(data.transactions);
    if (debts.length > 0) await db.debts.bulkPut(debts);
    if (debtPayments.length > 0) await db.debt_payments.bulkPut(debtPayments);
    if (sanitizedSettings.length > 0) await db.settings.bulkPut(sanitizedSettings);

    // Normalize imported transfers: assign transferGroupId to legacy pairs
    const transfers = await db.transactions
      .where('type')
      .anyOf(['transfer_in', 'transfer_out'])
      .filter(t => !t.transferGroupId)
      .toArray();

    const normalized = new Set<number>();
    for (const tx of transfers) {
      if (normalized.has(tx.id!)) continue;
      const paired = await findPairedTransfer(tx);
      if (paired?.id && !normalized.has(paired.id)) {
        await assignTransferGroupId(tx, paired);
        normalized.add(tx.id!);
        normalized.add(paired.id);
      }
    }
  });
}

export { downloadBlob };
