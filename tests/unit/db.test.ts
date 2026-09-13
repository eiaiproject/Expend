import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';

beforeEach(async () => {
  await db.transactions.clear();
  await db.chatMessages.clear();
});

describe('db schema', () => {
  it('opens at version 2 with both stores', async () => {
    await db.open();
    expect(db.verno).toBe(2);
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
});
