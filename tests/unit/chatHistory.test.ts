import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db/db';
import { addChatMessage } from '../../src/utils/chatHistory';

/** Riwayat chat tumbuh tanpa batas sebelum retensi ditambahkan. */
const MAX = 500;

const at = (i: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, 0) + i * 1000).toISOString();

const add = (i: number, role: 'user' | 'assistant' = 'user') =>
  addChatMessage({ role, text: `pesan ${i}`, createdAt: at(i) });

beforeEach(async () => {
  await db.chatMessages.clear();
});

describe('retensi riwayat chat', () => {
  it('menyimpan semua pesan selama masih di bawah batas', async () => {
    for (let i = 0; i < 20; i++) await add(i);
    expect(await db.chatMessages.count()).toBe(20);
  });

  it('membuang pesan tertua dan menyisakan 500 terbaru', async () => {
    for (let i = 0; i < MAX + 5; i++) await add(i);

    expect(await db.chatMessages.count()).toBe(MAX);
    const texts = (await db.chatMessages.orderBy('createdAt').toArray()).map((m) => m.text);
    expect(texts[0]).toBe('pesan 5');
    expect(texts.at(-1)).toBe(`pesan ${MAX + 4}`);
    expect(texts).not.toContain('pesan 4');
  });

  it('memangkas bertahap tanpa menghapus pesan yang masih boleh disimpan', async () => {
    for (let i = 0; i < MAX; i++) await add(i);
    await add(MAX, 'assistant');

    const texts = (await db.chatMessages.orderBy('createdAt').toArray()).map((m) => m.text);
    expect(texts).toHaveLength(MAX);
    expect(texts[0]).toBe('pesan 1');
    expect(texts.at(-1)).toBe(`pesan ${MAX}`);
  });
});
