import type { Transaction, Wallet } from '../db/db';

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

export function recomputeWalletCurrentBalances<T extends Wallet>(
  wallets: readonly T[],
  transactions: readonly Transaction[],
): T[] {
  const deltasByWallet = new Map<number, number>();

  for (const tx of transactions) {
    deltasByWallet.set(
      tx.walletId,
      (deltasByWallet.get(tx.walletId) ?? 0) + getBalanceDelta(tx.type, tx.amount),
    );
  }

  return wallets.map((wallet) => ({
    ...wallet,
    currentBalance: wallet.initialBalance + (wallet.id == null ? 0 : (deltasByWallet.get(wallet.id) ?? 0)),
  }));
}
