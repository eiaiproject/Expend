/**
 * Tests for walletService — wallet deletion, balance adjustment, and financial invariants.
 *
 * Financial invariants:
 * - expense decreases wallet balance
 * - transfer_out decreases source wallet balance
 * - transfer_in increases destination wallet balance
 * - balance_adjustment is signed delta
 * - deleting any transaction applies inverse balance delta
 * - deleting a transfer pair rolls back both wallets
 * - deleting a wallet rolls back all affected wallets
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/db';
import { deleteWalletSafely, adjustWalletBalance, ensureDefaultWallet } from '@/services/walletService';
import { getBalanceDelta } from '@/utils/balanceUtils';

describe('ensureDefaultWallet', () => {
  beforeEach(async () => {
    await db.transactions.clear();
    await db.wallets.clear();
    await db.categories.clear();
    await db.debts.clear();
    await db.debtPayments.clear();
    await db.schedules.clear();
    await db.settings.clear();
  });

  it('membuat dompet default saat DB kosong', async () => {
    await ensureDefaultWallet('Main Wallet');
    const wallets = await db.wallets.toArray();
    expect(wallets).toHaveLength(1);
    expect(wallets[0]!.name).toBe('Main Wallet');
    expect(wallets[0]!.currentBalance).toBe(0);
  });

  it('idempoten: panggilan ulang TIDAK menambah dompet', async () => {
    await ensureDefaultWallet('Main Wallet');
    await ensureDefaultWallet('Main Wallet');
    await ensureDefaultWallet('Main Wallet');
    expect(await db.wallets.count()).toBe(1);
  });

  it('tidak melakukan apa pun saat sudah ada dompet (mis. dari onboarding)', async () => {
    await db.wallets.add({ name: 'BCA', currency: 'IDR', initialBalance: 1000, currentBalance: 1000, lastUpdated: new Date().toISOString() });
    await ensureDefaultWallet('Main Wallet');
    const names = (await db.wallets.toArray()).map(w => w.name);
    expect(names).toEqual(['BCA']);
  });
});

// Each test gets a fresh DB via fake-indexeddb
beforeEach(async () => {
  // Delete all tables
  await db.transactions.clear();
  await db.wallets.clear();
  await db.categories.clear();
  await db.debts.clear();
  await db.debtPayments.clear();
  await db.schedules.clear();
  await db.settings.clear();
});

describe('getBalanceDelta', () => {
  it('expense decreases balance', () => {
    expect(getBalanceDelta('expense', 100000)).toBe(-100000);
  });

  it('transfer_out decreases balance', () => {
    expect(getBalanceDelta('transfer_out', 50000)).toBe(-50000);
  });

  it('transfer_in increases balance', () => {
    expect(getBalanceDelta('transfer_in', 200000)).toBe(200000);
  });

  it('balance_adjustment signed delta', () => {
    expect(getBalanceDelta('balance_adjustment', 10000)).toBe(10000);
    expect(getBalanceDelta('balance_adjustment', -10000)).toBe(-10000);
  });
});

describe('deleteWalletSafely', () => {
  it('Scenario A: Delete wallet A after A→B transfer; B returns to original balance', async () => {
    // Setup: Wallet A = 1,000,000, Wallet B = 500,000
    const walletAId = await db.wallets.add({
      name: 'Wallet A', currency: 'IDR', initialBalance: 1000000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    const walletBId = await db.wallets.add({
      name: 'Wallet B', currency: 'IDR', initialBalance: 500000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    await db.wallets.update(walletAId, { currentBalance: 1000000 });
    await db.wallets.update(walletBId, { currentBalance: 500000 });

    // Transfer A → B: 100,000
    const groupId = 'test-transfer-ab-1';
    await db.transactions.bulkAdd([
      {
        walletId: walletAId, categoryId: null, date: '2025-01-15',
        description: 'Transfer (Out)', type: 'transfer_out',
        amount: 100000, transferGroupId: groupId,
      },
      {
        walletId: walletBId, categoryId: null, date: '2025-01-15',
        description: 'Transfer (In)', type: 'transfer_in',
        amount: 100000, transferGroupId: groupId,
      },
    ]);
    await db.wallets.update(walletAId, { currentBalance: 900000 });
    await db.wallets.update(walletBId, { currentBalance: 600000 });

    // Delete Wallet A
    const result = await deleteWalletSafely(walletAId);
    expect(result.success).toBe(true);

    // Wallet B must return to 500,000
    const walletB = await db.wallets.get(walletBId);
    expect(walletB?.currentBalance).toBe(500000);

    // Paired transfer in B must be removed
    const remainingB = await db.transactions.where('walletId').equals(walletBId).toArray();
    expect(remainingB).toHaveLength(0);

    // Wallet A must be gone
    const walletAGone = await db.wallets.get(walletAId);
    expect(walletAGone).toBeUndefined();
  });

  it('Scenario B: Delete wallet B after A→B transfer; A returns to original', async () => {
    const walletAId = await db.wallets.add({
      name: 'Wallet A', currency: 'IDR', initialBalance: 1000000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    const walletBId = await db.wallets.add({
      name: 'Wallet B', currency: 'IDR', initialBalance: 500000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    await db.wallets.update(walletAId, { currentBalance: 1000000 });
    await db.wallets.update(walletBId, { currentBalance: 500000 });

    const groupId = 'test-transfer-ab-2';
    await db.transactions.bulkAdd([
      {
        walletId: walletAId, categoryId: null, date: '2025-01-15',
        description: 'Transfer (Out)', type: 'transfer_out',
        amount: 100000, transferGroupId: groupId,
      },
      {
        walletId: walletBId, categoryId: null, date: '2025-01-15',
        description: 'Transfer (In)', type: 'transfer_in',
        amount: 100000, transferGroupId: groupId,
      },
    ]);
    await db.wallets.update(walletAId, { currentBalance: 900000 });
    await db.wallets.update(walletBId, { currentBalance: 600000 });

    // Delete Wallet B
    const result = await deleteWalletSafely(walletBId);
    expect(result.success).toBe(true);

    // Wallet A must return to 1,000,000
    const walletA = await db.wallets.get(walletAId);
    expect(walletA?.currentBalance).toBe(1000000);

    // Paired transfer in A must be removed
    const remainingA = await db.transactions.where('walletId').equals(walletAId).toArray();
    expect(remainingA).toHaveLength(0);
  });

  it('Scenario C: Reject deleting wallet with expenses; other wallets unaffected', async () => {
    const walletAId = await db.wallets.add({
      name: 'Wallet A', currency: 'IDR', initialBalance: 1000000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    const walletBId = await db.wallets.add({
      name: 'Wallet B', currency: 'IDR', initialBalance: 500000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    await db.wallets.update(walletAId, { currentBalance: 1000000 });
    await db.wallets.update(walletBId, { currentBalance: 500000 });

    // Add expense to Wallet A
    const catId = await db.categories.add({ name: 'Food', icon: '🍔', color: '#FF0000' });
    await db.transactions.add({
      walletId: walletAId, categoryId: catId, date: '2025-01-15',
      description: 'Lunch', type: 'expense', amount: 50000,
    });
    await db.wallets.update(walletAId, { currentBalance: 950000 });

    // Add expense to Wallet B
    await db.transactions.add({
      walletId: walletBId, categoryId: catId, date: '2025-01-15',
      description: 'Dinner', type: 'expense', amount: 30000,
    });
    await db.wallets.update(walletBId, { currentBalance: 470000 });

    const result = await deleteWalletSafely(walletAId);
    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/associated transaction/i);

    // Wallet B must be unaffected
    const walletB = await db.wallets.get(walletBId);
    expect(walletB?.currentBalance).toBe(470000);

    // Wallet A must remain because expense history blocks deletion.
    const walletA = await db.wallets.get(walletAId);
    expect(walletA).toBeTruthy();
    expect(walletA?.currentBalance).toBe(950000);

    // Wallet B transactions must remain
    const bTxs = await db.transactions.where('walletId').equals(walletBId).toArray();
    expect(bTxs).toHaveLength(1);
  });

  it('Scenario E: Reject deleting a wallet referenced by a recurring schedule', async () => {
    const walletId = await db.wallets.add({
      name: 'Wallet A', currency: 'IDR', initialBalance: 1000000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    await db.wallets.update(walletId, { currentBalance: 1000000 });

    const catId = await db.categories.add({ name: 'Rent', icon: '🏠', color: '#0000FF' });
    await db.schedules.add({
      id: 'schedule_test_1', type: 'expense', frequency: 'monthly',
      startDate: '2025-01-01', nextOccurrence: '2025-02-01', endDate: null,
      amount: 1000000, categoryId: catId, walletId, payee: 'Rent',
      mode: 'create', active: true, lastProcessedOccurrence: null,
      createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z',
    });

    const result = await deleteWalletSafely(walletId);
    expect(result.success).toBe(false);
    expect(result.reasonKey).toBe('wallet.deleteBlockedSchedules');
    expect(result.reason).toMatch(/schedule/i);

    // Wallet and schedule remain intact
    const wallet = await db.wallets.get(walletId);
    expect(wallet).toBeTruthy();
    const schedule = await db.schedules.get('schedule_test_1');
    expect(schedule).toBeTruthy();
  });

  it('Scenario D: Delete wallet with multiple transfer pairs; all other wallets corrected', async () => {
    const walletAId = await db.wallets.add({
      name: 'Wallet A', currency: 'IDR', initialBalance: 1000000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    const walletBId = await db.wallets.add({
      name: 'Wallet B', currency: 'IDR', initialBalance: 500000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    const walletCId = await db.wallets.add({
      name: 'Wallet C', currency: 'IDR', initialBalance: 300000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    await db.wallets.update(walletAId, { currentBalance: 1000000 });
    await db.wallets.update(walletBId, { currentBalance: 500000 });
    await db.wallets.update(walletCId, { currentBalance: 300000 });

    // Transfer A→B: 100,000
    const g1 = 'test-group-1';
    await db.transactions.bulkAdd([
      { walletId: walletAId, categoryId: null, date: '2025-01-10', description: 'T1 (Out)', type: 'transfer_out', amount: 100000, transferGroupId: g1 },
      { walletId: walletBId, categoryId: null, date: '2025-01-10', description: 'T1 (In)', type: 'transfer_in', amount: 100000, transferGroupId: g1 },
    ]);

    // Transfer A→C: 200,000
    const g2 = 'test-group-2';
    await db.transactions.bulkAdd([
      { walletId: walletAId, categoryId: null, date: '2025-01-12', description: 'T2 (Out)', type: 'transfer_out', amount: 200000, transferGroupId: g2 },
      { walletId: walletCId, categoryId: null, date: '2025-01-12', description: 'T2 (In)', type: 'transfer_in', amount: 200000, transferGroupId: g2 },
    ]);

    await db.wallets.update(walletAId, { currentBalance: 700000 });
    await db.wallets.update(walletBId, { currentBalance: 600000 });
    await db.wallets.update(walletCId, { currentBalance: 500000 });

    // Delete Wallet A
    const result = await deleteWalletSafely(walletAId);
    expect(result.success).toBe(true);

    // Wallet B returns to 500,000
    const walletB = await db.wallets.get(walletBId);
    expect(walletB?.currentBalance).toBe(500000);

    // Wallet C returns to 300,000
    const walletC = await db.wallets.get(walletCId);
    expect(walletC?.currentBalance).toBe(300000);

    // No orphaned transfers remain
    const bTxs = await db.transactions.where('walletId').equals(walletBId).toArray();
    expect(bTxs).toHaveLength(0);
    const cTxs = await db.transactions.where('walletId').equals(walletCId).toArray();
    expect(cTxs).toHaveLength(0);
  });
});

describe('adjustWalletBalance', () => {
  it('increasing balance creates correct adjustment', async () => {
    const walletId = await db.wallets.add({
      name: 'Cash', currency: 'IDR', initialBalance: 500000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    await db.wallets.update(walletId, { currentBalance: 500000 });

    await adjustWalletBalance(walletId, 750000, { description: 'Top up' });

    const wallet = await db.wallets.get(walletId);
    expect(wallet?.currentBalance).toBe(750000);

    const adjustments = await db.transactions
      .where('type').equals('balance_adjustment')
      .and(t => t.walletId === walletId)
      .toArray();
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0].amount).toBe(250000); // signed delta
    expect(adjustments[0].description).toBe('Top up');
  });

  it('decreasing balance creates correct adjustment', async () => {
    const walletId = await db.wallets.add({
      name: 'Cash', currency: 'IDR', initialBalance: 500000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    await db.wallets.update(walletId, { currentBalance: 500000 });

    await adjustWalletBalance(walletId, 300000, { description: 'Withdrawal' });

    const wallet = await db.wallets.get(walletId);
    expect(wallet?.currentBalance).toBe(300000);

    const adjustments = await db.transactions
      .where('type').equals('balance_adjustment')
      .and(t => t.walletId === walletId)
      .toArray();
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0].amount).toBe(-200000); // signed delta
  });

  it('currentBalance equals requested absolute balance', async () => {
    const walletId = await db.wallets.add({
      name: 'Cash', currency: 'IDR', initialBalance: 100000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    await db.wallets.update(walletId, { currentBalance: 100000 });

    await adjustWalletBalance(walletId, 999999);

    const wallet = await db.wallets.get(walletId);
    expect(wallet?.currentBalance).toBe(999999);
  });

  it('no adjustment created when balance unchanged', async () => {
    const walletId = await db.wallets.add({
      name: 'Cash', currency: 'IDR', initialBalance: 500000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    await db.wallets.update(walletId, { currentBalance: 500000 });

    await adjustWalletBalance(walletId, 500000);

    const adjustments = await db.transactions
      .where('type').equals('balance_adjustment')
      .and(t => t.walletId === walletId)
      .toArray();
    expect(adjustments).toHaveLength(0);
  });
});
