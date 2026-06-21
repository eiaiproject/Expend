import { db, Transaction } from '../db/db';
import { generateTransferGroupId } from './cryptoUtils';

/**
 * Find the paired transaction for a transfer_in or transfer_out.
 *
 * Strategy:
 * 1. If transferGroupId exists, query by that (fast, deterministic)
 * 2. Otherwise, use legacy fallback: match by amount, date, opposite type,
 *    different wallet, and same base description (after stripping (Out)/(In) suffix)
 *
 * @param tx - The transfer transaction to find a pair for
 * @param options.excludeIds - Set of IDs to exclude from matching (useful for bulk operations)
 * @returns The paired transaction, or null if not found
 */
export async function findPairedTransfer(
  tx: Transaction,
  options?: { excludeIds?: Set<number> }
): Promise<Transaction | null> {
  if (tx.type !== 'transfer_in' && tx.type !== 'transfer_out') {
    return null;
  }
  if (!tx.id) return null;

  if (tx.transferGroupId) {
    // Fast path: use the transferGroupId index
    const paired = await db.transactions
      .where('transferGroupId')
      .equals(tx.transferGroupId)
      .and(t => t.id !== tx.id && (!options?.excludeIds || !options.excludeIds.has(t.id!)))
      .first();
    return paired || null;
  }

  // Legacy fallback: match by amount, date, opposite type, different wallet, same base description
  const baseDesc = tx.description.replace(/\s\((Out|In)\)$/, '');
  const txDate = tx.date.includes('T') ? tx.date.split('T')[0]! : tx.date;
  const oppositeType = tx.type === 'transfer_out' ? 'transfer_in' : 'transfer_out';

  // First try to find an exact match with all criteria
  const candidates = await db.transactions
    .where('type')
    .equals(oppositeType)
    .and(t =>
      t.amount === tx.amount &&
      t.date.split('T')[0] === txDate &&
      t.walletId !== tx.walletId &&
      t.description.replace(/\s\((Out|In)\)$/, '') === baseDesc &&
      t.id !== tx.id &&
      (!options?.excludeIds || !options.excludeIds.has(t.id!))
    )
    .toArray();

  // If multiple candidates found, prefer the one with matching notes (if any)
  if (candidates.length === 1) return (candidates[0] ?? null);
  if (candidates.length > 1) {
    // Prefer exact match including notes
    if (tx.notes) {
      const notesMatch = candidates.find(c => c.notes === tx.notes);
      if (notesMatch) return (notesMatch ?? null);
    }
    // Prefer the one with matching transferGroupId (if one was auto-assigned)
    if (tx.transferGroupId) {
      const groupMatch = candidates.find(c => c.transferGroupId === tx.transferGroupId);
      if (groupMatch) return (groupMatch ?? null);
    }
    // Fall back to preferring the most recent candidate
    candidates.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    return candidates[0] ?? null;
  }
  return null;
}

/**
 * Assign a transferGroupId to a legacy transfer pair so future operations
 * use the fast indexed path.
 *
 * @returns The assigned transferGroupId, or null if pairing failed
 */
export async function assignTransferGroupId(
  tx: Transaction,
  paired: Transaction
): Promise<string | null> {
  // Reuse existing groupId if either already has one
  const existingGroupId = tx.transferGroupId || paired.transferGroupId;
  if (existingGroupId) {
    const updates: Promise<number>[] = [];
    if (!tx.transferGroupId && tx.id) {
      updates.push(db.transactions.update(tx.id, { transferGroupId: existingGroupId }));
    }
    if (!paired.transferGroupId && paired.id) {
      updates.push(db.transactions.update(paired.id, { transferGroupId: existingGroupId }));
    }
    if (updates.length > 0) {
      await Promise.all(updates);
    }
    return existingGroupId;
  }

  // Neither has a groupId — generate a new one for both
  const groupId = `backfill-${generateTransferGroupId()}`;
  await Promise.all([
    tx.id ? db.transactions.update(tx.id, { transferGroupId: groupId }) : Promise.resolve(0),
    paired.id ? db.transactions.update(paired.id, { transferGroupId: groupId }) : Promise.resolve(0),
  ]);

  return groupId;
}
