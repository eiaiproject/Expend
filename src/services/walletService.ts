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
 * 1. Find all transactions belonging to this wallet.
 * 2. Collect all transferGroupIds from those transactions.
 * 3. Find all paired transactions in OTHER wallets via those groupIds.
 * 4. Collect all affected wallet IDs (other than the one being deleted).
 * 5. For every deleted transaction (own + paired), apply inverse balance delta
 *    to its wallet if that wallet is not being deleted.
 * 6. Delete all related transactions (own + paired).
 * 7. Delete the wallet.
 * 8. Recompute affected wallet balances as safety net.
 */
export async function deleteWalletSafely(walletId: number): Promise<void> {
  await db.transaction('rw', [db.transactions, db.wallets], async () => {
    // 1. Find all transactions belonging to this wallet
    const walletTxs = await db.transactions
      .where('walletId')
      .equals(walletId)
      .toArray();

    // 2. Collect transferGroupIds
    const transferGroupIds = new Set<string>();
    for (const tx of walletTxs) {
      if (tx.transferGroupId) {
        transferGroupIds.add(tx.transferGroupId);
      }
    }

    // 3. Find paired transactions in OTHER wallets
    const pairedTxs: Transaction[] = [];
    for (const groupId of transferGroupIds) {
      const groupTxs = await db.transactions
        .where('transferGroupId')
        .equals(groupId)
        .and(t => t.walletId !== walletId)
        .toArray();
      pairedTxs.push(...groupTxs);
    }

    // 4. Collect all wallet IDs to correct (excluding the one being deleted)
    const affectedWalletIds = new Set<number>();
    for (const tx of pairedTxs) {
      if (tx.walletId !== walletId) {
        affectedWalletIds.add(tx.walletId);
      }
    }
    // Also check own transactions for walletId that might differ (shouldn't happen, but safety)
    for (const tx of walletTxs) {
      if (tx.walletId !== walletId) {
        affectedWalletIds.add(tx.walletId);
      }
    }

    // 5. Apply inverse balance deltas for ALL deleted transactions (own + paired)
    //    Skip the wallet being deleted since it's going away
    const allTxsToDelete: Transaction[] = [...walletTxs, ...pairedTxs];
    const walletsToCorrect = new Set<number>(affectedWalletIds);

    for (const tx of allTxsToDelete) {
      if (tx.walletId === walletId) continue; // Skip — wallet being deleted
      const delta = getBalanceDelta(tx.type, tx.amount);
      const wallet = await db.wallets.get(tx.walletId);
      if (wallet) {
        await db.wallets.update(tx.walletId, {
          currentBalance: (wallet.currentBalance ?? wallet.initialBalance) - delta,
          lastUpdated: new Date().toISOString(),
        });
      }
    }

    // 6. Delete all related transactions
    const allIds = allTxsToDelete
      .map(t => t.id)
      .filter((id): id is number => id != null);
    if (allIds.length > 0) {
      await db.transactions.bulkDelete(allIds);
    }

    // 7. Delete the wallet
    await db.wallets.delete(walletId);

    // 8. Safety: recompute balances for all affected wallets
    for (const affectedId of walletsToCorrect) {
      const wallet = await db.wallets.get(affectedId);
      if (!wallet) continue;
      const remainingTxs = await db.transactions
        .where('walletId')
        .equals(affectedId)
        .toArray();
      let balance = wallet.initialBalance;
      for (const tx of remainingTxs) {
        balance += getBalanceDelta(tx.type, tx.amount);
      }
      await db.wallets.update(affectedId, {
        currentBalance: balance,
        lastUpdated: new Date().toISOString(),
      });
    }
  });
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
