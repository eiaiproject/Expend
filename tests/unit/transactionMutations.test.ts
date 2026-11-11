import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';
import { clearAllData, restoreTransaction, softDeleteTransaction, updateTransaction } from '../../src/utils/transactionMutations';

async function seed(): Promise<number> {
  return (await db.transactions.add({
    description: 'Kopi',
    amount: 25000,
    date: '2026-09-02',
    createdAt: '2026-09-02T10:00:00.000Z',
  })) as number;
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('transaction mutations', () => {
  it('update menulis updatedAt dan snapshot audit', async () => {
    const id = await seed();
    await updateTransaction(id, { description: 'Kopi Susu', amount: 30000, date: '2026-09-02' }, '2026-09-02T11:00:00.000Z');

    const row = await db.transactions.get(id);
    expect(row?.description).toBe('Kopi Susu');
    expect(row?.updatedAt).toBe('2026-09-02T11:00:00.000Z');

    const audit = await db.transactionAudit.where('txId').equals(id).toArray();
    expect(audit).toHaveLength(1);
    expect(audit[0]?.action).toBe('update');
    expect(audit[0]?.before?.description).toBe('Kopi');
  });

  it('soft delete menyembunyikan baris dari query aktif tetapi bisa dipulihkan', async () => {
    const id = await seed();
    await softDeleteTransaction(id, '2026-09-02T12:00:00.000Z');

    const deleted = await db.transactions.get(id);
    expect(deleted?.deletedAt).toBe('2026-09-02T12:00:00.000Z');
    const active = await db.transactions.filter((tx) => !tx.deletedAt).count();
    expect(active).toBe(0);

    await restoreTransaction(id, '2026-09-02T13:00:00.000Z');
    const restored = await db.transactions.get(id);
    expect(restored?.deletedAt).toBeUndefined();
    expect(await db.transactions.filter((tx) => !tx.deletedAt).count()).toBe(1);

    const actions = (await db.transactionAudit.where('txId').equals(id).toArray()).map((a) => a.action);
    expect(actions).toEqual(['delete', 'restore']);
  });

  it('clearAllData menghapus transaksi, chat, dan audit', async () => {
    const id = await seed();
    await db.chatMessages.add({ role: 'assistant', text: 'hi', createdAt: '2026-09-02T10:00:00.000Z', txId: id });
    await db.transactionAudit.add({ txId: id, action: 'create', at: '2026-09-02T10:00:00.000Z' });

    await clearAllData();
    expect(await db.transactions.count()).toBe(0);
    expect(await db.chatMessages.count()).toBe(0);
    expect(await db.transactionAudit.count()).toBe(0);
  });
});
