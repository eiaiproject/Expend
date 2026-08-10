import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { seedSampleData } from '@/utils/seedSample';

beforeEach(async () => {
  await db.transactions.clear();
  await db.wallets.clear();
  await db.categories.clear();
  await db.debts.clear();
  await db.debtPayments.clear();
  await db.settings.clear();
});

describe('seedSampleData', () => {
  it('adds exactly 50 expense transactions across 10 payees', async () => {
    const count = await seedSampleData();
    expect(count).toBe(50);

    const txs = await db.transactions.toArray();
    expect(txs).toHaveLength(50);
    expect(txs.every((t) => t.type === 'expense')).toBe(true);
    expect(new Set(txs.map((t) => t.description)).size).toBe(10);
  });

  it('creates a default wallet and matching categories when none exist', async () => {
    await seedSampleData();

    const wallets = await db.wallets.toArray();
    expect(wallets.length).toBeGreaterThan(0);

    const categories = await db.categories.toArray();
    const txs = await db.transactions.toArray();
    for (const tx of txs) {
      expect(categories.some((c) => c.id === tx.categoryId)).toBe(true);
    }
  });

  it('is idempotent via the settings marker', async () => {
    expect(await seedSampleData()).toBe(50);
    expect(await seedSampleData()).toBe(0);
    expect(await db.transactions.count()).toBe(50);
  });

  it('is additive on top of existing transactions', async () => {
    await db.wallets.add({
      name: 'Cash',
      currency: 'IDR',
      initialBalance: 0,
      currentBalance: 0,
      lastUpdated: '2026-01-01T00:00:00.000Z',
    });
    await db.transactions.add({
      walletId: 1,
      categoryId: null,
      date: '2026-01-01',
      description: 'Existing',
      type: 'expense',
      amount: 5000,
    });

    expect(await seedSampleData()).toBe(50);
    expect(await db.transactions.count()).toBe(51);
  });
});
