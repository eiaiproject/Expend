import type { Transaction, ScheduleFrequency } from '../db/db';
import { normalizePayeeKey, normalizePayeeName } from './payeeService';
import { computeNextOccurrence } from './recurringService';
import { addDays, getTodayStr } from '../utils/dateUtils';

export interface RecurringCandidate {
  payeeKey: string;
  payeeName: string;
  amount: number;
  intervalDays: number;
  frequency: ScheduleFrequency;
  nextDate: string;
  occurrenceCount: number;
}

const INTERVALS: { days: number; frequency: ScheduleFrequency }[] = [
  { days: 7, frequency: 'weekly' },
  { days: 14, frequency: 'biweekly' },
  { days: 30, frequency: 'monthly' },
  { days: 365, frequency: 'yearly' },
];
const TOLERANCE_DAYS = 2;
const MIN_OCCURRENCES = 3;

function groupByPayee(transactions: readonly Transaction[]): Map<string, Transaction[]> {
  const byPayee = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.type !== 'expense' || !t.description) continue;
    const key = normalizePayeeKey(t.description);
    const arr = byPayee.get(key);
    if (arr) arr.push(t);
    else byPayee.set(key, [t]);
  }
  return byPayee;
}

function groupByAmount(txs: Transaction[]): Map<number, Transaction[]> {
  const byAmount = new Map<number, Transaction[]>();
  for (const t of txs) {
    const arr = byAmount.get(t.amount);
    if (arr) arr.push(t);
    else byAmount.set(t.amount, [t]);
  }
  return byAmount;
}

function fitsInterval(group: Transaction[], targetDays: number): boolean {
  for (let i = 1; i < group.length; i++) {
    const diff = Math.abs(
      (Date.parse(group[i]!.date ?? '') - Date.parse(group[i - 1]!.date ?? '')) / 86_400_000,
    );
    if (Math.abs(diff - targetDays) > TOLERANCE_DAYS) return false;
  }
  return true;
}

/**
 * Conservative recurring detector (automation B4): same payee, same amount,
 * ≥3 occurrences at a stable 7/14/30/365-day rhythm. `existingPayeeKeys`
 * excludes payees that already have a schedule.
 */
export function detectRecurringCandidates(
  transactions: readonly Transaction[],
  today = getTodayStr(),
  existingPayeeKeys: readonly string[] = [],
): RecurringCandidate[] {
  const byPayee = groupByPayee(transactions);
  const candidates: RecurringCandidate[] = [];

  for (const [key, txs] of byPayee) {
    if (existingPayeeKeys.includes(key)) continue;
    txs.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

    for (const [amount, group] of groupByAmount(txs)) {
      if (group.length < MIN_OCCURRENCES) continue;
      const matched = INTERVALS.find(({ days }) => fitsInterval(group, days));
      if (matched) {
        const last = group.at(-1)!;
        candidates.push({
          payeeKey: key,
          payeeName: normalizePayeeName(last.description),
          amount,
          intervalDays: matched.days,
          frequency: matched.frequency,
          nextDate: computeNextOccurrence((last.date ?? today).slice(0, 10), matched.frequency, 1),
          occurrenceCount: group.length,
        });
      }
    }
  }
  return candidates;
}

/** Suggested test: next occurrence is within the next `days` window. */
export function isDueSoon(candidate: RecurringCandidate, days = 7, today = getTodayStr()): boolean {
  const diff = (Date.parse(addDays(today, days)) - Date.parse(candidate.nextDate)) / 86_400_000;
  return diff >= 0;
}
