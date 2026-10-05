import { db } from '../db/db';

export interface StorableTransaction {
  description: string;
  amount: number;
  date: string;
  source?: string;
  note?: string;
  createdAt: string;
  rawText?: string;
}

export type PersistOutcome =
  | { status: 'saved'; fresh: number; skippedInDb: number }
  | { status: 'quota' };

export function txDedupeKey(tx: Pick<StorableTransaction, 'description' | 'amount' | 'date' | 'source' | 'note'>): string {
  return `${tx.description}|${tx.amount}|${tx.date}|${tx.source ?? ''}|${tx.note ?? ''}`;
}

function isQuotaError(e: unknown): boolean {
  return (e as Error)?.name === 'QuotaExceededError' || /quota/i.test((e as Error)?.message ?? '');
}

/**
 * Append-only + dedupe eksak terhadap DB dalam satu transaksi.
 * Dipakai bersama oleh impor JSON dan CSV Sheets agar alurnya identik.
 * Non-kuota error dilempar ke pemanggil (toast generik di sana).
 */
export async function persistFreshTransactions(items: StorableTransaction[]): Promise<PersistOutcome> {
  const existing = await db.transactions.toArray();
  const existingKeys = new Set(existing.map(txDedupeKey));
  const fresh = items.filter((tx) => !existingKeys.has(txDedupeKey(tx)));
  if (fresh.length) {
    try {
      await db.transaction('rw', db.transactions, async () => {
        await db.transactions.bulkAdd(fresh.map((tx) => ({ ...tx })));
      });
    } catch (e) {
      if (isQuotaError(e)) return { status: 'quota' };
      throw e;
    }
  }
  return { status: 'saved', fresh: fresh.length, skippedInDb: items.length - fresh.length };
}
