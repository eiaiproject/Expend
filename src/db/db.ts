import Dexie, { type EntityTable } from 'dexie';
import { CURATED_PALETTE } from '../utils/constants';
import { generateTransferGroupId } from '../utils/cryptoUtils';

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

export interface Setting {
  key: string;
  value: unknown;
}

const db = new Dexie('ExpendDB') as Dexie & {
  wallets: EntityTable<Wallet, 'id'>;
  categories: EntityTable<Category, 'id'>;
  transactions: EntityTable<Transaction, 'id'>;
  settings: EntityTable<Setting, 'key'>;
};

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

export { db };
