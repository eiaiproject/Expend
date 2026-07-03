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
import { db } from '../db/db';
import { getBalanceDelta } from '../utils/balanceUtils';

/**
 * Delete a wallet safely inside a single Dexie transaction.
 *
 * Blocking references (always block deletion):
 * - debts (irreversible lend/borrow ledger)
 * - debtPayments (cashflow history against wallet)
 * - non-transfer transactions (expenses, balance adjustments, etc.)
 *
 * Transfer pairs (transfer_in / transfer_out) are unwound atomically:
 * - the orphaned side is removed from the other wallet
 * - the other wallet's currentBalance is recomputed
 *
 * Result: deletion only succeeds when there are no irreversible references
 * that would leave dangling financial history.
 */
export async function deleteWalletSafely(walletId: number): Promise<{ success: boolean; reason?: string }> {
  try {
    // 1. Always block debts (active loan ledger)
    const debtCount = await db.debts
      .where('walletId')
      .equals(walletId)
      .and(d => !d.archivedAt)
      .count();
    if (debtCount > 0) {
      return {
        success: false,
        reason: `Wallet cannot be deleted because it is linked to ${debtCount} active debt(s)/receivable(s).`,
      };
    }

    // 2. Always block debt payments (cashflow history)
    const paymentCount = await db.debtPayments
      .where('walletId')
      .equals(walletId)
      .count();
    if (paymentCount > 0) {
      return {
        success: false,
        reason: `Wallet cannot be deleted because it has ${paymentCount} debt payment record(s).`,
      };
    }

    // 3. Inspect transactions. Non-transfer transactions block deletion;
    //    transfer_in/out pairs are unwound with their counterparts.
    const walletTxs = await db.transactions
      .where('walletId')
      .equals(walletId)
      .toArray();

    const nonTransferTxs = walletTxs.filter(t => t.type !== 'transfer_in' && t.type !== 'transfer_out');
    if (nonTransferTxs.length > 0) {
      return {
        success: false,
        reason: `Wallet cannot be deleted because it has ${nonTransferTxs.length} associated transaction(s).`,
      };
    }

    // 4. Find paired transfers in OTHER wallets and collect affected wallet ids.
    const pairedAffectedWalletIds = new Set<number>();
    const pairsToDelete = new Set<number>();

    for (const tx of walletTxs) {
      if (tx.id != null) pairsToDelete.add(tx.id);
      const groupId = tx.transferGroupId;
      if (!groupId) continue;
      const counterpart = await db.transactions
        .where('transferGroupId')
        .equals(groupId)
        .and(t => t.id !== tx.id)
        .first();
      if (counterpart && counterpart.id != null) {
        pairsToDelete.add(counterpart.id);
        if (counterpart.walletId !== walletId) {
          pairedAffectedWalletIds.add(counterpart.walletId);
        }
      }
    }

    // 5. Atomic delete + balance recompute
    await db.transaction('rw', [db.transactions, db.wallets], async () => {
      if (pairsToDelete.size > 0) {
        await db.transactions.bulkDelete(Array.from(pairsToDelete));
      }
      // Recompute balances for every wallet that lost transactions.
      const walletsToRecompute = new Set<number>([walletId, ...pairedAffectedWalletIds]);
      for (const id of walletsToRecompute) {
        const wallet = await db.wallets.get(id);
        if (!wallet) continue;
        const txs = await db.transactions.where('walletId').equals(id).toArray();
        let balance = wallet.initialBalance;
        for (const t of txs) {
          balance += getBalanceDelta(t.type, t.amount);
        }
        await db.wallets.update(id, {
          currentBalance: balance,
          lastUpdated: new Date().toISOString(),
        });
      }
      await db.wallets.delete(walletId);
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      reason: err instanceof Error ? err.message : 'An unknown error occurred',
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
