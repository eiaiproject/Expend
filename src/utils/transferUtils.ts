import { db, Transaction } from '../db/db';

/**
 * Find the paired transaction for a transfer_in or transfer_out via the
 * `transferGroupId` index. Returns null if the input is not a transfer or
 * has no group id.
 */
export async function findPairedTransfer(
  tx: Transaction,
  options?: { excludeIds?: Set<number> }
): Promise<Transaction | null> {
  if (tx.type !== 'transfer_in' && tx.type !== 'transfer_out') return null;
  if (!tx.id) return null;
  if (!tx.transferGroupId) return null;

  const paired = await db.transactions
    .where('transferGroupId')
    .equals(tx.transferGroupId)
    .and(t => t.id !== tx.id && (!options?.excludeIds || !options.excludeIds.has(t.id!)))
    .first();
  return paired || null;
}

/**
 * Assign a transferGroupId to a transfer pair so future operations use the
 * indexed path. Reuses an existing group id if either side already has one.
 */
export async function assignTransferGroupId(
  tx: Transaction,
  paired: Transaction
): Promise<string | null> {
  const existingGroupId = tx.transferGroupId || paired.transferGroupId;
  if (existingGroupId) {
    const updates: Promise<number>[] = [];
    if (!tx.transferGroupId && tx.id) {
      updates.push(db.transactions.update(tx.id, { transferGroupId: existingGroupId }));
    }
    if (!paired.transferGroupId && paired.id) {
      updates.push(db.transactions.update(paired.id, { transferGroupId: existingGroupId }));
    }
    if (updates.length > 0) await Promise.all(updates);
    return existingGroupId;
  }

  const groupId = `backfill-${crypto.randomUUID()}`;
  await Promise.all([
    tx.id ? db.transactions.update(tx.id, { transferGroupId: groupId }) : Promise.resolve(0),
    paired.id ? db.transactions.update(paired.id, { transferGroupId: groupId }) : Promise.resolve(0),
  ]);
  return groupId;
}
