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
  try {
    return await db.transaction('rw', db.transactions, async () => {
      // Baca dedupe dan tulis di transaksi yang sama. Dua impor bersamaan
      // akan diserialisasi Dexie, sehingga baris yang sama tidak lolos dua kali.
      const existing = await db.transactions.toArray();
      // Soft-deleted rows stay in the DB for undo/audit, but they must not
      // block a later import of the same transaction.
      const existingKeys = new Set(existing.filter((tx) => !tx.deletedAt).map(txDedupeKey));
      const seen = new Set<string>();
      const fresh = items.filter((tx) => {
        const key = txDedupeKey(tx);
        if (existingKeys.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (fresh.length) await db.transactions.bulkAdd(fresh.map((tx) => ({ ...tx })));
      return { status: 'saved' as const, fresh: fresh.length, skippedInDb: items.length - fresh.length };
    });
  } catch (e) {
    if (isQuotaError(e)) return { status: 'quota' };
    throw e;
  }
}
