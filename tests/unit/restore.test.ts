import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';
import { jsonBlob, parseImportJSON } from '../../src/utils/export';
import { persistFreshTransactions } from '../../src/utils/importStore';
import type { Transaction } from '../../src/db/db';

const txs: Transaction[] = [
  { description: 'Kopi', amount: 25000, date: '2026-09-01', createdAt: '2026-09-01T10:00:00.000Z' },
  { description: 'Listrik', amount: 200000, date: '2026-09-02', createdAt: '2026-09-02T10:00:00.000Z' },
  { description: 'Transport', amount: 15000, date: '2026-09-03', createdAt: '2026-09-03T10:00:00.000Z' },
];

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('restore JSON backup', () => {
  it('memulihkan jumlah dan total ke database kosong', async () => {
    const raw = await jsonBlob(txs).text();
    const parsed = parseImportJSON(raw);
    expect(parsed.ok).toBe(true);
    expect(parsed.transactions).toHaveLength(3);

    const outcome = await persistFreshTransactions(parsed.transactions);
    expect(outcome).toEqual({ status: 'saved', fresh: 3, skippedInDb: 0 });

    const restored = await db.transactions.toArray();
    expect(restored).toHaveLength(3);
    expect(restored.reduce((sum, tx) => sum + tx.amount, 0)).toBe(240000);
  });

  it('impor ulang file yang sama tidak menggandakan data', async () => {
    const raw = await jsonBlob(txs).text();
    const parsed = parseImportJSON(raw);
    await persistFreshTransactions(parsed.transactions);
    const again = await persistFreshTransactions(parsed.transactions);
    expect(again).toEqual({ status: 'saved', fresh: 0, skippedInDb: 3 });
    expect(await db.transactions.count()).toBe(3);
  });
});
