import { db, Transaction } from '../db/db';
import { findPairedTransfer } from './transferUtils';

export interface IntegrityIssue {
  severity: 'error' | 'warning';
  type: string;
  message: string;
  details?: unknown;
}

export interface IntegrityReport {
  passed: boolean;
  issues: IntegrityIssue[];
  summary: string;
}

/**
 * Run all integrity checks and return a report.
 */
export async function runIntegrityCheck(): Promise<IntegrityReport> {
  const issues: IntegrityIssue[] = [];

  // Check 1: Orphaned transfer pairs
  await checkOrphanedTransfers(issues);

  // Check 2: Transactions referencing deleted wallets
  await checkDeletedWalletReferences(issues);

  // Check 3: Transactions referencing deleted categories
  await checkDeletedCategoryReferences(issues);

  // Check 4: Balance inconsistencies (transactions where amount is 0 or negative)
  await checkAmountInconsistencies(issues);

  return {
    passed: issues.length === 0,
    issues,
    summary: issues.length === 0
      ? 'All integrity checks passed.'
      : `Found ${issues.length} issue(s): ${issues.filter(i => i.severity === 'error').length} error(s), ${issues.filter(i => i.severity === 'warning').length} warning(s).`,
  };
}

async function checkOrphanedTransfers(issues: IntegrityIssue[]): Promise<void> {
  const transfers = await db.transactions
    .where('type')
    .anyOf(['transfer_in', 'transfer_out'])
    .toArray();

  const processed = new Set<number>();

  for (const tx of transfers) {
    if (!tx.id || processed.has(tx.id)) continue;

    if (tx.transferGroupId) {
      // Check that its paired transaction still exists
      const paired = await db.transactions
        .where('transferGroupId')
        .equals(tx.transferGroupId)
        .and(t => t.id !== tx.id)
        .first();

      if (!paired) {
        issues.push({
          severity: 'error',
          type: 'orphaned_transfer',
          message: `Transfer "${tx.description}" (ID: ${tx.id}) has no matching paired transaction (group: ${tx.transferGroupId}).`,
          details: { transactionId: tx.id, transferGroupId: tx.transferGroupId },
        });
      }

      processed.add(tx.id);
      if (paired?.id) processed.add(paired.id);
    } else {
      // Legacy transfer without groupId — try to find match
      const paired = await findPairedTransfer(tx);
      if (!paired) {
        issues.push({
          severity: 'warning',
          type: 'unlinked_transfer',
          message: `Transfer "${tx.description}" (ID: ${tx.id}) has no transferGroupId and no matching pair found.`,
          details: { transactionId: tx.id },
        });
      } else {
        issues.push({
          severity: 'warning',
          type: 'unlinked_transfer',
          message: `Legacy transfer pair found (ID: ${tx.id} <-> ${paired.id}) but has no transferGroupId. Run normalization to fix.`,
          details: { transactionId1: tx.id, transactionId2: paired.id },
        });
      }
      processed.add(tx.id);
      if (paired?.id) processed.add(paired.id);
    }
  }
}

async function checkDeletedWalletReferences(issues: IntegrityIssue[]): Promise<void> {
  const wallets = await db.wallets.toArray();
  const walletIds = new Set(wallets.map(w => w.id!));

  // Check a sample of transactions for deleted wallet references
  // Use limit to avoid performance issues on large datasets
  const sampleTxs = await db.transactions.limit(500).toArray();

  for (const tx of sampleTxs) {
    if (!walletIds.has(tx.walletId)) {
      issues.push({
        severity: 'error',
        type: 'deleted_wallet_reference',
        message: `Transaction "${tx.description}" (ID: ${tx.id}) references wallet ID ${tx.walletId} which no longer exists.`,
        details: { transactionId: tx.id, walletId: tx.walletId },
      });
    }
  }
}

async function checkDeletedCategoryReferences(issues: IntegrityIssue[]): Promise<void> {
  const categories = await db.categories.toArray();
  const categoryIds = new Set(categories.map(c => c.id!));

  const sampleTxs = await db.transactions
    .where('categoryId')
    .notEqual(0) // This is a Dexie workaround: check non-null categories
    .limit(500)
    .toArray();

  for (const tx of sampleTxs) {
    if (tx.categoryId != null && !categoryIds.has(tx.categoryId)) {
      issues.push({
        severity: 'warning',
        type: 'deleted_category_reference',
        message: `Transaction "${tx.description}" (ID: ${tx.id}) references category ID ${tx.categoryId} which no longer exists.`,
        details: { transactionId: tx.id, categoryId: tx.categoryId },
      });
    }
  }
}

async function checkAmountInconsistencies(issues: IntegrityIssue[]): Promise<void> {
  const invalidTxs = await db.transactions
    .filter(tx => tx.amount <= 0)
    .limit(100)
    .toArray();

  for (const tx of invalidTxs) {
    issues.push({
      severity: 'warning',
      type: 'invalid_amount',
      message: `Transaction "${tx.description}" (ID: ${tx.id}) has ${tx.amount <= 0 ? 'non-positive' : ''} amount (${tx.amount}).`,
      details: { transactionId: tx.id, amount: tx.amount },
    });
  }
}

/**
 * Fix orphaned transfers by removing them.
 * @returns Number of deleted orphaned transfers.
 */
export async function fixOrphanedTransfers(): Promise<number> {
  const report = await runIntegrityCheck();
  const orphaned = report.issues.filter(i => i.type === 'orphaned_transfer');
  let deleted = 0;

  for (const issue of orphaned) {
    const details = issue.details as { transactionId?: number; transferGroupId?: string } | undefined;
    if (details?.transactionId) {
      await db.transactions.delete(details.transactionId);
      deleted++;
    }
  }

  return deleted;
}
