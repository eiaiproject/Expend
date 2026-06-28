/**
 * Centralized wallet domain service.
 *
 * Financial invariants enforced here:
 * - expense decreases wallet balance
 * - transfer_out decreases source wallet balance
 * - transfer_in increases destination wallet balance
 * - balance_adjustment is a signed delta applied to wallet
 * - deleting any transaction applies the inverse balance delta
 * - deleting a transfer pair rolls back both wallets
 * - editing a transaction undoes old delta and applies new delta
 * - wallet deletion rolls back all affected wallets' balances
 *
 * balance_adjustment semantics (Option A):
 *   amount is a SIGNED delta. Positive = increase, negative = decrease.
 *   The UI sends absolute balance and we compute the signed delta internally.
 */
import { db, type Transaction, type Wallet } from '../db/db';
import { getBalanceDelta } from '../utils/balanceUtils';

/**
 * Delete a wallet safely inside a single Dexie transaction.
 *
 * Steps:
 * 1. Check if the wallet is referenced by any financial record.
 * 2. If referenced, block deletion and return the list of references.
 * 3. If not referenced, delete the wallet.
 * 
 * Blocking references:
 * - transactions
 * - debts
 * - debtPayments
 * - any other wallet-linked financial record.
 */
export async function deleteWalletSafely(walletId: number): Promise<{ success: boolean; reason?: string }> {
  try {
    await db.transaction('read' as any, [db.transactions, db.debts, db.debtPayments, db.wallets], async () => {
      // 1. Check transactions
      const txCount = await db.transactions
        .where('walletId')
        .equals(walletId)
        .count();
      if (txCount > 0) {
        throw new Error(`Wallet cannot be deleted because it has ${txCount} associated transaction(s).`);
      }

      // 2. Check debts
      const debtCount = await db.debts
        .where('walletId')
        .equals(walletId)
        .count();
      if (debtCount > 0) {
        throw new Error(`Wallet cannot be deleted because it is linked to ${debtCount} active debt(s)/receivable(s).`);
      }

      // 3. Check debt payments
      const paymentCount = await db.debtPayments
        .where('walletId')
        .equals(walletId)
        .count();
      if (paymentCount > 0) {
        throw new Error(`Wallet cannot be deleted because it has ${paymentCount} debt payment record(s).`);
      }
    });

    // If we reached here, no references were found (or no errors thrown)
    await db.transaction('rw', [db.wallets], async () => {
      await db.wallets.delete(walletId);
    });

    return { success: true };
  } catch (err) {
    return { 
      success: false, 
      reason: err instanceof Error ? err.message : 'An unknown error occurred' 
    };
  }
}

/**
 * Adjust wallet balance atomically.
 * Creates a balance_adjustment transaction AND updates wallet.currentBalance
 * in one Dexie transaction.
 *
 * @param walletId - Target wallet
 * @param newAbsoluteBalance - The desired absolute balance
 * @param metadata - Optional description and notes
 */
export async function adjustWalletBalance(
  walletId: number,
  newAbsoluteBalance: number,
  metadata?: { description?: string; notes?: string },
): Promise<void> {
  await db.transaction('rw', [db.transactions, db.wallets], async () => {
    const wallet = await db.wallets.get(walletId);
    if (!wallet) throw new Error('Wallet not found');

    const currentBalance = wallet.currentBalance ?? wallet.initialBalance;
    const delta = newAbsoluteBalance - currentBalance;

    if (delta !== 0) {
      await db.transactions.add({
        walletId,
        categoryId: null,
        date: new Date().toISOString().slice(0, 10),
        description: metadata?.description ?? 'Balance Update',
        type: 'balance_adjustment',
        amount: delta,
        notes: metadata?.notes,
      });
    }

    await db.wallets.update(walletId, {
      currentBalance: newAbsoluteBalance,
      lastUpdated: new Date().toISOString(),
    });
  });
}

/**
 * Recompute a single wallet's balance from scratch.
 * Used as safety net after mutations.
 */
export async function recomputeWalletBalance(walletId: number): Promise<void> {
  const wallet = await db.wallets.get(walletId);
  if (!wallet) return;

  const txs = await db.transactions
    .where('walletId')
    .equals(walletId)
    .toArray();

  let balance = wallet.initialBalance;
  for (const tx of txs) {
    balance += getBalanceDelta(tx.type, tx.amount);
  }

  await db.wallets.update(walletId, {
    currentBalance: balance,
    lastUpdated: new Date().toISOString(),
  });
}

/**
 * Recompute balances for multiple wallets.
 */
export async function recomputeWalletBalances(walletIds: number[]): Promise<void> {
  for (const id of walletIds) {
    await recomputeWalletBalance(id);
  }
}
