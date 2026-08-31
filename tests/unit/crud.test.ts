import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../src/db/db';
import { parseChatInput } from '../../src/utils/chatParser';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('crud e2e via Dexie', () => {
  it('Create: parse + Simpan → Home totals', async () => {
    const p = parseChatInput('beli kopi di Indomaret 50000')!;
    expect(p).toEqual({ description: 'Kopi Di Indomaret', amount: 50000 });
    const now = new Date().toISOString();
    const id = (await db.transactions.add({ description: p.description, amount: p.amount, date: now.slice(0, 10), createdAt: now })) as number;
    const txs = await db.transactions.toArray();
    expect(txs).toHaveLength(1);
    expect(txs[0]!.description).toBe('Kopi Di Indomaret');
    const total = txs.reduce((a, t) => a + t.amount, 0);
    expect(total).toBe(50000);
    // chat persist
    await db.chatMessages.add({ role: 'user', text: 'beli kopi di Indomaret 50000', createdAt: now });
    await db.chatMessages.add({ role: 'assistant', text: 'Tercatat ✓', createdAt: now, txId: id });
    expect(await db.chatMessages.count()).toBe(2);
  });

  it('Read: orderBy createdAt reverse', async () => {
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      await db.transactions.add({ description: `Item ${i}`, amount: (i + 1) * 10000, date: '2026-08-31', createdAt: new Date(now + i).toISOString() });
    }
    const txs = await db.transactions.orderBy('createdAt').reverse().toArray();
    expect(txs[0]!.description).toBe('Item 2');
    expect(txs).toHaveLength(3);
  });

  it('Update: ganti amount (delete+add pattern)', async () => {
    const now = new Date().toISOString();
    const id = (await db.transactions.add({ description: 'Kopi', amount: 50000, date: now.slice(0, 10), createdAt: now })) as number;
    await db.transactions.update(id, { amount: 25000 });
    expect((await db.transactions.get(id))!.amount).toBe(25000);
  });

  it('Delete: transaksi + chatMessages', async () => {
    const now = new Date().toISOString();
    const id = (await db.transactions.add({ description: 'Hapus Me', amount: 10000, date: now.slice(0, 10), createdAt: now })) as number;
    await db.transactions.delete(id);
    expect(await db.transactions.count()).toBe(0);
    const mid = (await db.chatMessages.add({ role: 'assistant', text: 'hi', createdAt: now })) as number;
    await db.chatMessages.delete(mid);
    expect(await db.chatMessages.count()).toBe(0);
  });

  it('Edge: 50rb/1,5jt parser → total benar', async () => {
    const a = parseChatInput('kopi 50rb')!;
    const b = parseChatInput('laptop 1,5jt')!;
    expect(a.amount).toBe(50000);
    expect(b.amount).toBe(1_500_000);
    const now = new Date().toISOString();
    await db.transactions.bulkAdd([
      { description: a.description, amount: a.amount, date: now.slice(0, 10), createdAt: now },
      { description: b.description, amount: b.amount, date: now.slice(0, 10), createdAt: new Date(Date.now() + 1).toISOString() },
    ]);
    const total = (await db.transactions.toArray()).reduce((s, t) => s + t.amount, 0);
    expect(total).toBe(1_550_000);
  });

  it('no amount → null tidak nulis DB', async () => {
    expect(parseChatInput('halo bang')).toBeNull();
    expect(await db.transactions.count()).toBe(0);
  });
});
