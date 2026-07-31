/**
 * Tests for transactionSaveService — service-level validation and financial mutations.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/db';
import { INSUFFICIENT_WALLET_BALANCE_MESSAGE, saveTransaction, saveTransfer, updateTransfer } from '@/services/transactionSaveService';

beforeEach(async () => {
  await db.transactions.clear();
  await db.wallets.clear();
  await db.categories.clear();
  await db.debts.clear();
  await db.debtPayments.clear();
  await db.settings.clear();
});

async function createTestWallet(name = 'Cash', initialBalance = 1_000_000): Promise<number> {
  const id = await db.wallets.add({
    name,
    currency: 'IDR',
    initialBalance,
    lastUpdated: '2025-01-01T00:00:00.000Z',
  });
  await db.wallets.update(id, { currentBalance: initialBalance });
  return id;
}

async function createTestCategory(name = 'Food'): Promise<number> {
  return db.categories.add({ name, icon: '🍔', color: '#FF0000' });
}

describe('saveTransaction validation', () => {
  it('rejects zero amount', async () => {
    const walletId = await createTestWallet();
    const catId = await createTestCategory();
    await expect(
      saveTransaction({ amount: 0, description: 'Test', date: '2025-01-15', walletId, categoryId: catId, notes: '', type: 'expense' })
    ).rejects.toThrow();
  });

  it('rejects negative amount for expense', async () => {
    const walletId = await createTestWallet();
    const catId = await createTestCategory();
    await expect(
      saveTransaction({ amount: -100, description: 'Test', date: '2025-01-15', walletId, categoryId: catId, notes: '', type: 'expense' })
    ).rejects.toThrow();
  });

  it('rejects blank description', async () => {
    const walletId = await createTestWallet();
    const catId = await createTestCategory();
    await expect(
      saveTransaction({ amount: 100, description: '', date: '2025-01-15', walletId, categoryId: catId, notes: '', type: 'expense' })
    ).rejects.toThrow();
  });

  it('rejects invalid date format', async () => {
    const walletId = await createTestWallet();
    const catId = await createTestCategory();
    await expect(
      saveTransaction({ amount: 100, description: 'Test', date: 'not-a-date', walletId, categoryId: catId, notes: '', type: 'expense' })
    ).rejects.toThrow();
  });

  it('accepts valid expense and updates wallet balance', async () => {
    const walletId = await createTestWallet();
    const catId = await createTestCategory();

    await saveTransaction({
      amount: 50_000,
      description: 'Lunch',
      date: '2025-01-15',
      walletId,
      categoryId: catId,
      notes: '',
      type: 'expense',
    });

    const wallet = await db.wallets.get(walletId);
    expect(wallet?.currentBalance).toBe(950_000);

    const txs = await db.transactions.where('walletId').equals(walletId).toArray();
    expect(txs).toHaveLength(1);
    expect(txs[0].type).toBe('expense');
    expect(txs[0].amount).toBe(50_000);
  });

  it('rejects expense when wallet balance is insufficient', async () => {
    const walletId = await createTestWallet('Cash', 0);
    const catId = await createTestCategory();

    await expect(
      saveTransaction({
        amount: 50_000,
        description: 'Lunch',
        date: '2025-01-15',
        walletId,
        categoryId: catId,
        notes: '',
        type: 'expense',
      })
    ).rejects.toThrow(INSUFFICIENT_WALLET_BALANCE_MESSAGE);

    const wallet = await db.wallets.get(walletId);
    expect(wallet?.currentBalance).toBe(0);
    expect(await db.transactions.count()).toBe(0);
  });

  it('rejects expense edits that would overdraw the wallet', async () => {
    const walletId = await createTestWallet('Cash', 100_000);
    const catId = await createTestCategory();

    await saveTransaction({
      amount: 40_000,
      description: 'Lunch',
      date: '2025-01-15',
      walletId,
      categoryId: catId,
      notes: '',
      type: 'expense',
    });
    const [tx] = await db.transactions.where('walletId').equals(walletId).toArray();

    await expect(
      saveTransaction({
        amount: 120_000,
        description: 'Dinner',
        date: '2025-01-15',
        walletId,
        categoryId: catId,
        notes: '',
        type: 'expense',
      }, tx.id)
    ).rejects.toThrow(INSUFFICIENT_WALLET_BALANCE_MESSAGE);

    const wallet = await db.wallets.get(walletId);
    expect(wallet?.currentBalance).toBe(60_000);
    const storedTx = await db.transactions.get(tx.id!);
    expect(storedTx?.amount).toBe(40_000);
  });

  it('accepts negative amount for balance_adjustment', async () => {
    const walletId = await createTestWallet();

    await saveTransaction({
      amount: -200_000,
      description: 'Withdrawal',
      date: '2025-01-15',
      walletId,
      categoryId: null,
      notes: '',
      type: 'balance_adjustment',
    });

    const wallet = await db.wallets.get(walletId);
    // 1,000,000 - 200,000 = 800,000
    expect(wallet?.currentBalance).toBe(800_000);

    const adjustments = await db.transactions
      .where('type').equals('balance_adjustment')
      .and(t => t.walletId === walletId)
      .toArray();
    expect(adjustments[0].amount).toBe(-200_000);
  });
});

describe('saveTransfer validation', () => {
  it('rejects same wallet transfer', async () => {
    const walletId = await createTestWallet();
    await expect(
      saveTransfer({ amount: 100, description: 'Self', date: '2025-01-15', fromWalletId: walletId, toWalletId: walletId, notes: '' })
    ).rejects.toThrow();
  });

  it('rejects zero amount', async () => {
    const w1 = await createTestWallet('A');
    const w2 = await createTestWallet('B', 500_000);
    await expect(
      saveTransfer({ amount: 0, description: 'T', date: '2025-01-15', fromWalletId: w1, toWalletId: w2, notes: '' })
    ).rejects.toThrow();
  });

  it('rejects negative amount', async () => {
    const w1 = await createTestWallet('A');
    const w2 = await createTestWallet('B', 500_000);
    await expect(
      saveTransfer({ amount: -100, description: 'T', date: '2025-01-15', fromWalletId: w1, toWalletId: w2, notes: '' })
    ).rejects.toThrow();
  });

  it('creates transfer pair and updates both wallets', async () => {
    const w1 = await createTestWallet('A');
    const w2 = await createTestWallet('B', 500_000);

    await saveTransfer({
      amount: 100_000,
      description: 'Transfer',
      date: '2025-01-15',
      fromWalletId: w1,
      toWalletId: w2,
      notes: '',
    });

    const walletA = await db.wallets.get(w1);
    const walletB = await db.wallets.get(w2);
    expect(walletA?.currentBalance).toBe(900_000);
    expect(walletB?.currentBalance).toBe(600_000);

    const txs = await db.transactions.toArray();
    expect(txs).toHaveLength(2);
    expect(txs.some(t => t.type === 'transfer_out' && t.walletId === w1)).toBe(true);
    expect(txs.some(t => t.type === 'transfer_in' && t.walletId === w2)).toBe(true);
  });

  it('rejects transfer when source wallet balance is insufficient', async () => {
    const w1 = await createTestWallet('A', 50_000);
    const w2 = await createTestWallet('B', 500_000);

    await expect(
      saveTransfer({
        amount: 100_000,
        description: 'Transfer',
        date: '2025-01-15',
        fromWalletId: w1,
        toWalletId: w2,
        notes: '',
      })
    ).rejects.toThrow(INSUFFICIENT_WALLET_BALANCE_MESSAGE);

    const walletA = await db.wallets.get(w1);
    const walletB = await db.wallets.get(w2);
    expect(walletA?.currentBalance).toBe(50_000);
    expect(walletB?.currentBalance).toBe(500_000);
    expect(await db.transactions.count()).toBe(0);
  });
});

describe('updateTransfer (atomic transfer editing)', () => {
  async function createPair(from: number, to: number, amount = 100_000, date = '2025-01-15'): Promise<string> {
    await saveTransfer({
      amount,
      description: 'Transfer',
      date,
      fromWalletId: from,
      toWalletId: to,
      notes: '',
    });
    const txs = await db.transactions.toArray();
    return txs[0]!.transferGroupId!;
  }

  it('updates amount and both balances atomically', async () => {
    const w1 = await createTestWallet('A');
    const w2 = await createTestWallet('B', 500_000);
    const groupId = await createPair(w1, w2, 100_000);

    await updateTransfer({
      transferGroupId: groupId,
      amount: 150_000,
      description: 'Transfer',
      date: '2025-01-15',
      fromWalletId: w1,
      toWalletId: w2,
      notes: '',
    });

    const walletA = await db.wallets.get(w1);
    const walletB = await db.wallets.get(w2);
    expect(walletA?.currentBalance).toBe(850_000);
    expect(walletB?.currentBalance).toBe(650_000);

    const txs = await db.transactions.where('transferGroupId').equals(groupId).toArray();
    expect(txs).toHaveLength(2);
    expect(txs.every((t) => t.amount === 150_000)).toBe(true);
  });

  it('updates date and notes on both records', async () => {
    const w1 = await createTestWallet('A');
    const w2 = await createTestWallet('B', 500_000);
    const groupId = await createPair(w1, w2);

    await updateTransfer({
      transferGroupId: groupId,
      amount: 100_000,
      description: 'Renamed',
      date: '2025-02-01',
      fromWalletId: w1,
      toWalletId: w2,
      notes: 'updated',
    });

    const txs = await db.transactions.where('transferGroupId').equals(groupId).toArray();
    expect(txs.find((t) => t.type === 'transfer_out')?.description).toBe('Renamed (Out)');
    expect(txs.find((t) => t.type === 'transfer_in')?.description).toBe('Renamed (In)');
    expect(txs.every((t) => t.date === '2025-02-01')).toBe(true);
    expect(txs.every((t) => t.notes === 'updated')).toBe(true);
  });

  it('moves the transfer to a different destination wallet', async () => {
    const w1 = await createTestWallet('A');
    const w2 = await createTestWallet('B', 500_000);
    const w3 = await createTestWallet('C', 0);
    const groupId = await createPair(w1, w2);

    await updateTransfer({
      transferGroupId: groupId,
      amount: 100_000,
      description: 'Transfer',
      date: '2025-01-15',
      fromWalletId: w1,
      toWalletId: w3,
      notes: '',
    });

    const walletA = await db.wallets.get(w1);
    const walletB = await db.wallets.get(w2);
    const walletC = await db.wallets.get(w3);
    expect(walletA?.currentBalance).toBe(900_000);
    expect(walletB?.currentBalance).toBe(500_000); // reversal restores old destination
    expect(walletC?.currentBalance).toBe(100_000);

    const txs = await db.transactions.where('transferGroupId').equals(groupId).toArray();
    expect(txs.find((t) => t.type === 'transfer_in')?.walletId).toBe(w3);
  });

  it('swaps source and destination wallets and applies deltas exactly once', async () => {
    const w1 = await createTestWallet('A');
    const w2 = await createTestWallet('B', 500_000);
    const groupId = await createPair(w1, w2, 100_000);

    await updateTransfer({
      transferGroupId: groupId,
      amount: 100_000,
      description: 'Transfer',
      date: '2025-01-15',
      fromWalletId: w2,
      toWalletId: w1,
      notes: '',
    });

    // Original: A=900k, B=600k. Edit to B→A 100k reverses the original
    // (A=1M, B=500k) then applies the new pair (B=400k, A=1.1M).
    const walletA = await db.wallets.get(w1);
    const walletB = await db.wallets.get(w2);
    expect(walletA?.currentBalance).toBe(1_100_000);
    expect(walletB?.currentBalance).toBe(400_000);

    const txs = await db.transactions.where('transferGroupId').equals(groupId).toArray();
    expect(txs.find((t) => t.type === 'transfer_out')?.walletId).toBe(w2);
    expect(txs.find((t) => t.type === 'transfer_in')?.walletId).toBe(w1);
  });

  it('rolls back the whole edit when the new amount overdraws the source', async () => {
    const w1 = await createTestWallet('A', 100_000);
    const w2 = await createTestWallet('B', 500_000);
    const groupId = await createPair(w1, w2, 50_000);

    await expect(
      updateTransfer({
        transferGroupId: groupId,
        amount: 200_000,
        description: 'Transfer',
        date: '2025-01-15',
        fromWalletId: w1,
        toWalletId: w2,
        notes: '',
      })
    ).rejects.toThrow(INSUFFICIENT_WALLET_BALANCE_MESSAGE);

    // Balances unchanged: A=50k after original 50k transfer, B=550k
    const walletA = await db.wallets.get(w1);
    const walletB = await db.wallets.get(w2);
    expect(walletA?.currentBalance).toBe(50_000);
    expect(walletB?.currentBalance).toBe(550_000);

    // Records unchanged
    const txs = await db.transactions.where('transferGroupId').equals(groupId).toArray();
    expect(txs.every((t) => t.amount === 50_000)).toBe(true);
  });

  it('rejects transfer to the same wallet', async () => {
    const w1 = await createTestWallet('A');
    const w2 = await createTestWallet('B', 500_000);
    const groupId = await createPair(w1, w2);

    await expect(
      updateTransfer({
        transferGroupId: groupId,
        amount: 100_000,
        description: 'Transfer',
        date: '2025-01-15',
        fromWalletId: w1,
        toWalletId: w1,
        notes: '',
      })
    ).rejects.toThrow('Cannot transfer to the same wallet.');
  });

  it('throws when the transfer pair is incomplete (legacy orphan)', async () => {
    const w1 = await createTestWallet('A');
    const w2 = await createTestWallet('B', 500_000);

    // Manually create only one side of a pair
    await db.transactions.add({
      amount: 100_000,
      description: 'Transfer (Out)',
      date: '2025-01-15',
      walletId: w1,
      categoryId: null,
      type: 'transfer_out',
      transferGroupId: 'orphan-group',
    });

    await expect(
      updateTransfer({
        transferGroupId: 'orphan-group',
        amount: 100_000,
        description: 'Transfer',
        date: '2025-01-15',
        fromWalletId: w1,
        toWalletId: w2,
        notes: '',
      })
    ).rejects.toThrow('Transfer pair is incomplete.');
  });

  it('allows increasing amount when reversal frees up enough balance', async () => {
    const w1 = await createTestWallet('A', 100_000);
    const w2 = await createTestWallet('B', 500_000);
    const groupId = await createPair(w1, w2, 60_000);

    // After reversal A has 100k available; new debit of 90k is allowed
    await updateTransfer({
      transferGroupId: groupId,
      amount: 90_000,
      description: 'Transfer',
      date: '2025-01-15',
      fromWalletId: w1,
      toWalletId: w2,
      notes: '',
    });

    const walletA = await db.wallets.get(w1);
    const walletB = await db.wallets.get(w2);
    expect(walletA?.currentBalance).toBe(10_000);
    expect(walletB?.currentBalance).toBe(590_000);
  });
});
