import Dexie, { type EntityTable } from 'dexie';
import { CURATED_PALETTE } from '../utils/constants';
import { generateTransferGroupId } from '../utils/cryptoUtils';
import { getTodayStr } from '../utils/dateUtils';

export interface Wallet {
  id?: number;
  name: string;
  currency: string;
  lastUpdated: string;
  initialBalance: number;
  currentBalance?: number; // Computed incrementally for fast reads
}

export interface Category {
  id?: number;
  name: string;
  icon: string;
  color: string;
  budget?: number;
}

export interface Transaction {
  id?: number;
  walletId: number;
  categoryId: number | null; // null for balance_adjustment
  date: string; // YYYY-MM-DD format 
  description: string;
  type: 'expense' | 'balance_adjustment' | 'transfer_in' | 'transfer_out';
  amount: number;
  notes?: string;
  transferGroupId?: string; // links paired transfer_in/transfer_out transactions
}

export type DebtType = 'payable' | 'receivable';
export type DebtStatus = 'open' | 'partial' | 'paid' | 'overdue' | 'written_off';

export interface Debt {
  id: string;
  type: DebtType;
  personName: string;
  title?: string;
  principalAmount: number;
  remainingAmount: number;
  walletId: number;
  startDate: string;
  dueDate?: string | null;
  status?: DebtStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}

export type DebtPaymentType = 'initial' | 'repayment' | 'adjustment' | 'write_off';

export interface DebtPayment {
  id: string;
  debtId: string;
  amount: number;
  date: string;
  walletId: number;
  type: DebtPaymentType;
  notes?: string;
  linkedTransactionId?: number | null;
  createdAt: string;
}

import Dexie, { type EntityTable } from 'dexie';
import { CURATED_PALETTE } from '../utils/constants';
import { generateTransferGroupId } from '../utils/cryptoUtils';
import { getTodayStr } from '../utils/dateUtils';

export interface Wallet {
  id?: number;
  name: string;
  currency: string;
  lastUpdated: string;
  initialBalance: number;
  currentBalance?: number; // Computed incrementally for fast reads
}

export interface Category {
  id?: number;
  name: string;
  icon: string;
  color: string;
  budget?: number;
}

export interface Transaction {
  id?: number;
  walletId: number;
  categoryId: number | null; // null for balance_adjustment
  date: string; // YYYY-MM-DD format 
  description: string;
  type: 'expense' | 'balance_adjustment' | 'transfer_in' | 'transfer_out';
  amount: number;
  notes?: string;
  transferGroupId?: string; // links paired transfer_in/transfer_out transactions
}

export type DebtType = 'payable' | 'receivable';
export type DebtStatus = 'open' | 'partial' | 'paid' | 'overdue' | 'written_off';

export interface Debt {
  id: string;
  type: DebtType;
  personName: string;
  title?: string;
  principalAmount: number;
  remainingAmount: number;
  walletId: number;
  startDate: string;
  dueDate?: string | null;
  status?: DebtStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}

export type DebtPaymentType = 'initial' | 'repayment' | 'adjustment' | 'write_off';

export interface DebtPayment {
  id: string;
  debtId: string;
  amount: number;
  date: string;
  walletId: number;
  type: DebtPaymentType;
  notes?: string;
  linkedTransactionId?: number | null;
  createdAt: string;
}

export interface Setting {
  key: string;
  value: unknown;
}

// Defined the TransactionMode type to match Dexie's expectations if not exported
type TransactionMode = 'read' | 'rw';

type LegacyDebtRecord = Partial<Debt> & {
  id?: string | number;
  contactName?: unknown;
  description?: unknown;
  amount?: unknown;
  status?: unknown;
  categoryId?: unknown;
};

type LegacyDebtPaymentRecord = {
  id?: string | number;
  debtId?: string | number;
  amount?: unknown;
  date?: unknown;
  note?: unknown;
  notes?: unknown;
  transactionId?: unknown;
  linkedTransactionId?: unknown;
  walletId?: unknown;
  type?: unknown;
  createdAt?: unknown;
};

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}/;

function getDateOnly(value: unknown, fallback: string | null = null): string | null {
  if (typeof value !== 'string') return fallback;
  const match = value.match(DATE_ONLY_RE);
  return match ? match[0] : fallback;
}

function getTodayDateOnly(): string {
  return getTodayStr();
}

function getTimestamp(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function getString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function getPositiveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function getNonNegativeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function getWalletId(value: unknown, fallback: number): number {
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

function getDebtType(value: unknown): DebtType {
  return value === 'receivable' ? 'receivable' : 'payable';
}

function getDebtStatus(value: unknown, principalAmount: number, remainingAmount: number): DebtStatus {
  if (value === 'written_off') return 'written_off';
  if (value === 'settled' || value === 'paid' || remainingAmount <= 0) return 'paid';
  if (value === 'partial' || remainingAmount < principalAmount) return 'partial';
  if (value === 'overdue') return 'overdue';
  return 'open';
}

function getDebtPaymentType(value: unknown): DebtPaymentType {
  if (value === 'initial' || value === 'adjustment' || value === 'write_off') return value;
  return 'repayment';
}

function normalizeLegacyDebt(
  rawDebt: LegacyDebtRecord,
  index: number,
  fallbackWalletId: number,
  now: string,
): Debt {
  const rawId = rawDebt.id ?? index + 1;
  const id = typeof rawId === 'string' ? rawId : `legacy_debt_${rawId}`;
  const createdAt = getTimestamp(rawDebt.createdAt, now);
  const startDate = getDateOnly(rawDebt.startDate, getDateOnly(createdAt, getTodayDateOnly())) ?? getTodayDateOnly();
  const principalFallback = getPositiveNumber(rawDebt.remainingAmount, 1);
  const principalAmount = getPositiveNumber(rawDebt.principalAmount, getPositiveNumber(rawDebt.amount, principalFallback));
  const baseRemainingAmount = getNonNegativeNumber(rawDebt.remainingAmount, principalAmount);
  const status = getDebtStatus(rawDebt.status, principalAmount, baseRemainingAmount);
  const remainingAmount = status === 'paid' || status === 'written_off' ? 0 : Math.min(baseRemainingAmount, principalAmount);
  const personName = getString(rawDebt.personName, getString(rawDebt.contactName, 'Kontak lama')) || 'Kontak lama';
  const title = getString(rawDebt.title, getString(rawDebt.description)) || undefined;
  const notes = getString(rawDebt.notes) || undefined;

  return {
    id,
    type: getDebtType(rawDebt.type),
    personName,
    title,
    principalAmount,
    remainingAmount,
    walletId: getWalletId(rawDebt.walletId, fallbackWalletId),
    startDate,
    dueDate: getDateOnly(rawDebt.dueDate, null),
    status,
    notes,
    createdAt,
    updatedAt: getTimestamp(rawDebt.updatedAt, createdAt),
    archivedAt: getTimestamp(rawDebt.archivedAt, '') || null,
  };
}

function normalizeLegacyDebtRows(
  rawDebts: LegacyDebtRecord[],
  walletRows: Wallet[],
): { debts: Debt[]; legacyDebtIds: Map<string, string> } {
  const now = new Date().toISOString();
  const fallbackWalletId = walletRows.find((wallet) => Number.isSafeInteger(wallet.id) && wallet.id! > 0)?.id ?? 1;
  const legacyDebtIds = new Map<string, string>();
  const debts = rawDebts.map((rawDebt, index) => {
    const debt = normalizeLegacyDebt(rawDebt, index, fallbackWalletId, now);
    if (rawDebt.id != null) {
      legacyDebtIds.set(String(rawDebt.id), debt.id);
    }
    legacyDebtIds.set(debt.id, debt.id);
    return debt;
  });

  return { debts, legacyDebtIds };
}

function normalizeLegacyDebtPayments(
  legacyPayments: LegacyDebtPaymentRecord[],
  debts: Debt[],
  legacyDebtIds: Map<string, string>,
  existingPayments: DebtPayment[] = [],
): DebtPayment[] {
  const existingPaymentIds = new Set(existingPayments.map((payment) => payment.id));
  const debtIdsWithPayments = new Set(existingPayments.map((payment) => payment.debtId));
  const debtById = new Map(debts.map((debt) => [debt.id, debt]));
  const payments = [...existingPayments];

  for (const debt of debts) {
    const initialPaymentId = `legacy_debt_initial_${debt.id}`;
    if (!debtIdsWithPayments.has(debt.id) && !existingPaymentIds.has(initialPaymentId)) {
      payments.push({
        id: initialPaymentId,
        debtId: debt.id,
        amount: debt.principalAmount,
        date: debt.startDate,
        walletId: debt.walletId,
        type: 'initial',
        notes: debt.type === 'payable' ? 'Uang pinjaman diterima' : 'Pinjaman diberikan',
        linkedTransactionId: null,
        createdAt: debt.createdAt,
      } satisfies DebtPayment);
      existingPaymentIds.add(initialPaymentId);
      debtIdsWithPayments.add(debt.id);
    }
  }

  for (const [index, rawPayment] of legacyPayments.entries()) {
    const debtId = rawPayment.debtId == null ? null : legacyDebtIds.get(String(rawPayment.debtId));
    if (!debtId) continue;

    const debt = debtById.get(debtId);
    if (!debt) continue;

    const paymentId = typeof rawPayment.id === 'string'
      ? rawPayment.id
      : `legacy_debt_payment_${rawPayment.id ?? index + 1}`;
    if (existingPaymentIds.has(paymentId)) continue;

    const date = getDateOnly(rawPayment.date, debt.startDate) ?? debt.startDate;
    payments.push({
      id: paymentId,
      debtId,
      amount: getPositiveNumber(rawPayment.amount, 1),
      date,
      walletId: getWalletId(rawPayment.walletId, debt.walletId),
      type: getDebtPaymentType(rawPayment.type),
      notes: getString(rawPayment.notes, getString(rawPayment.note)) || undefined,
      linkedTransactionId: Number.isSafeInteger(rawPayment.linkedTransactionId)
        ? Number(rawPayment.linkedTransactionId)
        : Number.isSafeInteger(rawPayment.transactionId)
          ? Number(rawPayment.transactionId)
          : null,
      createdAt: getTimestamp(rawPayment.createdAt, `${date}T00:00:00.000Z`),
    } satisfies DebtPayment);
    existingPaymentIds.add(paymentId);
  }

  return payments;
}

function createDebtStore(nativeDb: IDBDatabase): IDBObjectStore {
  const debtStore = nativeDb.createObjectStore('debts', { keyPath: 'id' });
  for (const indexName of ['type', 'personName', 'walletId', 'startDate', 'dueDate', 'archivedAt', 'updatedAt']) {
    debtStore.createIndex(indexName, indexName);
  }
  return debtStore;
}

function createDebtPaymentStore(nativeDb: IDBDatabase): IDBObjectStore {
  const paymentStore = nativeDb.createObjectStore('debtPayments', { keyPath: 'id' });
  for (const indexName of ['debtId', 'walletId', 'date', 'createdAt']) {
    paymentStore.createIndex(indexName, indexName);
  }
  return paymentStore;
}

/**
 * Pre-flight native IndexedDB repair for the legacy v1.0.0 debt schema.
 *
 * VERSION STRATEGY:
 * The repair sets the native DB version to REPAIR_VERSION (11), which is
 * exactly 1 above the current Dexie maximum (10). This ensures:
 *
 * - After repair, Dexie opens at version 10 (< 11) → no upgrade triggered.
 * - When Dexie is bumped to version 11 in the future, the DB is already
 *   at version 11 → Dexie opens without upgrade (stores remain intact).
 * - When Dexie is bumped to version 12, the DB at 11 < 12 → upgrade runs.
 *
 * UPGRADING: When adding a new Dexie version N, update REPAIR_VERSION to
 * N + 1 so the repair always sets a version 1 above the new Dexie max.
 *
 * This function is idempotent: it only repairs if the legacy store exists.
 */
const REPAIR_VERSION = 11;

function repairLegacyDebtSchemaNative(): Promise<void> {
  if (typeof indexedDB === 'undefined') return Promise.resolve();

  const dbName = 'ExpendDB';

  const probe = new Promise<boolean>((resolve) => {
    const request = indexedDB.open(dbName);
    let createdEmptyDatabase = false;

    request.onupgradeneeded = () => {
      createdEmptyDatabase = true;
      request.transaction?.abort();
    };
    request.onerror = () => resolve(false);
    request.onsuccess = () => {
      const nativeDb = request.result;
      const needsRepair = !createdEmptyDatabase
        && nativeDb.version < REPAIR_VERSION
        && nativeDb.objectStoreNames.contains('debt_payments');
      nativeDb.close();
      resolve(needsRepair);
    };
  });

  return probe.then((needsRepair) => {
    if (!needsRepair) return undefined;

    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(dbName, REPAIR_VERSION);
      let migrationError: unknown = null;

      request.onupgradeneeded = () => {
        const nativeDb = request.result;
        const tx = request.transaction;
        if (!tx) return;

        const debtRequest = nativeDb.objectStoreNames.contains('debts')
          ? tx.objectStore('debts').getAll()
          : null;
        const legacyPaymentRequest = nativeDb.objectStoreNames.contains('debt_payments')
          ? tx.objectStore('debt_payments').getAll()
          : null;
        const currentPaymentRequest = nativeDb.objectStoreNames.contains('debtPayments')
          ? tx.objectStore('debtPayments').getAll()
          : null;
        const walletRequest = nativeDb.objectStoreNames.contains('wallets')
          ? tx.objectStore('wallets').getAll()
          : null;

        const requests = [debtRequest, legacyPaymentRequest, currentPaymentRequest, walletRequest].filter(Boolean) as IDBRequest<unknown[]>[];
        let pending = requests.length;

        const rewriteStores = () => {
          try {
            const rawDebts = (debtRequest?.result ?? []) as LegacyDebtRecord[];
            const legacyPayments = (legacyPaymentRequest?.result ?? []) as LegacyDebtPaymentRecord[];
            const currentPayments = (currentPaymentRequest?.result ?? []) as DebtPayment[];
            const wallets = (walletRequest?.result ?? []) as Wallet[];
            const { debts, legacyDebtIds } = normalizeLegacyDebtRows(rawDebts, wallets);
            const payments = normalizeLegacyDebtPayments(legacyPayments, debts, legacyDebtIds, currentPayments);

            for (const storeName of ['debts', 'debtPayments', 'debt_payments']) {
              if (nativeDb.objectStoreNames.contains(storeName)) {
                nativeDb.deleteObjectStore(storeName);
              }
            }

            const debtStore = createDebtStore(nativeDb);
            const paymentStore = createDebtPaymentStore(nativeDb);

            for (const debt of debts) {
              debtStore.put(debt);
            }
            for (const payment of payments) {
              paymentStore.put(payment);
            }
            if (nativeDb.objectStoreNames.contains('settings')) {
              tx.objectStore('settings').put({ key: 'legacy_debt_schema_migrated_v9', value: true });
            }
          } catch (err) {
            migrationError = err;
            tx.abort();
          }
        };

        if (pending === 0) {
          rewriteStores();
          return;
        }

        for (const pendingRequest of requests) {
          pendingRequest.onerror = () => {
            migrationError = pendingRequest.error;
            tx.abort();
          };
          pendingRequest.onsuccess = () => {
            pending -= 1;
            if (pending === 0) rewriteStores();
          };
        }
      };

      request.onerror = () => reject(migrationError ?? request.error);
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
    });
  }).catch((err) => {
    console.error('Failed to repair legacy debt schema:', err);
  });
}

const db = new Dexie('ExpendDB') as Dexie & {
  wallets: EntityTable<Wallet, 'id'>;
  categories: EntityTable<Category, 'id'>;
  transactions: EntityTable<Transaction, 'id'>;
  debts: EntityTable<Debt, 'id'>;
  debtPayments: EntityTable<DebtPayment, 'id'>;
  settings: EntityTable<Setting, 'key'>;
};

const legacyDebtSchemaRepair = repairLegacyDebtSchemaNative();
const openDb = db.open.bind(db);
db.open = (() => legacyDebtSchemaRepair.then(() => openDb())) as typeof db.open;

db.version(3).stores({
  wallets: '++id, name, currency, lastUpdated',
  categories: '++id, name, icon, color, budget',
  transactions: '++id, walletId, categoryId, date, description, type, amount, transferGroupId',
  settings: 'key'
}).upgrade(async (tx) => {
  const settingsTable = tx.table('settings');
  await settingsTable.put({ key: 'migration_in_progress', value: true });

  try {
    // Backfill transferGroupId for legacy transfer pairs that don't have one
    const transfers = await tx.table('transactions')
      .where('type')
      .anyOf(['transfer_in', 'transfer_out'])
      .toArray();

    const unpaired = transfers.filter(t => !t.transferGroupId);
    if (unpaired.length === 0) {
      await settingsTable.put({ key: 'migration_completed_v3', value: true });
      await settingsTable.delete('migration_in_progress');
      return;
    }

    // Group by base description (remove (Out)/(In) suffix), amount, and date
    const paired = new Set<number>();

    for (let i = 0; i < unpaired.length; i++) {
      const a = unpaired[i];
      if (paired.has(a.id!)) continue;

      const baseDescA = a.description.replace(/\s\((Out|In)\)$/, '');
      const dateA = a.date.split('T')[0];

      for (let j = i + 1; j < unpaired.length; j++) {
        const b = unpaired[j];
        if (paired.has(b.id!)) continue;

        // Must be opposite types, same amount, same date, different wallets
        if (a.type === b.type) continue;
        if (a.amount !== b.amount) continue;
        if (a.date.split('T')[0] !== dateA) continue;
        if (a.walletId === b.walletId) continue;

        const baseDescB = b.description.replace(/\s\((Out|In)\)$/, '');
        if (baseDescA === baseDescB) {
          const groupId = `backfill-${generateTransferGroupId()}`;
          await tx.table('transactions').update(a.id!, { transferGroupId: groupId });
          await tx.table('transactions').update(b.id!, { transferGroupId: groupId });
          paired.add(a.id!);
          paired.add(b.id!);
          break;
        }
      }
    }

    await settingsTable.put({ key: 'migration_completed_v3', value: true });
    await settingsTable.delete('migration_in_progress');
  } catch (err) {
    await settingsTable.put({ key: 'migration_failed_v3', value: String(err) });
    throw err; // Let Dexie abort the version upgrade transaction
  }
});

// Version 4: Add compound indexes for performance
db.version(4).stores({
  wallets: '++id, name, currency, lastUpdated',
  categories: '++id, name, icon, color, budget',
  transactions: '++id, walletId, categoryId, date, description, type, amount, transferGroupId, [type+date], [walletId+date], [categoryId+date]',
  settings: 'key'
});

// Version 5: Normalize all transaction dates to YYYY-MM-DD format
db.version(5).stores({
  wallets: '++id, name, currency, lastUpdated',
  categories: '++id, name, icon, color, budget',
  transactions: '++id, walletId, categoryId, date, description, type, amount, transferGroupId, [type+date], [walletId+date], [categoryId+date]',
  settings: 'key'
}).upgrade(async (tx) => {
  const allTxs = await tx.table('transactions').toArray();
  const needsNormalization = allTxs.filter(t => t.date && t.date.includes('T'));
  if (needsNormalization.length === 0) return;

  for (const t of needsNormalization) {
    const normalizedDate = t.date.split('T')[0];
    if (normalizedDate) {
      await tx.table('transactions').update(t.id, { date: normalizedDate });
    }
  }
});

// Version 6: Category deduplication + color migration (previously in React effects)
db.version(6).stores({
  wallets: '++id, name, currency, lastUpdated',
  categories: '++id, name, icon, color, budget',
  transactions: '++id, walletId, categoryId, date, description, type, amount, transferGroupId, [type+date], [walletId+date], [categoryId+date]',
  settings: 'key'
}).upgrade(async (tx) => {
  const catTable = tx.table('categories');
  const txTable = tx.table('transactions');
  const settingsTable = tx.table('settings');

  // --- 1. Deduplicate categories ---
  const allCategories = await catTable.toArray();
  if (allCategories.length > 0) {
    const nameToIdMap = new Map<string, number>();
    const duplicates: { id: number; primaryId: number }[] = [];

    for (const cat of allCategories) {
      const normalizedName = cat.name.trim().toLowerCase();
      if (nameToIdMap.has(normalizedName)) {
        duplicates.push({ id: cat.id!, primaryId: nameToIdMap.get(normalizedName)! });
      } else {
        nameToIdMap.set(normalizedName, cat.id!);
      }
    }

    if (duplicates.length > 0) {
      for (const dup of duplicates) {
        await txTable
          .where('categoryId')
          .equals(dup.id)
          .modify({ categoryId: dup.primaryId });
        await catTable.delete(dup.id);
      }
    }
  }

  // --- 2. Migrate category colors (assign curated colors to categories missing them) ---
  const categoriesAfterDedup = await catTable.toArray();
  const categoriesNeedingColor = categoriesAfterDedup.filter((c) => !c.color);

  for (const cat of categoriesNeedingColor) {
    const randomColor = CURATED_PALETTE[Math.floor(Math.random() * CURATED_PALETTE.length)]!;
    await catTable.update(cat.id!, { color: randomColor });
  }

  // 3. Record migration completion
  await settingsTable.put({ key: 'categories_deduplicated', value: true });
  await settingsTable.put({ key: 'category_colors_migrated', value: true });
});

// Version 7: Compute currentBalance for all wallets
db.version(7).stores({
  wallets: '++id, name, currency, lastUpdated, currentBalance',
  categories: '++id, name, icon, color, budget',
  transactions: '++id, walletId, categoryId, date, description, type, amount, transferGroupId, [type+date], [walletId+date], [categoryId+date]',
  settings: 'key'
}).upgrade(async (tx) => {
  const walletTable = tx.table('wallets');
  const txTable = tx.table('transactions');
  const settingsTable = tx.table('settings');

  const alreadyDone = await settingsTable.get('wallet_balance_computed');
  if (alreadyDone) return;

  await settingsTable.put({ key: 'migration_in_progress', value: true });

  try {
    const wallets = await walletTable.toArray();
    const allTxs = await txTable.toArray();

    for (const wallet of wallets) {
      const walletTxs = allTxs.filter((t) => t.walletId === wallet.id);
      let balance = wallet.initialBalance;
      for (const t of walletTxs) {
        if (t.type === 'expense' || t.type === 'transfer_out') {
          balance -= t.amount;
        } else {
          balance += t.amount;
        }
      }
      await walletTable.update(wallet.id!, { currentBalance: balance });
    }

    await settingsTable.put({ key: 'wallet_balance_computed', value: true });
    await settingsTable.delete('migration_in_progress');
  } catch (err) {
    await settingsTable.put({ key: 'migration_failed_v7', value: String(err) });
    throw err;
  }
});

// Version 8: Add local-first debt/receivable tables. Native preflight above
// repairs the incompatible v1.0.0 schema that also used Dexie version 8.
db.version(8).stores({
  wallets: '++id, name, currency, lastUpdated, currentBalance',
  categories: '++id, name, icon, color, budget',
  transactions: '++id, walletId, categoryId, date, description, type, amount, transferGroupId, [type+date], [walletId+date], [categoryId+date]',
  debts: 'id, type, personName, walletId, startDate, dueDate, archivedAt, updatedAt',
  debtPayments: 'id, debtId, walletId, date, createdAt',
  settings: 'key'
});

// Version 9: Reserve a schema step for v1.2.1 debt compatibility repair.
db.version(9).stores({
  wallets: '++id, name, currency, lastUpdated, currentBalance',
  categories: '++id, name, icon, color, budget',
  transactions: '++id, walletId, categoryId, date, description, type, amount, transferGroupId, [type+date], [walletId+date], [categoryId+date]',
  debts: 'id, type, personName, walletId, startDate, dueDate, archivedAt, updatedAt',
  debtPayments: 'id, debtId, walletId, date, createdAt',
  settings: 'key'
});

// Version 10: Current debt schema after native legacy repair.
db.version(10).stores({
  wallets: '++id, name, currency, lastUpdated, currentBalance',
  categories: '++id, name, icon, color, budget',
  transactions: '++id, walletId, categoryId, date, description, type, amount, transferGroupId, [type+date], [walletId+date], [categoryId+date]',
  debts: 'id, type, personName, walletId, startDate, dueDate, archivedAt, updatedAt',
  debtPayments: 'id, debtId, walletId, date, createdAt',
  settings: 'key'
});

export { db };
