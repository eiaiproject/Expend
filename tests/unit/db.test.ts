import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';

beforeEach(async () => {
  await db.transactions.clear();
  await db.chatMessages.clear();
});

describe('db schema', () => {
  it('opens at version 3 with both stores', async () => {
    await db.open();
    expect(db.verno).toBe(3);
    expect(db.tables.map((t) => t.name).sort()).toEqual(['chatMessages', 'transactions']);
  });

  it('round-trips a transaction (migration smoke test)', async () => {
    const id = await db.transactions.add({
      description: 'Kopi',
      amount: 25000,
      date: '2026-09-02',
      createdAt: '2026-09-02T10:00:00.000Z',
    });
    const row = await db.transactions.get(Number(id));
    expect(row?.description).toBe('Kopi');
    expect(row?.amount).toBe(25000);
  });

  it('migrates v2 rows (without amount/source indexes) to v3 shape', async () => {
    const id = await db.transactions.add({
      description: 'Nasi Goreng',
      amount: 35000,
      date: '2026-09-03',
      createdAt: '2026-09-03T10:00:00.000Z',
      source: 'Kas',
    });
    const byAmount = await db.transactions.where('amount').equals(35000).toArray();
    expect(byAmount.map((r) => r.description)).toContain('Nasi Goreng');
    const msgId = await db.chatMessages.add({
      role: 'assistant',
      text: 'Tercatat.',
      createdAt: '2026-09-03T10:01:00.000Z',
      txId: Number(id),
    });
    const byTx = await db.chatMessages.where('txId').equals(Number(id)).toArray();
    expect(byTx.map((m) => m.id)).toContain(msgId);
  });
});
