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
import { recomputeWalletCurrentBalances } from '../utils/balanceUtils';
import { getTodayStr } from '../utils/dateUtils';

/**
 * Maximum import file size (10 MB default).
 */
export { MAX_IMPORT_FILE_SIZE };

export const EXPORT_SCHEMA_VERSION = '2.1';

const SECURITY_SETTING_KEYS = new Set(['security', 'lockout_record']);

/** Whitelist of settings keys that are safe to import from external backups. */
const ALLOWED_IMPORT_SETTINGS = new Set(['language', 'theme']);
const MAX_IMPORT_RECORDS = {
  wallets: 500,
  categories: 500,
  transactions: 50_000,
  debts: 20_000,
  debtPayments: 50_000,
  settings: 200,
} as const;
const MAX_MONEY_ABS = 1_000_000_000_000;
const MAX_SETTING_VALUE_BYTES = 5_000;
const MAX_LENGTH = {
  walletName: 80,
  currency: 8,
  categoryName: 80,
  categoryIcon: 32,
  color: 32,
  date: 10,
  timestamp: 64,
  description: 160,
  notes: 1_000,
  transferGroupId: 128,
  debtId: 128,
  personName: 120,
  title: 160,
  settingKey: 80,
  version: 20,
} as const;

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
  debts: Debt[];
  debtPayments: DebtPayment[];
  debt_payments?: DebtPayment[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isSafePositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isFiniteMoney(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_MONEY_ABS;
}

function isBoundedString(value: unknown, maxLength: number, allowEmpty = false): value is string {
  return typeof value === 'string' && value.length <= maxLength && (allowEmpty || value.trim().length > 0);
}

function isValidDateOnly(value: unknown): value is string {
  if (!isBoundedString(value, MAX_LENGTH.date)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [yearRaw, monthRaw, dayRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
}

function isReasonableSettingValue(value: unknown): boolean {
  try {
    return JSON.stringify(value).length <= MAX_SETTING_VALUE_BYTES;
  } catch {
    return false;
  }
}

function sanitizeSettings(settings: readonly Setting[]): Setting[] {
  return settings.filter((setting) => !SECURITY_SETTING_KEYS.has(setting.key));
}

/**
 * Generate a complete export of all user data, sanitizing sensitive settings.
 */
export async function generateExport(): Promise<ExportData> {
  const rawSettings = await db.settings.toArray();
  const sanitizedSettings = sanitizeSettings(rawSettings);

  return {
    version: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    wallets: await db.wallets.toArray(),
    categories: await db.categories.toArray(),
    transactions: await db.transactions.toArray(),
    debts: await db.debts.toArray(),
    debtPayments: await db.debtPayments.toArray(),
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

  if (!isRecord(json)) {
    return ['Invalid JSON structure.'];
  }

  const data = json;

  if (!Array.isArray(data.wallets)) {
    errors.push('Missing or invalid "wallets" array.');
  }
  if (!Array.isArray(data.transactions)) {
    errors.push('Missing or invalid "transactions" array.');
  }
  if (!Array.isArray(data.categories)) {
    errors.push('Missing or invalid "categories" array.');
  }
  if (data.settings !== undefined && !Array.isArray(data.settings)) {
    errors.push('Missing or invalid "settings" array.');
  }
  if (data.debts !== undefined && !Array.isArray(data.debts)) {
    errors.push('Invalid "debts" array.');
  }
  const rawDebtPayments = data.debtPayments ?? data.debt_payments;
  if (rawDebtPayments !== undefined && !Array.isArray(rawDebtPayments)) {
    errors.push('Invalid "debtPayments" array.');
  }

  if (errors.length > 0) return errors;

  const wallets = data.wallets as unknown[];
  const categories = data.categories as unknown[];
  const transactions = data.transactions as unknown[];
  const debts = (data.debts ?? []) as unknown[];
  const debtPayments = ((data.debtPayments ?? data.debt_payments) ?? []) as unknown[];
  const settings = (data.settings ?? []) as unknown[];

  if (wallets.length > MAX_IMPORT_RECORDS.wallets) {
    errors.push(`Too many wallets. Maximum supported is ${MAX_IMPORT_RECORDS.wallets}.`);
  }
  if (categories.length > MAX_IMPORT_RECORDS.categories) {
    errors.push(`Too many categories. Maximum supported is ${MAX_IMPORT_RECORDS.categories}.`);
  }
  if (transactions.length > MAX_IMPORT_RECORDS.transactions) {
    errors.push(`Too many transactions. Maximum supported is ${MAX_IMPORT_RECORDS.transactions}.`);
  }
  if (debts.length > MAX_IMPORT_RECORDS.debts) {
    errors.push(`Too many debts. Maximum supported is ${MAX_IMPORT_RECORDS.debts}.`);
  }
  if (debtPayments.length > MAX_IMPORT_RECORDS.debtPayments) {
    errors.push(`Too many debt payments. Maximum supported is ${MAX_IMPORT_RECORDS.debtPayments}.`);
  }
  if (settings.length > MAX_IMPORT_RECORDS.settings) {
    errors.push(`Too many settings. Maximum supported is ${MAX_IMPORT_RECORDS.settings}.`);
  }

  // Validate wallet fields
  const walletIds = new Set<number>();
  for (let i = 0; i < wallets.length; i++) {
    const w = wallets[i];
    if (!isRecord(w)) {
      errors.push(`Wallet ${i}: entry must be an object.`);
      continue;
    }
    if (w.id !== undefined && !isSafePositiveInteger(w.id)) {
      errors.push(`Wallet ${i}: "id" must be a positive integer when present.`);
    }
    if (typeof w.id === 'number' && isSafePositiveInteger(w.id)) {
      walletIds.add(w.id);
    }
    if (!isBoundedString(w.name, MAX_LENGTH.walletName)) {
      errors.push(`Wallet ${i}: "name" is required and must be a string up to ${MAX_LENGTH.walletName} characters.`);
    }
    if (!isBoundedString(w.currency, MAX_LENGTH.currency)) {
      errors.push(`Wallet ${i}: "currency" is required and must be a string up to ${MAX_LENGTH.currency} characters.`);
    }
    if (!isBoundedString(w.lastUpdated, MAX_LENGTH.timestamp)) {
      errors.push(`Wallet ${i}: "lastUpdated" is required and must be a bounded string.`);
    }
    if (!isFiniteMoney(w.initialBalance)) {
      errors.push(`Wallet "${String(w.name) || i}": "initialBalance" must be a finite number within supported range.`);
    }
    if (w.currentBalance !== undefined && !isFiniteMoney(w.currentBalance)) {
      errors.push(`Wallet "${String(w.name) || i}": "currentBalance" must be a finite number within supported range when present.`);
    }
  }

  // Validate category fields
  const categoryIds = new Set<number>();
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    if (!isRecord(c)) {
      errors.push(`Category ${i}: entry must be an object.`);
      continue;
    }
    if (c.id !== undefined && !isSafePositiveInteger(c.id)) {
      errors.push(`Category ${i}: "id" must be a positive integer when present.`);
    }
    if (typeof c.id === 'number' && isSafePositiveInteger(c.id)) {
      categoryIds.add(c.id);
    }
    if (!isBoundedString(c.name, MAX_LENGTH.categoryName)) {
      errors.push(`Category ${i}: "name" is required and must be a string up to ${MAX_LENGTH.categoryName} characters.`);
    }
    if (c.icon !== undefined && !isBoundedString(c.icon, MAX_LENGTH.categoryIcon, true)) {
      errors.push(`Category ${i}: "icon" must be a string up to ${MAX_LENGTH.categoryIcon} characters.`);
    }
    if (c.color !== undefined && !isBoundedString(c.color, MAX_LENGTH.color)) {
      errors.push(`Category ${i}: "color" must be a string up to ${MAX_LENGTH.color} characters.`);
    }
    if (c.budget !== undefined && !isFiniteMoney(c.budget)) {
      errors.push(`Category ${i}: "budget" must be a finite number within supported range when present.`);
    }
  }

  // Validate transaction fields
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    if (!isRecord(tx)) {
      errors.push(`Transaction ${i}: entry must be an object.`);
      continue;
    }
    if (tx.id !== undefined && !isSafePositiveInteger(tx.id)) {
      errors.push(`Transaction ${i}: "id" must be a positive integer when present.`);
    }
    if (!isSafePositiveInteger(tx.walletId)) {
      errors.push(`Transaction ${i}: "walletId" is required and must be a positive integer.`);
    } else if (!walletIds.has(tx.walletId)) {
      errors.push(`Transaction ${i}: references wallet ID ${tx.walletId} which isn't in the import.`);
    }
    if (!isValidDateOnly(tx.date)) {
      errors.push(`Transaction ${i}: "date" must be a YYYY-MM-DD string.`);
    }
    if (!isBoundedString(tx.description, MAX_LENGTH.description)) {
      errors.push(`Transaction ${i}: "description" is required and must be up to ${MAX_LENGTH.description} characters.`);
    }
    if (!tx.type || !(VALID_TX_TYPES as readonly string[]).includes(tx.type as string)) {
      errors.push(`Transaction ${i}: "type" must be one of: ${VALID_TX_TYPES.join(', ')}.`);
    }
    if (tx.type === 'expense') {
      if (!isFiniteMoney(tx.amount) || tx.amount <= 0) {
        errors.push(`Transaction ${i}: "amount" must be a positive finite number for expenses.`);
      }
    } else if (tx.type === 'transfer_in' || tx.type === 'transfer_out') {
      if (!isFiniteMoney(tx.amount) || tx.amount <= 0) {
        errors.push(`Transaction ${i}: "amount" must be a positive finite number for transfers.`);
      }
    } else {
      if (!isFiniteMoney(tx.amount)) {
        errors.push(`Transaction ${i}: "amount" must be a finite number within supported range.`);
      }
    }
    if (tx.categoryId !== null && tx.categoryId !== undefined && typeof tx.categoryId !== 'number') {
      errors.push(`Transaction ${i}: "categoryId" must be null or a number.`);
    } else if (typeof tx.categoryId === 'number' && !isSafePositiveInteger(tx.categoryId)) {
      errors.push(`Transaction ${i}: "categoryId" must be a positive integer when present.`);
    } else if (tx.categoryId != null && !categoryIds.has(tx.categoryId)) {
      errors.push(`Transaction ${i}: references category ID ${tx.categoryId} which isn't in the import.`);
    }
    if (tx.notes !== undefined && !isBoundedString(tx.notes, MAX_LENGTH.notes, true)) {
      errors.push(`Transaction ${i}: "notes" must be a string up to ${MAX_LENGTH.notes} characters.`);
    }
    if (tx.transferGroupId !== undefined && !isBoundedString(tx.transferGroupId, MAX_LENGTH.transferGroupId)) {
      errors.push(`Transaction ${i}: "transferGroupId" must be a string up to ${MAX_LENGTH.transferGroupId} characters.`);
    }
  }

  const debtIds = new Set<string>();
  for (let i = 0; i < debts.length; i++) {
    const debt = debts[i];
    if (!isRecord(debt)) {
      errors.push(`Debt ${i}: entry must be an object.`);
      continue;
    }
    if (!isBoundedString(debt.id, MAX_LENGTH.debtId)) {
      errors.push(`Debt ${i}: "id" is required and must be a bounded string.`);
    } else {
      debtIds.add(debt.id);
    }
    if (debt.type !== 'payable' && debt.type !== 'receivable') {
      errors.push(`Debt ${i}: "type" must be payable or receivable.`);
    }
    if (!isBoundedString(debt.personName, MAX_LENGTH.personName)) {
      errors.push(`Debt ${i}: "personName" is required.`);
    }
    if (!isFiniteMoney(debt.principalAmount) || Number(debt.principalAmount) <= 0) {
      errors.push(`Debt ${i}: "principalAmount" must be greater than 0.`);
    }
    if (!isFiniteMoney(debt.remainingAmount)) {
      errors.push(`Debt ${i}: "remainingAmount" must be a finite number.`);
    }
    if (!isSafePositiveInteger(debt.walletId) || !walletIds.has(debt.walletId)) {
      errors.push(`Debt ${i}: references an unknown wallet.`);
    }
    if (!isValidDateOnly(debt.startDate)) {
      errors.push(`Debt ${i}: "startDate" must be a YYYY-MM-DD string.`);
    }
    if (debt.dueDate !== null && debt.dueDate !== undefined && !isValidDateOnly(debt.dueDate)) {
      errors.push(`Debt ${i}: "dueDate" must be null or a YYYY-MM-DD string.`);
    }
  }

  for (let i = 0; i < debtPayments.length; i++) {
    const payment = debtPayments[i];
    if (!isRecord(payment)) {
      errors.push(`Debt payment ${i}: entry must be an object.`);
      continue;
    }
    if (!isBoundedString(payment.id, MAX_LENGTH.debtId)) {
      errors.push(`Debt payment ${i}: "id" is required and must be a bounded string.`);
    }
    if (!isBoundedString(payment.debtId, MAX_LENGTH.debtId) || !debtIds.has(payment.debtId)) {
      errors.push(`Debt payment ${i}: references an unknown debt.`);
    }
    if (!isFiniteMoney(payment.amount)) {
      errors.push(`Debt payment ${i}: "amount" must be a finite number.`);
    }
    if (!isSafePositiveInteger(payment.walletId) || !walletIds.has(payment.walletId)) {
      errors.push(`Debt payment ${i}: references an unknown wallet.`);
    }
    if (!isValidDateOnly(payment.date)) {
      errors.push(`Debt payment ${i}: "date" must be a YYYY-MM-DD string.`);
    }
    if (!['initial', 'repayment', 'adjustment', 'write_off'].includes(String(payment.type))) {
      errors.push(`Debt payment ${i}: "type" is invalid.`);
    }
  }

  // Validate setting fields. Only whitelisted settings are accepted during import.
  for (let i = 0; i < settings.length; i++) {
    const setting = settings[i];
    if (!isRecord(setting)) {
      errors.push(`Setting ${i}: entry must be an object.`);
      continue;
    }
    if (!isBoundedString(setting.key, MAX_LENGTH.settingKey)) {
      errors.push(`Setting ${i}: "key" is required and must be a bounded string.`);
      continue;
    }
    if (!ALLOWED_IMPORT_SETTINGS.has(setting.key)) {
      // Skip unknown or non-importable settings silently
      continue;
    }
    if (!isReasonableSettingValue(setting.value)) {
      errors.push(`Setting ${i}: "value" is too large or cannot be serialized.`);
    }
  }

  return errors;
}

function readOptionalId(value: unknown): number | undefined {
  return isSafePositiveInteger(value) ? value : undefined;
}

function readString(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, maxLength) || fallback;
}

function readOptionalString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function readRequiredId(value: unknown, fallbackPrefix: string, index: number): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim().slice(0, MAX_LENGTH.debtId);
  }
  return `${fallbackPrefix}_${index}`;
}

function readNullableDate(value: unknown): string | null {
  return isValidDateOnly(value) ? value : null;
}

function recomputeWalletBalancesWithDebts(
  wallets: readonly Wallet[],
  transactions: readonly Transaction[],
  debts: readonly Debt[],
  debtPayments: readonly DebtPayment[],
): Wallet[] {
  return recomputeWalletCurrentBalances(wallets, transactions, debts, debtPayments);
}

export function sanitizeImportData(json: unknown): ExportData {
  const data = json as unknown as Record<string, unknown>;
  const fallbackDate = getTodayStr();

  const wallets = (Array.isArray(data.wallets) ? data.wallets : [])
    .filter(isRecord)
    .map((wallet): Wallet => ({
      id: readOptionalId(wallet.id),
      name: readString(wallet.name, 'Wallet', MAX_LENGTH.walletName),
      currency: readString(wallet.currency, 'IDR', MAX_LENGTH.currency),
      lastUpdated: readString(wallet.lastUpdated, new Date().toISOString(), MAX_LENGTH.timestamp),
      initialBalance: isFiniteMoney(wallet.initialBalance) ? wallet.initialBalance : 0,
    }));

  const categories = (Array.isArray(data.categories) ? data.categories : [])
    .filter(isRecord)
    .map((category): Category => {
      const budget = isFiniteMoney(category.budget) ? category.budget : undefined;
      return {
        id: readOptionalId(category.id),
        name: readString(category.name, 'Other', MAX_LENGTH.categoryName),
        icon: readString(category.icon, 'tag', MAX_LENGTH.categoryIcon),
        color: readString(category.color, '#64748B', MAX_LENGTH.color),
        ...(budget !== undefined ? { budget } : {}),
      };
    });

  const transactions = (Array.isArray(data.transactions) ? data.transactions : [])
    .filter(isRecord)
    .map((tx): Transaction => {
      const notes = readOptionalString(tx.notes, MAX_LENGTH.notes);
      const transferGroupId = readOptionalString(tx.transferGroupId, MAX_LENGTH.transferGroupId);
      return {
        id: readOptionalId(tx.id),
        walletId: isSafePositiveInteger(tx.walletId) ? tx.walletId : 1,
        categoryId: isSafePositiveInteger(tx.categoryId) ? tx.categoryId : null,
        date: isValidDateOnly(tx.date) ? tx.date : fallbackDate,
        description: readString(tx.description, 'Imported transaction', MAX_LENGTH.description),
        type: (VALID_TX_TYPES as readonly string[]).includes(String(tx.type))
          ? tx.type as Transaction['type']
          : 'expense',
        amount: isFiniteMoney(tx.amount) ? tx.amount : 0,
        ...(notes !== undefined ? { notes } : {}),
        ...(transferGroupId !== undefined ? { transferGroupId } : {}),
      };
    });

  const settings = (Array.isArray(data.settings) ? data.settings : [])
    .filter(isRecord)
    .filter((setting): setting is { key: string; value: unknown } => (
      isBoundedString(setting.key, MAX_LENGTH.settingKey) &&
      ALLOWED_IMPORT_SETTINGS.has(setting.key) &&
      isReasonableSettingValue(setting.value)
    ))
    .map((setting): Setting => ({
      key: setting.key,
      value: setting.value,
    }));

  const debts = (Array.isArray(data.debts) ? data.debts : [])
    .filter(isRecord)
    .map((debt, index): Debt => {
      const now = new Date().toISOString();
      const dueDate = readNullableDate(debt.dueDate);
      const archivedAt = typeof debt.archivedAt === 'string' ? debt.archivedAt.slice(0, MAX_LENGTH.timestamp) : null;
      return {
        id: readRequiredId(debt.id, 'imported_debt', index),
        type: debt.type === 'receivable' ? 'receivable' : 'payable',
        personName: readString(debt.personName, 'Imported person', MAX_LENGTH.personName),
        title: readOptionalString(debt.title, MAX_LENGTH.title),
        principalAmount: isFiniteMoney(debt.principalAmount) && debt.principalAmount > 0 ? debt.principalAmount : 1,
        remainingAmount: isFiniteMoney(debt.remainingAmount) ? Math.max(0, debt.remainingAmount) : 0,
        walletId: isSafePositiveInteger(debt.walletId) ? debt.walletId : 1,
        startDate: isValidDateOnly(debt.startDate) ? debt.startDate : fallbackDate,
        dueDate,
        status: ['open', 'partial', 'paid', 'overdue', 'written_off'].includes(String(debt.status))
          ? debt.status as Debt['status']
          : undefined,
        notes: readOptionalString(debt.notes, MAX_LENGTH.notes),
        createdAt: readString(debt.createdAt, now, MAX_LENGTH.timestamp),
        updatedAt: readString(debt.updatedAt, now, MAX_LENGTH.timestamp),
        archivedAt,
      };
    });

  const debtIds = new Set(debts.map((debt) => debt.id));
  const debtPaymentsSource = Array.isArray(data.debtPayments)
    ? data.debtPayments
    : Array.isArray(data.debt_payments)
      ? data.debt_payments
      : [];
  const debtPayments = debtPaymentsSource
    .filter(isRecord)
    .map((payment, index): DebtPayment | null => {
      const debtId = typeof payment.debtId === 'string' ? payment.debtId : '';
      if (!debtIds.has(debtId)) return null;
      return {
        id: readRequiredId(payment.id, 'imported_debt_payment', index),
        debtId,
        amount: isFiniteMoney(payment.amount) ? Math.max(0, payment.amount) : 0,
        date: isValidDateOnly(payment.date) ? payment.date : fallbackDate,
        walletId: isSafePositiveInteger(payment.walletId) ? payment.walletId : 1,
        type: ['initial', 'repayment', 'adjustment', 'write_off'].includes(String(payment.type))
          ? payment.type as DebtPayment['type']
          : 'adjustment',
        notes: readOptionalString(payment.notes, MAX_LENGTH.notes),
        linkedTransactionId: isSafePositiveInteger(payment.linkedTransactionId) ? payment.linkedTransactionId : null,
        createdAt: readString(payment.createdAt, new Date().toISOString(), MAX_LENGTH.timestamp),
      };
    })
    .filter((payment): payment is DebtPayment => payment !== null);

  return {
    version: readString(data.version, EXPORT_SCHEMA_VERSION, MAX_LENGTH.version),
    exportedAt: readString(data.exportedAt, new Date().toISOString(), MAX_LENGTH.timestamp),
    wallets,
    categories,
    transactions,
    debts,
    debtPayments,
    settings,
  };
}

/**
 * Import data into the database, replacing all existing data.
 * Uses bulkPut to preserve original IDs and properly handle auto-increment.
 * Normalizes transfer pairs after import.
 */
export async function importData(data: ExportData): Promise<void> {
  const validationErrors = validateImportData(data);
  if (validationErrors.length > 0) {
    throw new Error(`Import validation failed: ${validationErrors.join('; ')}`);
  }

  const sanitizedData = sanitizeImportData(data);
  // ... (rest of the function)

  await db.transaction('rw', [db.wallets, db.categories, db.transactions, db.debts, db.debtPayments, db.settings], async () => {
    const localSecurity = await db.settings.get('security');
    const walletsWithBalances = recomputeWalletBalancesWithDebts(
      sanitizedData.wallets,
      sanitizedData.transactions,
      sanitizedData.debts,
      sanitizedData.debtPayments,
    );

    // Clear existing data
    await db.wallets.clear();
    await db.categories.clear();
    await db.transactions.clear();
    await db.debts.clear();
    await db.debtPayments.clear();
    await db.settings.clear();

    // Import using bulkPut to preserve IDs and avoid auto-increment conflicts
    if (walletsWithBalances.length > 0) await db.wallets.bulkPut(walletsWithBalances);
    if (sanitizedData.categories.length > 0) await db.categories.bulkPut(sanitizedData.categories);
    if (sanitizedData.transactions.length > 0) await db.transactions.bulkPut(sanitizedData.transactions);
    if (sanitizedData.debts.length > 0) await db.debts.bulkPut(sanitizedData.debts);
    if (sanitizedData.debtPayments.length > 0) await db.debtPayments.bulkPut(sanitizedData.debtPayments);
    if (sanitizedData.settings.length > 0) await db.settings.bulkPut(sanitizedData.settings);
    if (localSecurity) await db.settings.put(localSecurity);

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
