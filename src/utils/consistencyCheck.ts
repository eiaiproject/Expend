import { db, Transaction, Wallet, Debt, DebtPayment } from '../db/db';
import { findPairedTransfer } from './transferUtils';
import { recomputeWalletCurrentBalances } from './balanceUtils';

export interface IntegrityIssue {
  severity: 'info' | 'warning' | 'error';
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

  // Financial Balance Checks
  await checkWalletBalanceMismatches(issues);

  // Debt/Payment Checks
  await checkDebtIntegrity(issues);
  await checkDebtPaymentIntegrity(issues);

  // Transaction Checks
  await checkOrphanedTransfers(issues);
  await checkDeletedWalletReferences(issues);
  await checkDeletedCategoryReferences(issues);
  await checkAmountInconsistencies(issues);
  await checkInvalidDates(issues);

  return {
    passed: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    summary: issues.length === 0
      ? 'All integrity checks passed.'
      : `Found ${issues.length} issue(s): ${issues.filter(i => i.severity === 'error').length} error(s), ${issues.filter(i => i.severity === 'warning').length} warning(s), ${issues.filter(i => i.severity === 'info').length} info(s).`,
  };
}

async function checkWalletBalanceMismatches(issues: IntegrityIssue[]): Promise<void> {
  const wallets = await db.wallets.toArray();
  const transactions = await db.transactions.toArray();
  const debts = await db.debts.toArray();
  const debtPayments = await db.debtPayments.toArray();

  const recomputed = recomputeWalletCurrentBalances(wallets, transactions, debts, debtPayments);

  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    const recomputedWallet = recomputed[i];
    const actual = wallet.currentBalance ?? wallet.initialBalance;
    const expected = recomputedWallet.currentBalance ?? recomputedWallet.initialBalance;

    if (Math.abs(actual - expected) > 0.001) {
      issues.push({
        severity: 'error',
        type: 'balance_mismatch',
        message: `Wallet "${wallet.name}" balance mismatch. Actual: ${actual}, Expected: ${expected}`,
        details: { walletId: wallet.id, actual, expected },
      });
    }
  }
}

async function checkDebtIntegrity(issues: IntegrityIssue[]): Promise<void> {
  const debts = await db.debts.toArray();
  const wallets = await db.wallets.toArray();
  const walletIds = new Set(wallets.map(w => w.id!));
  const payments = await db.debtPayments.toArray();

  for (const debt of debts) {
    // Wallet reference
    if (!walletIds.has(debt.walletId)) {
      issues.push({
        severity: 'error',
        type: 'debt_missing_wallet',
        message: `Debt "${debt.id}" references missing wallet ID ${debt.walletId}`,
        details: { debtId: debt.id, walletId: debt.walletId },
      });
    }

    // Remaining amount boundaries
    if (debt.remainingAmount < 0 || debt.remainingAmount > debt.principalAmount + 0.001) {
      issues.push({
        severity: 'error',
        type: 'invalid_remaining_amount',
        message: `Debt "${debt.id}" has invalid remainingAmount: ${debt.remainingAmount} (Principal: ${debt.principalAmount})`,
        details: { debtId: debt.id, remainingAmount: debt.remainingAmount, principalAmount: debt.principalAmount },
      });
    }

    // Remaining amount consistency with payments
    const debtPayments = payments.filter(p => p.debtId === debt.id);
    let computedRemaining = debt.principalAmount;
    for (const p of debtPayments) {
      if (p.type === 'repayment') {
        computedRemaining -= p.amount;
      } else if (p.type === 'write_off' || p.type === 'adjustment' && p.amount >= debt.remainingAmount) {
        // Simplification: if it's marked as paid/written off, remaining should be 0
      }
    }
    // This is complex because of different payment types. 
    // For now, we flag if it's significantly different and not explicitly closed.
    if (debt.status !== 'paid' && debt.status !== 'written_off' && Math.abs(debt.remainingAmount - computedRemaining) > 0.001) {
      issues.push({
        severity: 'warning',
        type: 'debt_amount_inconsistency',
        message: `Debt "${debt.id}" remainingAmount (${debt.remainingAmount}) differs from computed amount (${computedRemaining})`,
        details: { debtId: debt.id, remainingAmount: debt.remainingAmount, computedRemaining },
      });
    }
  }
}

async function checkDebtPaymentIntegrity(issues: IntegrityIssue[]): Promise<void> {
  const payments = await db.debtPayments.toArray();
  const debts = await db.debts.toArray();
  const debtIds = new Set(debts.map(d => d.id));
  const wallets = await db.wallets.toArray();
  const walletIds = new Set(wallets.map(w => w.id!));

  for (const p of payments) {
    // Debt reference
    if (!debtIds.has(p.debtId)) {
      issues.push({
        severity: 'error',
        type: 'orphan_debt_payment',
        message: `Debt payment "${p.id}" references missing debt ID ${p.debtId}`,
        details: { paymentId: p.id, debtId: p.debtId },
      });
    }
    // Wallet reference
    if (!walletIds.has(p.walletId)) {
      issues.push({
        severity: 'error',
        type: 'payment_missing_wallet',
        message: `Debt payment "${p.id}" references missing wallet ID ${p.walletId}`,
        details: { paymentId: p.id, walletId: p.walletId },
      });
    }
    // Amount
    if (p.amount <= 0) {
      issues.push({
        severity: 'warning',
        type: 'invalid_payment_amount',
        message: `Debt payment "${p.id}" has non-positive amount: ${p.amount}`,
        details: { paymentId: p.id, amount: p.amount },
      });
    }
  }
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
      const groupTxs = await db.transactions
        .where('transferGroupId')
        .equals(tx.transferGroupId)
        .toArray();

      if (groupTxs.length !== 2) {
        issues.push({
          severity: 'error',
          type: 'invalid_transfer_group_size',
          message: `Transfer group ${tx.transferGroupId} has ${groupTxs.length} transactions, expected 2.`,
          details: { transferGroupId: tx.transferGroupId, count: groupTxs.length },
        });
      }

      const paired = groupTxs.find(t => t.id !== tx.id);
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

  const txs = await db.transactions.toArray();
  for (const tx of txs) {
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

  const txs = await db.transactions.toArray();
  for (const tx of txs) {
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
  const txs = await db.transactions.toArray();
  for (const tx of txs) {
    if (tx.amount <= 0) {
      issues.push({
        severity: 'warning',
        type: 'invalid_amount',
        message: `Transaction "${tx.description}" (ID: ${tx.id}) has non-positive amount (${tx.amount}).`,
        details: { transactionId: tx.id, amount: tx.amount },
      });
    }
  }
}

async function checkInvalidDates(issues: IntegrityIssue[]): Promise<void> {
  const txs = await db.transactions.toArray();
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  for (const tx of txs) {
    if (!dateRegex.test(tx.date)) {
      issues.push({
        severity: 'error',
        type: 'invalid_date',
        message: `Transaction "${tx.description}" (ID: ${tx.id}) has invalid date format: ${tx.date}`,
        details: { transactionId: tx.id, date: tx.date },
      });
    }
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
