import { test, expect } from '@playwright/test';
import * as XLSX from 'xlsx';
import * as fs from 'node:fs';

test.describe('export CSV/XLSX', () => {
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
      const { db } = await import('/src/db/db.ts');
      await db.transactions.bulkAdd([
        { description: 'Kopi, "Susu"', amount: 25000, date: '2026-09-02', createdAt: '2026-09-02T10:00:00.000Z', source: 'GoPay' },
        { description: 'Nasi Goreng', amount: 35000, date: '2026-09-01', createdAt: '2026-09-01T10:00:00.000Z' },
      ]);
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

  test('Excel download valid xlsx', async ({ page }) => {
    await page.evaluate(async () => {
      const { db } = await import('/src/db/db.ts');
      await db.transactions.bulkAdd([{ description: 'Kopi', amount: 25000, date: '2026-09-02', createdAt: new Date().toISOString() }]);
    });
    await page.reload();
    await page.goto('/settings');
    const dlPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Ekspor Excel' }).click();
    const dl = await dlPromise;
    const p = await dl.path();
    const buf = fs.readFileSync(p!);
    const wb = XLSX.read(buf, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]!];
    expect(XLSX.utils.sheet_to_json(ws)).toHaveLength(1);
  });

  test('filter by date range', async ({ page }) => {
    await page.evaluate(async () => {
      const { db } = await import('/src/db/db.ts');
      await db.transactions.bulkAdd([
        { description: 'A', amount: 1, date: '2026-09-01', createdAt: '2026-09-01T00:00:00.000Z' },
        { description: 'B', amount: 2, date: '2026-09-02', createdAt: '2026-09-02T00:00:00.000Z' },
      ]);
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
    await expect(page.getByRole('button', { name: 'Ekspor Excel' })).toBeDisabled();
  });

  test('filtered empty shows toast', async ({ page }) => {
    await page.evaluate(async () => {
      const { db } = await import('/src/db/db.ts');
      await db.transactions.bulkAdd([{ description: 'A', amount: 1, date: '2026-09-01', createdAt: '2026-09-01T00:00:00.000Z' }]);
    });
    await page.reload();
    await page.goto('/settings');
    await page.locator('#export-from').fill('2026-09-03');
    await page.locator('#export-to').fill('2026-09-04');
    await page.getByRole('button', { name: 'Ekspor CSV' }).click();
    await expect(page.getByText('Tidak ada transaksi')).toBeVisible();
  });
});
