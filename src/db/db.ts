import Dexie, { type EntityTable } from 'dexie';
import { CURATED_PALETTE } from '../utils/constants';

export interface Wallet {
  id?: number;
  name: string;
  currency: string;
  lastUpdated: string;
  initialBalance: number;
  currentBalance?: number; // Computed incrementally for fast reads
  archivedAt?: string | null; // ISO timestamp when deactivated; null = active
  color?: string; // Hex color for visual identification
}

export interface Category {
  id?: number;
  name: string;
  icon: string;
  color: string;
  budget?: number;
  archivedAt?: string | null; // ISO timestamp when archived; null/undefined = active
}

export interface Merchant {
  id?: number;
  displayName: string;     // What user sees
  originalName: string;    // First imported name (never changes)
  aliases: string[];       // Additional names that map to this merchant
  archivedAt?: string | null; // ISO timestamp; null = active
  mergedIntoId?: number | null; // If merged, the target merchant ID
  createdAt: string;       // ISO timestamp
  updatedAt: string;       // ISO timestamp
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

const db = new Dexie('ExpendDB') as Dexie & {
  wallets: EntityTable<Wallet, 'id'>;
  categories: EntityTable<Category, 'id'>;
  transactions: EntityTable<Transaction, 'id'>;
  debts: EntityTable<Debt, 'id'>;
  debtPayments: EntityTable<DebtPayment, 'id'>;
  merchants: EntityTable<Merchant, 'id'>;
  settings: EntityTable<Setting, 'key'>;
};

// ── Store spec evolution (oldest → newest). Each entry is the FULL Dexie
// schema string for that version; Dexie needs every intermediate version to
// handle upgrades from any prior DB version on disk.
const V3 = {
  wallets: '++id, name, currency, lastUpdated',
  categories: '++id, name, icon, color, budget',
  transactions: '++id, walletId, categoryId, date, description, type, amount, transferGroupId',
  settings: 'key',
};

const V4_TXS = '++id, walletId, categoryId, date, description, type, amount, transferGroupId, [type+date], [walletId+date], [categoryId+date]';

const V4_STORES = { ...V3, transactions: V4_TXS };

const V7_TXS = V4_TXS;
const V7_WALLETS = '++id, name, currency, lastUpdated, currentBalance';

const V7_STORES = { ...V4_STORES, transactions: V7_TXS, wallets: V7_WALLETS };

const DEBT_STORES = {
  debts: 'id, type, personName, walletId, startDate, dueDate, archivedAt, updatedAt',
  debtPayments: 'id, debtId, walletId, date, createdAt',
};

const V8_STORES = { ...V7_STORES, ...DEBT_STORES };
const V12_STORES = { ...V8_STORES, categories: '++id, name, icon, color, budget, archivedAt' };
const V13_STORES = {
  ...V12_STORES,
  merchants: '++id, displayName, originalName, archivedAt, mergedIntoId',
};

// ── Migrations (idempotent via `migration_*` settings records) ──────────

// v3: Backfill transferGroupId for legacy transfer pairs that lack one.
db.version(3).stores(V3).upgrade(async (tx) => {
  const settingsTable = tx.table('settings');
  const alreadyDone = await settingsTable.get('migration_completed_v3');
  if (alreadyDone) return;

  await settingsTable.put({ key: 'migration_in_progress', value: true });
  try {
    const transfers = await tx.table('transactions')
      .where('type').anyOf(['transfer_in', 'transfer_out']).toArray();
    const unpaired = transfers.filter(t => !t.transferGroupId);
    if (unpaired.length === 0) {
      await settingsTable.put({ key: 'migration_completed_v3', value: true });
      await settingsTable.delete('migration_in_progress');
      return;
    }

    const paired = new Set<number>();
    for (let i = 0; i < unpaired.length; i++) {
      const a = unpaired[i];
      if (paired.has(a.id!)) continue;
      const baseDescA = a.description.replace(/\s\((Out|In)\)$/, '');
      const dateA = a.date.split('T')[0];

      for (let j = i + 1; j < unpaired.length; j++) {
        const b = unpaired[j];
        if (paired.has(b.id!)) continue;
        if (a.type === b.type) continue;
        if (a.amount !== b.amount) continue;
        if (a.date.split('T')[0] !== dateA) continue;
        if (a.walletId === b.walletId) continue;
        const baseDescB = b.description.replace(/\s\((Out|In)\)$/, '');
        if (baseDescA !== baseDescB) continue;

        const groupId = `backfill-${crypto.randomUUID()}`;
        await tx.table('transactions').update(a.id!, { transferGroupId: groupId });
        await tx.table('transactions').update(b.id!, { transferGroupId: groupId });
        paired.add(a.id!);
        paired.add(b.id!);
        break;
      }
    }

    await settingsTable.put({ key: 'migration_completed_v3', value: true });
    await settingsTable.delete('migration_in_progress');
  } catch (err) {
    await settingsTable.put({ key: 'migration_failed_v3', value: String(err) });
    throw err;
  }
});

// v4: compound index additions (no data migration)
db.version(4).stores(V4_STORES);

// v5: normalize date strings from 'YYYY-MM-DDTHH:mm:ss' to 'YYYY-MM-DD'
db.version(5).stores(V4_STORES).upgrade(async (tx) => {
  const allTxs = await tx.table('transactions').toArray();
  for (const t of allTxs) {
    if (t.date?.includes('T')) {
      const normalizedDate = t.date.split('T')[0];
      if (normalizedDate) await tx.table('transactions').update(t.id, { date: normalizedDate });
    }
  }
});

// v6: dedupe categories by lowercase name + assign curated colors to categories missing one
db.version(6).stores(V4_STORES).upgrade(async (tx) => {
  const catTable = tx.table('categories');
  const txTable = tx.table('transactions');
  const settingsTable = tx.table('settings');

  if (await settingsTable.get('categories_deduplicated')) return;

  // Deduplicate
  const allCategories = await catTable.toArray();
  if (allCategories.length > 0) {
    const nameToIdMap = new Map<string, number>();
    const duplicates: { id: number; primaryId: number }[] = [];
    for (const cat of allCategories) {
      const key = cat.name.trim().toLowerCase();
      if (nameToIdMap.has(key)) {
        duplicates.push({ id: cat.id!, primaryId: nameToIdMap.get(key)! });
      } else {
        nameToIdMap.set(key, cat.id!);
      }
    }
    for (const dup of duplicates) {
      await txTable.where('categoryId').equals(dup.id).modify({ categoryId: dup.primaryId });
      await catTable.delete(dup.id);
    }
  }

  // Assign colors
  const categoriesNeedingColor = (await catTable.toArray()).filter((c) => !c.color);
  for (const cat of categoriesNeedingColor) {
    const color = CURATED_PALETTE[Math.floor(Math.random() * CURATED_PALETTE.length)]!;
    await catTable.update(cat.id!, { color });
  }

  await settingsTable.put({ key: 'categories_deduplicated', value: true });
  await settingsTable.put({ key: 'category_colors_migrated', value: true });
});

// v7: compute currentBalance for all wallets
db.version(7).stores(V7_STORES).upgrade(async (tx) => {
  const settingsTable = tx.table('settings');
  if (await settingsTable.get('wallet_balance_computed')) return;

  await settingsTable.put({ key: 'migration_in_progress', value: true });
  try {
    const wallets = await tx.table('wallets').toArray();
    const allTxs = await tx.table('transactions').toArray();
    for (const wallet of wallets) {
      const walletTxs = allTxs.filter((t) => t.walletId === wallet.id);
      let balance = wallet.initialBalance;
      for (const t of walletTxs) {
        balance += (t.type === 'expense' || t.type === 'transfer_out') ? -t.amount : t.amount;
      }
      await tx.table('wallets').update(wallet.id!, { currentBalance: balance });
    }
    await settingsTable.put({ key: 'wallet_balance_computed', value: true });
    await settingsTable.delete('migration_in_progress');
  } catch (err) {
    await settingsTable.put({ key: 'migration_failed_v7', value: String(err) });
    throw err;
  }
});

// v8/v9: add debt tables (identical store shape)
db.version(8).stores(V8_STORES);
db.version(9).stores(V8_STORES);

// v10: archivedAt on wallets (Dexie handles missing-field default for existing rows)
db.version(10).stores(V8_STORES).upgrade(async (tx) => {
  await tx.table('settings').put({ key: 'migration_completed_v10', value: true });
});

// v11: color on wallets; assign default to existing
db.version(11).stores(V8_STORES).upgrade(async (tx) => {
  const wallets = await tx.table('wallets').toArray();
  for (const wallet of wallets) {
    if (!wallet.color) await tx.table('wallets').update(wallet.id, { color: '#6366f1' });
  }
  await tx.table('settings').put({ key: 'migration_completed_v11', value: true });
});

// v12: archivedAt on categories
db.version(12).stores(V12_STORES).upgrade(async (tx) => {
  await tx.table('settings').put({ key: 'migration_completed_v12', value: true });
});

// v13: add merchants table; backfill entries from existing expenses
db.version(13).stores(V13_STORES).upgrade(async (tx) => {
  const settingsTable = tx.table('settings');
  if (await settingsTable.get('merchants_synced_v13')) return;

  const expenses = await tx.table('transactions').where('type').equals('expense').toArray();
  const nameByKey = new Map<string, string>();
  for (const t of expenses) {
    const key = t.description?.trim().toLowerCase();
    if (key && !nameByKey.has(key)) nameByKey.set(key, t.description.trim());
  }

  const now = new Date().toISOString();
  for (const name of nameByKey.values()) {
    await tx.table('merchants').add({
      displayName: name,
      originalName: name,
      aliases: [],
      archivedAt: null,
      mergedIntoId: null,
      createdAt: now,
      updatedAt: now,
    });
  }
  await settingsTable.put({ key: 'merchants_synced_v13', value: true });
});

export { db };
