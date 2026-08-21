import type { Transaction } from '../db/db';
import { normalizePayeeKey } from './payeeService';

/**
 * Most common amounts for a payee (frequency desc, tie → most recent).
 * Falls back to `fallback` when the payee has no expense history.
 */
export function suggestAmountsForPayee(
  transactions: readonly Transaction[],
  payee: string,
  fallback: readonly number[],
  limit = 3,
): number[] {
  if (!payee.trim()) return [...fallback];
  const key = normalizePayeeKey(payee);
  const freq = new Map<number, { count: number; lastDate: string }>();
  for (const t of transactions) {
    if (t.type !== 'expense' || normalizePayeeKey(t.description) !== key) continue;
    const entry = freq.get(t.amount) ?? { count: 0, lastDate: '' };
    entry.count += 1;
    if ((t.date ?? '') > entry.lastDate) entry.lastDate = t.date ?? '';
    freq.set(t.amount, entry);
  }
  const ranked = [...freq.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[1].lastDate.localeCompare(a[1].lastDate))
    .slice(0, limit)
    .map(([amount]) => amount);
  return ranked.length > 0 ? ranked : [...fallback];
}