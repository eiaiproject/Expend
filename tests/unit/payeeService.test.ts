import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import {
  filterTransactionsByPayee,
  getPayeeStatsFromTransactions,
  normalizePayeeKey,
  normalizePayeeName,
} from '@/services/payeeService';

beforeEach(async () => {
  await db.transactions.clear();
  await db.wallets.clear();
  await db.categories.clear();
});

async function createWalletAndCategory(): Promise<{ walletId: number; categoryId: number }> {
  const walletId = await db.wallets.add({
    name: 'Cash',
    currency: 'IDR',
    initialBalance: 1_000_000,
    currentBalance: 1_000_000,
    lastUpdated: '2026-01-01T00:00:00.000Z',
  });
  const categoryId = await db.categories.add({
    name: 'Food',
    icon: 'utensils',
    color: '#ef4444',
  });

  return { walletId, categoryId };
}

describe('payeeService', () => {
  it('preserves user casing for display names', () => {
    expect(normalizePayeeName('  SD  ')).toBe('SD');
    expect(normalizePayeeName('iBox')).toBe('iBox');
    expect(normalizePayeeName('  iBox   Store  ')).toBe('iBox Store');
    expect(normalizePayeeKey('iBox')).toBe('ibox');
  });

  it('groups payees case-insensitively without title-casing the display name', async () => {
    const { walletId, categoryId } = await createWalletAndCategory();

    await db.transactions.bulkAdd([
      { walletId, categoryId, date: '2026-01-01', description: 'SD', type: 'expense', amount: 10_000 },
      { walletId, categoryId, date: '2026-01-02', description: 'sd', type: 'expense', amount: 15_000 },
    ]);

    const payees = await getPayeeStatsFromTransactions();
    const transactions = await filterTransactionsByPayee('SD');

    expect(payees).toHaveLength(1);
    expect(payees[0]).toMatchObject({
      key: 'sd',
      name: 'SD',
      totalExpense: 25_000,
      transactionCount: 2,
    });
    expect(transactions).toHaveLength(2);
  });

  it('keeps free-form casing after renaming a payee group', async () => {
    const { walletId, categoryId } = await createWalletAndCategory();

    await db.transactions.bulkAdd([
      { walletId, categoryId, date: '2026-01-01', description: 'SD', type: 'expense', amount: 10_000 },
      { walletId, categoryId, date: '2026-01-02', description: 'sd', type: 'expense', amount: 15_000 },
    ]);

    await db.transactions
      .where('type')
      .equals('expense')
      .filter((tx) => normalizePayeeKey(tx.description) === 'sd')
      .modify({ description: 'iBox' });

    const payees = await getPayeeStatsFromTransactions();

    expect(payees).toHaveLength(1);
    expect(payees[0]).toMatchObject({
      key: 'ibox',
      name: 'iBox',
      transactionCount: 2,
    });
  });
});
