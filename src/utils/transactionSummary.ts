import { db } from '../db/db';

export interface TransactionSummary {
  count: number;
  total: number;
}

export interface SummaryFilter {
  from?: string;
  to?: string;
  query?: string;
}

/**
 * Hitung count dan total transaksi aktif memakai cursor IndexedDB. Baris tidak
 * pernah dikumpulkan menjadi array, sehingga memori tetap datar untuk dataset
 * besar. Filter tanggal dan pencarian diterapkan di cursor yang sama.
 */
export async function summarizeActiveTransactions(filter: SummaryFilter = {}): Promise<TransactionSummary> {
  const q = filter.query?.trim().toLowerCase() ?? '';
  let count = 0;
  let total = 0;
  await db.transactions.orderBy('date').reverse().each((tx) => {
    if (tx.deletedAt) return;
    if (filter.from && tx.date < filter.from) return;
    if (filter.to && tx.date > filter.to) return;
    if (q && !tx.description.toLowerCase().includes(q)) return;
    count += 1;
    total += tx.amount;
  });
  return { count, total };
}
