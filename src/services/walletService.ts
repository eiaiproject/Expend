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
import { incrementChangeCount } from './backupService';

export interface DeleteWalletResult {
  success: boolean;
  reason?: string;
  reasonKey?: string;
  reasonOptions?: Record<string, number | string>;
}

/**
 * Check if a wallet can be safely deleted.
 * Returns { canDelete, reason, reasonKey, reasonOptions }.
 */
export async function canDeleteWallet(walletId: number): Promise<{ canDelete: boolean; reason?: string; reasonKey?: string; reasonOptions?: Record<string, number | string> }> {
  const debtCount = await db.debts
    .where('walletId')
    .equals(walletId)
    .and(d => !d.archivedAt)
    .count();
  if (debtCount > 0) {
    return { canDelete: false, reason: `Wallet is linked to ${debtCount} active debt(s)/receivable(s).`, reasonKey: 'wallet.deleteBlocked', reasonOptions: { count: debtCount } };
  }

  const paymentCount = await db.debtPayments
    .where('walletId')
    .equals(walletId)
    .count();
  if (paymentCount > 0) {
    return { canDelete: false, reason: `Wallet has ${paymentCount} debt payment record(s).`, reasonKey: 'wallet.deleteBlocked', reasonOptions: { count: paymentCount } };
  }

  const walletTxs = await db.transactions
    .where('walletId')
    .equals(walletId)
    .toArray();
  const nonTransferTxs = walletTxs.filter(t => t.type !== 'transfer_in' && t.type !== 'transfer_out');
  if (nonTransferTxs.length > 0) {
    return { canDelete: false, reason: `Wallet has ${nonTransferTxs.length} associated transaction(s).`, reasonKey: 'wallet.deleteBlocked', reasonOptions: { count: nonTransferTxs.length } };
  }

  // Recurring schedules reference this wallet; deleting it would orphan them.
  const scheduleCount = await db.schedules
    .where('walletId')
    .equals(walletId)
    .count();
  if (scheduleCount > 0) {
    return { canDelete: false, reason: `Wallet is linked to ${scheduleCount} recurring schedule(s).`, reasonKey: 'wallet.deleteBlockedSchedules', reasonOptions: { count: scheduleCount } };
  }

  return { canDelete: true };
}

/**
 * Find all transfer-pair ids tied to the deleted wallet's transactions and the
 * other wallets affected by unwinding those pairs.
 */
async function findTransferPairs(
  walletTxs: import('../db/db').Transaction[],
  walletId: number,
): Promise<{ pairsToDelete: Set<number>; pairedAffectedWalletIds: Set<number> }> {
  const pairsToDelete = new Set<number>();
  const pairedAffectedWalletIds = new Set<number>();

  for (const tx of walletTxs) {
    if (tx.id != null) pairsToDelete.add(tx.id);
    const groupId = tx.transferGroupId;
    if (!groupId) continue;
    const counterpart = await db.transactions
      .where('transferGroupId')
      .equals(groupId)
      .and(t => t.id !== tx.id)
      .first();
    if (counterpart?.id != null) {
      pairsToDelete.add(counterpart.id);
      if (counterpart.walletId !== walletId) {
        pairedAffectedWalletIds.add(counterpart.walletId);
      }
    }
  }

  return { pairsToDelete, pairedAffectedWalletIds };
}

/** Recompute currentBalance from history for every wallet in `ids`. */
async function recomputeWalletBalances(ids: Iterable<number>): Promise<void> {
  for (const id of ids) {
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
}

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
export async function deleteWalletSafely(walletId: number): Promise<DeleteWalletResult> {
  try {
    const check = await canDeleteWallet(walletId);
    if (!check.canDelete) {
      return { success: false, reason: check.reason, reasonKey: check.reasonKey, reasonOptions: check.reasonOptions };
    }

    // Find paired transfers in OTHER wallets and collect affected wallet ids.
    const walletTxs = await db.transactions
      .where('walletId')
      .equals(walletId)
      .toArray();
    const { pairsToDelete, pairedAffectedWalletIds } = await findTransferPairs(walletTxs, walletId);

    // Atomic delete + balance recompute
    await db.transaction('rw', [db.transactions, db.wallets], async () => {
      if (pairsToDelete.size > 0) {
        await db.transactions.bulkDelete(Array.from(pairsToDelete));
      }
      await recomputeWalletBalances(new Set<number>([walletId, ...pairedAffectedWalletIds]));
      await db.wallets.delete(walletId);
    });

    // Track wallet deletion for backup metadata. The wallet is already deleted,
    // so a metadata-write failure must not misreport the operation as failed.
    try {
      await incrementChangeCount(pairsToDelete.size > 0 ? pairsToDelete.size : 1);
    } catch {
      // ignore: deletion already committed
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      reason: err instanceof Error ? err.message : 'An unknown error occurred',
      reasonKey: 'wallet.deleteError',
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
        description: metadata?.description ?? 'Balance Reconciliation',
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

  // Track the balance adjustment for backup metadata
  await incrementChangeCount(1);
}

/**
 * Deactivate a wallet by setting archivedAt to the current ISO timestamp.
 * Does NOT delete data — wallet remains in history and reports.
 */
export async function deactivateWallet(walletId: number): Promise<void> {
  await db.wallets.update(walletId, {
    archivedAt: new Date().toISOString(),
  });

  // Track the wallet deactivation for backup metadata
  await incrementChangeCount(1);
}

/**
 * Reactivate a wallet by clearing archivedAt.
 */
export async function reactivateWallet(walletId: number): Promise<void> {
  await db.wallets.update(walletId, {
    archivedAt: null,
  });

  // Track the wallet reactivation for backup metadata
  await incrementChangeCount(1);
}
