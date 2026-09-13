import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

// Isi input tanggal terkontrol React: set value lewat native setter + reset
// valueTracker agar event input selalu terdeteksi (fill programmatik bisa
// lolos dari state saat re-render menyela antar-field).
async function fillDate(page: Page, sel: string, v: string) {
  const input = page.locator(sel);
  await input.evaluate((el, value) => {
    const node = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
    const tracker = (node as unknown as { _valueTracker?: { setValue: (s: string) => void } })._valueTracker;
    tracker?.setValue('');
    setter.call(node, value);
    node.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);
  await expect(input).toHaveValue(v);
}

// Simpan transaksi lalu TUNGGU kartu pending hilang: Tercatat lama bisa
// lolos .last() sebelum save baru selesai (navigasi prematur = data hilang).
async function savePending(page: Page) {
  await page.getByRole('button', { name: 'Simpan transaksi' }).click();
  await expect(page.locator('#pending-desc')).toHaveCount(0, { timeout: 5000 });
}

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
    // Seed lewat UI (pola crud.spec.ts): db tidak bisa diimpor ke page.evaluate.
    await page.goto('/chat');
    await page.getByPlaceholder(/Contoh/).fill('kopi susu 25000');
    await page.getByRole('button', { name: 'Kirim transaksi' }).click();
    await expect(page.getByText('Siap dicatat').first()).toBeVisible();
    await page.locator('#pending-desc').fill('Kopi, "Susu"');
    await savePending(page);
    await page.getByPlaceholder(/Contoh/).fill('nasi goreng 35000');
    await page.getByRole('button', { name: 'Kirim transaksi' }).click();
    await expect(page.getByText('Siap dicatat').last()).toBeVisible();
    await savePending(page);
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
    await page.goto('/chat');
    await page.getByPlaceholder(/Contoh/).fill('jajan 15000');
    await page.getByRole('button', { name: 'Kirim transaksi' }).click();
    await expect(page.getByText('Siap dicatat').first()).toBeVisible();
    await page.locator('#pending-desc').fill('A');
    await page.locator('#pending-date').fill('2026-09-01');
    await savePending(page);
    await page.getByPlaceholder(/Contoh/).fill('jajan 20000');
    await page.getByRole('button', { name: 'Kirim transaksi' }).click();
    await expect(page.getByText('Siap dicatat').last()).toBeVisible();
    await page.locator('#pending-desc').fill('B');
    await page.locator('#pending-date').fill('2026-09-02');
    await savePending(page);
    await page.goto('/settings');
    // Tunggu data seed terpropagasi ke layar konsumen sebelum ekspor (anti-race).
    await expect(page.getByRole('button', { name: 'Ekspor CSV' })).toBeEnabled();
    await fillDate(page, '#export-from', '2026-09-02');
    await fillDate(page, '#export-to', '2026-09-02');
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
    await page.goto('/chat');
    await page.getByPlaceholder(/Contoh/).fill('jajan 15000');
    await page.getByRole('button', { name: 'Kirim transaksi' }).click();
    await expect(page.getByText('Siap dicatat').first()).toBeVisible();
    await page.locator('#pending-date').fill('2026-09-01');
    await savePending(page);
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
    await expect(page.getByRole('button', { name: 'Ekspor CSV' })).toBeEnabled();
    await fillDate(page, '#export-from', '2026-01-01');
    await fillDate(page, '#export-to', '2099-12-31');
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
    await expect(page.getByRole('button', { name: 'Ekspor JSON' })).toBeEnabled();
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
