import { db, Transaction } from '../db/db';
import { findPairedTransfer } from '../utils/transferUtils';
import { getBalanceDelta } from '../utils/balanceUtils';



/**
 * Delete transactions and their paired transfers (if any) in an atomic operation.
 * Also rolls back wallet balances for each deleted transaction.
 * Returns a snapshot of the deleted transactions that can be passed to
 * `restoreTransactions()` for undo.
 *
 * Uses `bulkPut` for undo so that restoring with original IDs works reliably
 * even when Dexie's auto-increment counter has advanced.
 */
export async function deleteTransactionsWithPairs(ids: number[]): Promise<Transaction[]> {
  if (ids.length === 0) return [];

  const txsToDelete = await db.transactions.where('id').anyOf(ids).toArray();
  const allIdsToDelete = new Set<number>(ids);
  const backups: Transaction[] = txsToDelete.map(t => ({ ...t }));

  // Expand to include paired transfer transactions
  for (const tx of txsToDelete) {
    if (tx.type === 'transfer_in' || tx.type === 'transfer_out') {
      const pairedTx = await findPairedTransfer(tx, { excludeIds: allIdsToDelete });
      if (pairedTx?.id && !allIdsToDelete.has(pairedTx.id)) {
        allIdsToDelete.add(pairedTx.id);
        backups.push({ ...pairedTx });
      }
    }
  }

  // Delete and rollback balances atomically
  await db.transaction('rw', [db.transactions, db.wallets], async () => {
    const allTxs = await db.transactions.where('id').anyOf([...allIdsToDelete]).toArray();

    // Rollback balances
    for (const tx of allTxs) {
      const delta = getBalanceDelta(tx.type, tx.amount);
      const wallet = await db.wallets.get(tx.walletId);
      if (wallet) {
        await db.wallets.update(tx.walletId, {
          currentBalance: (wallet.currentBalance ?? wallet.initialBalance) - delta,
          lastUpdated: new Date().toISOString(),
        });
      }
    }

    await db.transactions.bulkDelete([...allIdsToDelete]);
  });

  return backups;
}

/**
 * Restore previously deleted transactions (undo).
 * Also re-applies wallet balance changes.
 * Uses `bulkPut` instead of `bulkAdd` to safely restore with original IDs,
 * even if the auto-increment counter has advanced past them.
 */
export async function restoreTransactions(backups: Transaction[]): Promise<void> {
  if (backups.length === 0) return;

  await db.transaction('rw', [db.transactions, db.wallets], async () => {
    await db.transactions.bulkPut(backups);

    // Re-apply balances
    for (const tx of backups) {
      const delta = getBalanceDelta(tx.type, tx.amount);
      const wallet = await db.wallets.get(tx.walletId);
      if (wallet) {
        await db.wallets.update(tx.walletId, {
          currentBalance: (wallet.currentBalance ?? wallet.initialBalance) + delta,
          lastUpdated: new Date().toISOString(),
        });
      }
    }
  });
}
