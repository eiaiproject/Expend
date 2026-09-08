import type { Transaction } from '../db/db';

export type GroupGranularity = 'day' | 'week' | 'month';

export interface TxGroup {
  key: string;
  total: number;
  count: number;
  txs: Transaction[];
}

function mondayKey(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(y!, m! - 1, d!);
  const dow = (dt.getDay() + 6) % 7; // Mon=0 ... Sun=6
  dt.setDate(dt.getDate() - dow);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function groupKey(dateISO: string, granularity: GroupGranularity): string {
  if (granularity === 'month') return dateISO.slice(0, 7);
  if (granularity === 'week') return mondayKey(dateISO);
  return dateISO;
}

/** Descending by ISO key (YYYY-MM-DD / YYYY-MM). Extracted for S3358. */
function byKeyDesc(a: TxGroup, b: TxGroup): number {
  if (a.key === b.key) return 0;
  return a.key < b.key ? 1 : -1;
}

/** Group transactions by day/week/month key, groups sorted desc. Pure. */
export function groupTransactions(txs: readonly Transaction[], granularity: GroupGranularity): TxGroup[] {
  const map = new Map<string, TxGroup>();
  for (const tx of txs) {
    const key = groupKey(tx.date, granularity);
    const g = map.get(key);
    if (g) {
      g.txs.push(tx);
      g.total += tx.amount;
      g.count += 1;
    } else {
      map.set(key, { key, total: tx.amount, count: 1, txs: [tx] });
    }
  }
  return [...map.values()].sort(byKeyDesc);
}
