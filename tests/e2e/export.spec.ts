import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import type { Transaction } from '../../src/db/db';
import { db } from '../../src/db/db';

test.describe('export CSV', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(
      () =>
        new Promise<void>((res, rej) => {
          const r = indexedDB.deleteDatabase('ExpendDB');
          r.onsuccess = () => res();
          r.onerror = () => rej(r.error);
          r.onblocked = () => res();
        }),
    );
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Pengaturan' })).toBeVisible();
  });

  test('CSV download contains header + rows', async ({ page }) => {
    await page.evaluate(async () => {
      await db.transactions.bulkAdd([
        { description: 'Kopi, "Susu"', amount: 25000, date: '2026-09-02', createdAt: '2026-09-02T10:00:00.000Z', source: 'GoPay' },
        { description: 'Nasi Goreng', amount: 35000, date: '2026-09-01', createdAt: '2026-09-01T10:00:00.000Z' },
      ] as Transaction[]);
    });
    await page.reload();
    await page.goto('/settings');
    const dlPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Ekspor CSV' }).click();
    const dl = await dlPromise;
    const p = await dl.path();
    const csv = fs.readFileSync(p!, 'utf-8');
    expect(csv).toContain('Tanggal,Deskripsi,Jumlah');
    expect(csv).toContain('"Kopi, ""Susu"""');
    expect(csv.split('\n').length).toBeGreaterThanOrEqual(3);
  });

  test('filter by date range', async ({ page }) => {
    await page.evaluate(async () => {
      await db.transactions.bulkAdd([
        { description: 'A', amount: 1, date: '2026-09-01', createdAt: '2026-09-01T00:00:00.000Z' },
        { description: 'B', amount: 2, date: '2026-09-02', createdAt: '2026-09-02T00:00:00.000Z' },
      ] as Transaction[]);
    });
    await page.reload();
    await page.goto('/settings');
    await page.locator('#export-from').fill('2026-09-02');
    await page.locator('#export-to').fill('2026-09-02');
    const dlPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Ekspor CSV' }).click();
    const dl = await dlPromise;
    const csv = fs.readFileSync((await dl.path())!, 'utf-8');
    expect(csv).toContain('B');
    expect(csv).not.toContain('\nA,');
  });

  test('empty disables export', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Ekspor CSV' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Ekspor JSON' })).toBeDisabled();
  });

  test('filtered empty shows toast', async ({ page }) => {
    await page.evaluate(async () => {
      await db.transactions.bulkAdd([{ description: 'A', amount: 1, date: '2026-09-01', createdAt: '2026-09-01T00:00:00.000Z' } as Transaction]);
    });
    await page.reload();
    await page.goto('/settings');
    await page.locator('#export-from').fill('2026-09-03');
    await page.locator('#export-to').fill('2026-09-04');
    await page.getByRole('button', { name: 'Ekspor CSV' }).click();
    await expect(page.getByText('Tidak ada transaksi')).toBeVisible();
  });

  test('CSV download filename respects date range', async ({ page }) => {
    await page.goto('/chat');
    await page.getByLabel('Tulis pengeluaran').fill('kopi 25000');
    await page.getByRole('button', { name: 'Kirim transaksi' }).click();
    await expect(page.getByText('Periksa transaksi')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Simpan transaksi' }).click();
    await expect(page.getByText(/Tercatat/)).toBeVisible();
    await page.goto('/settings');
    await page.locator('#export-from').fill('2026-01-01');
    await page.locator('#export-to').fill('2099-12-31');
    const dlPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Ekspor CSV' }).click();
    const dl = await dlPromise;
    expect(dl.suggestedFilename()).toBe('expend-2026-01-01_2099-12-31.csv');
  });

  test('JSON download round-trips version plus rows', async ({ page }) => {
    await page.goto('/chat');
    await page.getByLabel('Tulis pengeluaran').fill('kopi 25000');
    await page.getByRole('button', { name: 'Kirim transaksi' }).click();
    await expect(page.getByText('Periksa transaksi')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Simpan transaksi' }).click();
    await expect(page.getByText(/Tercatat/)).toBeVisible();
    await page.goto('/settings');
    const dlPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Ekspor JSON' }).click();
    const dl = await dlPromise;
    const p = await dl.path();
    const parsed = JSON.parse(fs.readFileSync(p!, 'utf-8'));
    expect(parsed.version).toBe(1);
    expect(parsed.count).toBe(1);
    expect(parsed.transactions).toHaveLength(1);
    expect(parsed.transactions[0].description).toBe('Kopi');
  });
});
