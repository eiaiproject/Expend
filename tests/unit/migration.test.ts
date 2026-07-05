/**
 * Migration tests: verify legacy debt schema repair and Dexie compatibility.
 *
 * Tests:
 * - Legacy DB with old debt_payments store can be repaired
 * - Dexie opens successfully after native repair
 * - Existing data survives the repair
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

async function createLegacyDebtDatabase(): Promise<void> {
  await deleteExpendDb();

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('ExpendDB', 80);

    request.onupgradeneeded = () => {
      const nativeDb = request.result;
      const wallets = nativeDb.createObjectStore('wallets', { keyPath: 'id', autoIncrement: true });
      for (const indexName of ['name', 'currency', 'lastUpdated', 'currentBalance']) {
        wallets.createIndex(indexName, indexName);
      }

      const transactions = nativeDb.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
      for (const indexName of ['walletId', 'categoryId', 'date', 'description', 'type', 'amount', 'transferGroupId']) {
        transactions.createIndex(indexName, indexName);
      }
      transactions.createIndex('[type+date]', ['type', 'date']);
      transactions.createIndex('[walletId+date]', ['walletId', 'date']);
      transactions.createIndex('[categoryId+date]', ['categoryId', 'date']);

      const categories = nativeDb.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
      for (const indexName of ['name', 'icon', 'color', 'budget']) {
        categories.createIndex(indexName, indexName);
      }

      const debts = nativeDb.createObjectStore('debts', { keyPath: 'id', autoIncrement: true });
      const debtPayments = nativeDb.createObjectStore('debt_payments', { keyPath: 'id', autoIncrement: true });
      nativeDb.createObjectStore('settings', { keyPath: 'key' });

      wallets.put({
        id: 1,
        name: 'Legacy Wallet',
        currency: 'IDR',
        initialBalance: 1000000,
        currentBalance: 1000000,
        lastUpdated: '2025-01-01T00:00:00.000Z',
      });
      debts.put({
        id: 1,
        type: 'payable',
        contactName: 'Legacy Person',
        description: 'Old loan',
        amount: 500000,
        remainingAmount: 300000,
        walletId: 1,
        startDate: '2025-01-01T00:00:00.000Z',
        status: 'partial',
        createdAt: '2025-01-01T00:00:00.000Z',
      });
      debtPayments.put({
        id: 1,
        debtId: 1,
        amount: 200000,
        date: '2025-01-10T00:00:00.000Z',
        walletId: 1,
        type: 'repayment',
        note: 'Legacy repayment',
        createdAt: '2025-01-10T00:00:00.000Z',
      });
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
  });
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
  it('repairs legacy debt_payments schema before Dexie opens', async () => {
    await createLegacyDebtDatabase();

    const db = await loadDb();
    const debts = await db.debts.toArray();
    const payments = await db.debtPayments.toArray();

    expect(db.backendDB().version).toBe(110);
    expect(db.backendDB().objectStoreNames.contains('debt_payments')).toBe(false);
    expect(debts).toHaveLength(1);
    expect(debts[0]).toMatchObject({
      id: 'legacy_debt_1',
      personName: 'Legacy Person',
      title: 'Old loan',
      principalAmount: 500000,
      remainingAmount: 300000,
      walletId: 1,
      startDate: '2025-01-01',
      status: 'partial',
    });
    expect(payments).toHaveLength(2);
    expect(payments.map((payment) => payment.type).sort()).toEqual(['initial', 'repayment']);
    expect(payments.find((payment) => payment.type === 'repayment')).toMatchObject({
      debtId: 'legacy_debt_1',
      amount: 200000,
      date: '2025-01-10',
      notes: 'Legacy repayment',
    });
  });

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
