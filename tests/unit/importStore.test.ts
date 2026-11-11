import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';
import { persistFreshTransactions, txDedupeKey, type StorableTransaction } from '../../src/utils/importStore';

const base: StorableTransaction = {
  description: 'Kopi',
  amount: 25000,
  date: '2026-09-02',
  createdAt: '2026-09-02T10:00:00.000Z',
};

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('persistFreshTransactions', () => {
  it('menyimpan baris baru dan melewati duplikat di file maupun DB', async () => {
    const first = await persistFreshTransactions([base, { ...base }]);
    expect(first).toEqual({ status: 'saved', fresh: 1, skippedInDb: 1 });

    const second = await persistFreshTransactions([base, { ...base, description: 'Teh', amount: 10000 }]);
    expect(second).toEqual({ status: 'saved', fresh: 1, skippedInDb: 1 });
    expect(await db.transactions.count()).toBe(2);
  });

  it('dua impor bersamaan tidak membuat baris ganda', async () => {
    const [a, b] = await Promise.all([
      persistFreshTransactions([base]),
      persistFreshTransactions([base]),
    ]);
    expect(a.status).toBe('saved');
    expect(b.status).toBe('saved');
    expect(await db.transactions.count()).toBe(1);
  });

  it('txDedupeKey stabil untuk field opsional kosong', () => {
    expect(txDedupeKey(base)).toBe('Kopi|25000|2026-09-02||');
  });

  it('baris soft-deleted tidak menghalangi impor ulang', async () => {
    await persistFreshTransactions([base]);
    const row = await db.transactions.toCollection().first();
    if (!row?.id) throw new Error('transaction id missing');
    await db.transactions.update(row.id, { deletedAt: '2026-09-03T00:00:00.000Z' });

    const again = await persistFreshTransactions([base]);
    expect(again).toEqual({ status: 'saved', fresh: 1, skippedInDb: 0 });
    expect(await db.transactions.count()).toBe(2);
    expect(await db.transactions.filter((tx) => !tx.deletedAt).count()).toBe(1);
  });
});
