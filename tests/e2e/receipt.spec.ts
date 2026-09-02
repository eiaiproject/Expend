import { test, expect } from '@playwright/test';

test('receipt upload → preview editable → Simpan → Home', async ({ page }) => {
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
  await page.reload();
  await page.goto('/chat');
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles('public/test-receipt.png');
  await expect(page.getByRole('progressbar')).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('Periksa transaksi')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('input[type="date"]')).toHaveValue('2026-08-31', { timeout: 5000 });
  await expect(page.locator('input[type="number"]')).not.toHaveValue('0');
  await page.getByRole('button', { name: 'Simpan transaksi' }).click();
  await expect(page.getByText(/Tercatat/)).toBeVisible();
  await page.goto('/');
  await expect(page.getByText('Toko Kopi')).toBeVisible();
  await expect(page.locator('.tabular-nums').first()).toContainText('52.500');
});
