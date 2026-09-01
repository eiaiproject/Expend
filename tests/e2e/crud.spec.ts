import { test, expect } from '@playwright/test';

test('CRUD: Chat → Home → delete', async ({ page }) => {
  // fresh DB per test - worker isolation or leftover from previous run
  await page.goto('/');
  await page.evaluate(() => new Promise<void>((res, rej) => {
    const r = indexedDB.deleteDatabase('ExpendDB'); r.onsuccess = () => res(); r.onerror = () => rej(r.error); r.onblocked = () => res();
  }));
  await page.reload();
  await page.goto('/chat');
  await expect(page.getByPlaceholder(/Tulis/)).toBeVisible();

  // Create 50000
  await page.getByPlaceholder(/Tulis/).fill('beli kopi di Indomaret 50000');
  await page.getByRole('button', { name: 'kirim' }).click();
  await expect(page.getByText('Siap dicatat').first()).toBeVisible();
  await expect(page.locator('input[value="Kopi Di Indomaret"]')).toBeVisible();
  await page.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByText(/Tercatat/).first()).toBeVisible();

  // Read Home
  await page.goto('/');
  await expect(page.getByText('Total pengeluaran')).toBeVisible();
  await expect(page.locator('.tabular-nums').first()).toContainText('50.000');
  await expect(page.getByText('Kopi Di Indomaret')).toBeVisible();

  // Create second 1,5jt
  await page.goto('/chat');
  await page.getByPlaceholder(/Tulis/).fill('laptop 1,5jt');
  await page.getByRole('button', { name: 'kirim' }).click();
  await expect(page.getByText('Siap dicatat').last()).toBeVisible();
  await page.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByText(/Tercatat/).nth(1)).toBeVisible();

  await page.goto('/');
  await expect.poll(async () => (await page.locator('.tabular-nums').first().textContent())?.replace(/\D/g, ''), { timeout: 10000 }).toBe('1550000');

  // Delete first
  const before = await page.getByRole('button', { name: 'hapus' }).count();
  expect(before).toBe(2);
  await page.getByRole('button', { name: 'hapus' }).first().click();
  await expect(page.getByRole('button', { name: 'hapus' })).toHaveCount(1);

  // Invalid + Batal
  await page.goto('/chat');
  await page.getByPlaceholder(/Tulis/).fill('halo bang');
  await page.getByRole('button', { name: 'kirim' }).click();
  await expect(page.getByText('Nominal tidak terbaca')).toBeVisible();

  await page.getByPlaceholder(/Tulis/).fill('kopi 25rb');
  await page.getByRole('button', { name: 'kirim' }).click();
  await expect(page.getByText('Siap dicatat').last()).toBeVisible();
  await page.getByRole('button', { name: 'Batal' }).click();
  await expect(page.getByText('Preview')).toHaveCount(0);
});
