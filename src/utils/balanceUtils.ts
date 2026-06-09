import type { Transaction } from '../db/db';

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
