import type { Transaction, Wallet, Debt, DebtPayment } from '../db/db';

/**
 * Compute balance delta for a transaction type.
 * Expenses and transfers out decrease the balance (negative delta).
 * All other types increase the balance (positive delta).
 *
 * @param type - The transaction type
 * @param amount - The transaction amount (always positive)
 * @returns The delta to apply to the wallet balance
 */
export function getBalanceDelta(type: Transaction['type'], amount: number): number {
  if (type === 'expense' || type === 'transfer_out') return -amount;
  return amount;
}

/**
 * Compute balance delta for a debt payment.
 * 
 * For 'payable' debt:
 * - initial: increases balance (money received)
 * - repayment: decreases balance (money paid)
 * 
 * For 'receivable' debt:
 * - initial: decreases balance (money lent)
 * - repayment: increases balance (money received)
 * 
 * adjustment and write_off usually don't affect balance unless specified.
 */
export function getDebtPaymentDelta(debtType: Debt['type'], paymentType: DebtPayment['type'], amount: number): number {
  if (paymentType === 'initial') {
    return debtType === 'payable' ? amount : -amount;
  }
  if (paymentType === 'repayment') {
    return debtType === 'payable' ? -amount : amount;
  }
  return 0;
}

export function getWalletBalance(wallet: Wallet): number {
  return wallet.currentBalance ?? wallet.initialBalance;
}

export function assertWalletBalanceCanApplyDelta(wallet: Wallet, delta: number, message: string): void {
  if (delta < 0 && getWalletBalance(wallet) + delta < 0) {
    throw new Error(message);
  }
}

export function recomputeWalletCurrentBalances<T extends Wallet>(
  wallets: readonly T[],
  transactions: readonly Transaction[],
  debts: readonly Debt[] = [],
  debtPayments: readonly DebtPayment[] = [],
): T[] {
  const deltasByWallet = new Map<number, number>();

  // 1. Process normal transactions
  for (const tx of transactions) {
    deltasByWallet.set(
      tx.walletId,
      (deltasByWallet.get(tx.walletId) ?? 0) + getBalanceDelta(tx.type, tx.amount),
    );
  }

  // 2. Process debt payments
  const debtById = new Map(debts.map((debt) => [debt.id, debt]));
  for (const payment of debtPayments) {
    const debt = debtById.get(payment.debtId);
    if (!debt) continue;

    const delta = getDebtPaymentDelta(debt.type, payment.type, payment.amount);
    if (delta !== 0) {
      deltasByWallet.set(
        payment.walletId,
        (deltasByWallet.get(payment.walletId) ?? 0) + delta,
      );
    }
  }

  return wallets.map((wallet) => ({
    ...wallet,
    currentBalance: wallet.initialBalance + (wallet.id == null ? 0 : (deltasByWallet.get(wallet.id) ?? 0)),
  }));
}
