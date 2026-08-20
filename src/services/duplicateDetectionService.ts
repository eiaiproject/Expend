import type { Transaction } from '../db/db';
import { normalizePayeeKey } from './payeeService';

const DEFAULT_WINDOW_MINUTES = 30;

/**
 * Find a recent transaction that looks like the same expense (same payee key
 * + same amount within the time window). Returns the match or null.
 */
export function findRecentDuplicate(
  transactions: readonly Transaction[],
  candidate: { amount: number; description: string; date: string },
  windowMinutes = DEFAULT_WINDOW_MINUTES,
): Transaction | null {
  const payeeKey = normalizePayeeKey(candidate.description);
  if (!payeeKey) return null;
  const windowMs = windowMinutes * 60 * 1000;
  const candidateTime = new Date(candidate.date).getTime();

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    if (normalizePayeeKey(tx.description) !== payeeKey) continue;
    if (Math.abs(tx.amount - candidate.amount) > 1e-2) continue;
    const txTime = new Date(tx.date).getTime();
    if (Number.isNaN(txTime) || Number.isNaN(candidateTime)) continue;
    if (Math.abs(txTime - candidateTime) <= windowMs) return tx;
  }
  return null;
}