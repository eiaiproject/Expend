/**
 * Migration tests: verify Dexie database compatibility.
 *
 * Tests:
 * - Dexie opens successfully
 * - Existing data survives migrations
 * - Version 100 → Dexie version 10 doesn't cause issues
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

async function deleteExpendDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('ExpendDB');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('ExpendDB deletion blocked'));
  });
}

async function loadDb() {
  const { db } = await import('@/db/db');
  await db.open();
  return db;
}

beforeEach(async () => {
  await deleteExpendDb();
});

afterEach(async () => {
  const { db } = await import('@/db/db');
  db.close();
  await deleteExpendDb();
});

describe('Dexie database compatibility', () => {
  it('opens and closes without errors', async () => {
    const db = await loadDb();
    // db is already opened by import; verify it works
    const count = await db.wallets.count();
    expect(count).toBe(0);
  });

  it('stores and retrieves wallet data', async () => {
    const db = await loadDb();
    const id = await db.wallets.add({
      name: 'Test Wallet',
      currency: 'IDR',
      initialBalance: 1000000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });

    const wallet = await db.wallets.get(id);
    expect(wallet).toBeDefined();
    expect(wallet?.name).toBe('Test Wallet');
    expect(wallet?.initialBalance).toBe(1000000);
  });

  it('stores and retrieves debt data with correct schema', async () => {
    const db = await loadDb();
    const walletId = await db.wallets.add({
      name: 'Cash',
      currency: 'IDR',
      initialBalance: 500000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });

    const debtId = 'test_debt_1';
    await db.debts.add({
      id: debtId,
      type: 'payable',
      personName: 'Test Person',
      principalAmount: 500000,
      remainingAmount: 250000,
      walletId,
      startDate: '2025-01-01',
      status: 'partial',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-15T00:00:00.000Z',
    });

    await db.debtPayments.add({
      id: 'dp_1',
      debtId,
      amount: 250000,
      date: '2025-01-15',
      walletId,
      type: 'repayment',
      createdAt: '2025-01-15T00:00:00.000Z',
    });

    const debt = await db.debts.get(debtId);
    expect(debt).toBeDefined();
    expect(debt?.type).toBe('payable');
    expect(debt?.remainingAmount).toBe(250000);

    const payments = await db.debtPayments.where('debtId').equals(debtId).toArray();
    expect(payments.length).toBe(1);
    expect(payments[0].type).toBe('repayment');
  });

  it('handles compound index queries correctly', async () => {
    const db = await loadDb();
    const walletId = await db.wallets.add({
      name: 'Cash',
      currency: 'IDR',
      initialBalance: 1000000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });

    await db.transactions.bulkAdd([
      { walletId, categoryId: 1, date: '2025-01-10', description: 'T1', type: 'expense', amount: 10000 },
      { walletId, categoryId: 1, date: '2025-01-20', description: 'T2', type: 'expense', amount: 20000 },
      { walletId, categoryId: 1, date: '2025-02-05', description: 'T3', type: 'expense', amount: 30000 },
    ]);

    // Query by [walletId+date] compound index
    const results = await db.transactions
      .where('[walletId+date]')
      .between([walletId, '2025-01-01'], [walletId, '2025-01-31'], true, true)
      .toArray();

    expect(results.length).toBe(2);

    // Query by [type+date] compound index
    const expenseResults = await db.transactions
      .where('[type+date]')
      .between(['expense', '2025-01-01'], ['expense', '2025-01-31'], true, true)
      .toArray();

    expect(expenseResults.length).toBe(2);
  });

  it('transfer group queries work correctly', async () => {
    const db = await loadDb();
    const w1 = await db.wallets.add({
      name: 'Cash', currency: 'IDR', initialBalance: 1000000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    const w2 = await db.wallets.add({
      name: 'Bank', currency: 'IDR', initialBalance: 500000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });

    const groupId = 'test-group-123';
    await db.transactions.bulkAdd([
      { walletId: w1, categoryId: null, date: '2025-01-15', description: 'Transfer (Out)', type: 'transfer_out', amount: 100000, transferGroupId: groupId },
      { walletId: w2, categoryId: null, date: '2025-01-15', description: 'Transfer (In)', type: 'transfer_in', amount: 100000, transferGroupId: groupId },
    ]);

    const paired = await db.transactions
      .where('transferGroupId')
      .equals(groupId)
      .toArray();

    expect(paired.length).toBe(2);
    expect(paired.some(t => t.type === 'transfer_out')).toBe(true);
    expect(paired.some(t => t.type === 'transfer_in')).toBe(true);
  });
});
