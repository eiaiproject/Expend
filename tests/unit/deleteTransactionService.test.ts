/**
 * Tests for deleteTransactionService — transaction deletion and restoration.
 *
 * Financial invariants:
 * - deleting an expense rolls back the wallet balance
 * - deleting a transfer pair rolls back both wallets atomically
 * - restoring deleted transactions re-applies the balance changes
 * - restore with original IDs works even after auto-increment advances
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/db';
import { deleteTransactionsWithPairs, restoreTransactions } from '@/services/deleteTransactionService';

beforeEach(async () => {
  await db.transactions.clear();
  await db.wallets.clear();
  await db.categories.clear();
  await db.debts.clear();
  await db.debtPayments.clear();
  await db.settings.clear();
});

async function createWallet(name = 'Cash', initialBalance = 1_000_000): Promise<number> {
  const id = await db.wallets.add({
    name,
    currency: 'IDR',
    initialBalance,
    lastUpdated: '2025-01-01T00:00:00.000Z',
  });
  await db.wallets.update(id, { currentBalance: initialBalance });
  return id;
}

async function createCategory(name = 'Food'): Promise<number> {
  return db.categories.add({ name, icon: '🍔', color: '#FF0000' });
}

describe('deleteTransactionsWithPairs', () => {
  it('returns empty array when ids is empty', async () => {
    const result = await deleteTransactionsWithPairs([]);
    expect(result).toEqual([]);
  });

  it('deletes a single expense and rolls back wallet balance', async () => {
    const walletId = await createWallet();
    const catId = await createCategory();

    // Create expense: 1,000,000 - 50,000 = 950,000
    const txId = await db.transactions.add({
      walletId,
      categoryId: catId,
      date: '2025-01-15',
      description: 'Lunch',
      type: 'expense',
      amount: 50_000,
    });
    await db.wallets.update(walletId, { currentBalance: 950_000 });

    const backups = await deleteTransactionsWithPairs([txId as number]);

    // Balance rolled back: 950,000 + 50,000 = 1,000,000
    const wallet = await db.wallets.get(walletId);
    expect(wallet?.currentBalance).toBe(1_000_000);

    // Transaction deleted
    const tx = await db.transactions.get(txId);
    expect(tx).toBeUndefined();

    // Backup returned for undo — verify completeness
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatchObject({
      id: txId,
      walletId,
      categoryId: catId,
      date: '2025-01-15',
      description: 'Lunch',
      type: 'expense',
      amount: 50_000,
    });
  });

  it('deletes a transfer pair and rolls back both wallets', async () => {
    const walletA = await createWallet('A', 1_000_000);
    const walletB = await createWallet('B', 500_000);

    const groupId = 'test-transfer-1';
    const txOutId = await db.transactions.add({
      walletId: walletA,
      categoryId: null,
      date: '2025-01-15',
      description: 'Transfer (Out)',
      type: 'transfer_out',
      amount: 100_000,
      transferGroupId: groupId,
    });
    const txInId = await db.transactions.add({
      walletId: walletB,
      categoryId: null,
      date: '2025-01-15',
      description: 'Transfer (In)',
      type: 'transfer_in',
      amount: 100_000,
      transferGroupId: groupId,
    });
    await db.wallets.update(walletA, { currentBalance: 900_000 });
    await db.wallets.update(walletB, { currentBalance: 600_000 });

    // Delete just the outgoing side; the service should find and delete the incoming side too
    const backups = await deleteTransactionsWithPairs([txOutId as number]);

    // Both wallets rolled back
    const a = await db.wallets.get(walletA);
    const b = await db.wallets.get(walletB);
    expect(a?.currentBalance).toBe(1_000_000);
    expect(b?.currentBalance).toBe(500_000);

    // Both transactions deleted
    expect(await db.transactions.get(txOutId)).toBeUndefined();
    expect(await db.transactions.get(txInId)).toBeUndefined();

    // Backups include both sides with complete data
    expect(backups).toHaveLength(2);
    expect(backups).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: txOutId,
        walletId: walletA,
        date: '2025-01-15',
        description: 'Transfer (Out)',
        type: 'transfer_out',
        amount: 100_000,
        transferGroupId: groupId,
      }),
      expect.objectContaining({
        id: txInId,
        walletId: walletB,
        date: '2025-01-15',
        description: 'Transfer (In)',
        type: 'transfer_in',
        amount: 100_000,
        transferGroupId: groupId,
      }),
    ]));
  });

  it('deletes multiple independent transactions', async () => {
    const walletId = await createWallet();
    const catId = await createCategory();

    const tx1 = await db.transactions.add({
      walletId, categoryId: catId, date: '2025-01-15',
      description: 'Expense 1', type: 'expense', amount: 30_000,
    });
    const tx2 = await db.transactions.add({
      walletId, categoryId: catId, date: '2025-01-16',
      description: 'Expense 2', type: 'expense', amount: 20_000,
    });
    await db.wallets.update(walletId, { currentBalance: 950_000 });

    const backups = await deleteTransactionsWithPairs([tx1 as number, tx2 as number]);

    // Balance: 1,000,000 - 30,000 - 20,000 = 950,000 → rollback → 1,000,000
    const wallet = await db.wallets.get(walletId);
    expect(wallet?.currentBalance).toBe(1_000_000);
    expect(backups).toHaveLength(2);
  });
});

describe('restoreTransactions', () => {
  it('restores a deleted expense and re-applies wallet balance', async () => {
    const walletId = await createWallet();
    const catId = await createCategory();

    // Create expense, delete it, then restore
    const txId = await db.transactions.add({
      walletId, categoryId: catId, date: '2025-01-15',
      description: 'Lunch', type: 'expense', amount: 50_000,
    });
    await db.wallets.update(walletId, { currentBalance: 950_000 });

    const backups = await deleteTransactionsWithPairs([txId as number]);
    expect((await db.wallets.get(walletId))?.currentBalance).toBe(1_000_000);

    // Restore
    await restoreTransactions(backups);

    // Balance re-applied: 1,000,000 - 50,000 = 950,000
    const wallet = await db.wallets.get(walletId);
    expect(wallet?.currentBalance).toBe(950_000);

    // Transaction restored with original ID
    const tx = await db.transactions.get(txId);
    expect(tx).toBeTruthy();
    expect(tx?.type).toBe('expense');
    expect(tx?.amount).toBe(50_000);
  });

  it('restores a transfer pair and re-applies both wallet balances', async () => {
    const walletA = await createWallet('A', 1_000_000);
    const walletB = await createWallet('B', 500_000);

    const groupId = 'test-restore-1';
    const txOutId = await db.transactions.add({
      walletId: walletA, categoryId: null, date: '2025-01-15',
      description: 'Transfer (Out)', type: 'transfer_out', amount: 100_000, transferGroupId: groupId,
    });
    const txInId = await db.transactions.add({
      walletId: walletB, categoryId: null, date: '2025-01-15',
      description: 'Transfer (In)', type: 'transfer_in', amount: 100_000, transferGroupId: groupId,
    });
    await db.wallets.update(walletA, { currentBalance: 900_000 });
    await db.wallets.update(walletB, { currentBalance: 600_000 });

    const backups = await deleteTransactionsWithPairs([txOutId as number]);
    expect((await db.wallets.get(walletA))?.currentBalance).toBe(1_000_000);
    expect((await db.wallets.get(walletB))?.currentBalance).toBe(500_000);

    // Restore
    await restoreTransactions(backups);

    const a = await db.wallets.get(walletA);
    const b = await db.wallets.get(walletB);
    expect(a?.currentBalance).toBe(900_000);
    expect(b?.currentBalance).toBe(600_000);

    // Both transactions restored with complete data
    expect(await db.transactions.get(txOutId)).toMatchObject({
      walletId: walletA,
      transferGroupId: groupId,
      description: 'Transfer (Out)',
      type: 'transfer_out',
      amount: 100_000,
    });
    expect(await db.transactions.get(txInId)).toMatchObject({
      walletId: walletB,
      transferGroupId: groupId,
      description: 'Transfer (In)',
      type: 'transfer_in',
      amount: 100_000,
    });
  });

  it('does nothing when given an empty array', async () => {
    const walletId = await createWallet();
    await restoreTransactions([]);
    const wallet = await db.wallets.get(walletId);
    expect(wallet?.currentBalance).toBe(1_000_000);
  });

  it('restores with original IDs even after auto-increment advances', async () => {
    const walletId = await createWallet();
    const catId = await createCategory();

    // Create expense
    const txId = await db.transactions.add({
      walletId, categoryId: catId, date: '2025-01-15',
      description: 'Original', type: 'expense', amount: 10_000,
    });
    await db.wallets.update(walletId, { currentBalance: 990_000 });

    // Delete it
    const backups = await deleteTransactionsWithPairs([txId as number]);

    // Create a new transaction to advance the auto-increment counter
    await db.transactions.add({
      walletId, categoryId: catId, date: '2025-01-16',
      description: 'New expense', type: 'expense', amount: 20_000,
    });
    await db.wallets.update(walletId, { currentBalance: 970_000 });

    // Restore the original — must use bulkPut to re-insert with original ID
    await restoreTransactions(backups);

    const restored = await db.transactions.get(txId);
    expect(restored).toBeTruthy();
    expect(restored?.description).toBe('Original');

    // Restore re-applies the expense delta (-10,000): 970,000 - 10,000 = 960,000
    const wallet = await db.wallets.get(walletId);
    expect(wallet?.currentBalance).toBe(960_000);
  });
});
