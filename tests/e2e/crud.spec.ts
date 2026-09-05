import { test, expect } from '@playwright/test';

test('CRUD: Chat → Home → delete', async ({ page }) => {
  // fresh DB per test - worker isolation or leftover from previous run
  await page.goto('/');
  await page.evaluate(() => new Promise<void>((res, rej) => {
    const r = indexedDB.deleteDatabase('ExpendDB'); r.onsuccess = () => res(); r.onerror = () => rej(r.error); r.onblocked = () => res();
  }));
  await page.reload();
  await page.goto('/chat');
  await expect(page.getByPlaceholder(/Contoh/)).toBeVisible();

  // Create 50000
  await page.getByPlaceholder(/Contoh/).fill('beli kopi di Indomaret 50000');
  await page.getByRole('button', { name: 'Kirim transaksi' }).click();
  await expect(page.getByText('Siap dicatat').first()).toBeVisible();
  await expect(page.locator('input[value="Kopi di Indomaret"]')).toBeVisible();
  await page.getByRole('button', { name: 'Simpan transaksi' }).click();
  await expect(page.getByText(/Tercatat/).first()).toBeVisible();

  // Read Home
  await page.goto('/');
  await expect(page.getByText('Total pengeluaran')).toBeVisible();
  await expect(page.locator('.tabular-nums').first()).toContainText('50.000');
  await expect(page.getByText('Kopi di Indomaret')).toBeVisible();

  // Create second 1,5jt
  await page.goto('/chat');
  await page.getByPlaceholder(/Contoh/).fill('laptop 1,5jt');
  await page.getByRole('button', { name: 'Kirim transaksi' }).click();
  await expect(page.getByText('Siap dicatat').last()).toBeVisible();
  await page.getByRole('button', { name: 'Simpan transaksi' }).click();
  await expect(page.getByText(/Tercatat/).nth(1)).toBeVisible();

  await page.goto('/');
  await expect.poll(async () => (await page.locator('.tabular-nums').first().textContent())?.replace(/\D/g, ''), { timeout: 10000 }).toBe('1550000');

  // Delete first
  const before = await page.locator('button[aria-label^="Hapus transaksi"]').count();
  expect(before).toBe(2);
  await page.locator('button[aria-label^="Hapus transaksi"]').first().click();
  await expect(page.locator('button[aria-label^="Hapus transaksi"]')).toHaveCount(1);

  // Invalid + Batal
  await page.goto('/chat');
  await page.getByPlaceholder(/Contoh/).fill('halo bang');
  await page.getByRole('button', { name: 'Kirim transaksi' }).click();
  await expect(page.getByText('Nominal tidak terbaca')).toBeVisible();

  await page.getByPlaceholder(/Contoh/).fill('kopi 25rb');
  await page.getByRole('button', { name: 'Kirim transaksi' }).click();
  await expect(page.getByText('Siap dicatat').last()).toBeVisible();
  await page.getByRole('button', { name: 'Batal', exact: true }).click();
  await expect(page.getByText('Periksa transaksi')).toHaveCount(0);
});

test('Danger zone: delete all data', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => new Promise<void>((res, rej) => {
    const r = indexedDB.deleteDatabase('ExpendDB'); r.onsuccess = () => res(); r.onerror = () => rej(r.error); r.onblocked = () => res();
  }));
  await page.reload();

  // Add transactions via chat
  await page.goto('/chat');
  await page.reload();
  for (const input of ['kopi 25rb', 'makan 50rb', 'bensin 75k']) {
    await page.getByPlaceholder(/Contoh/).fill(input);
    await page.getByRole('button', { name: 'Kirim transaksi' }).click();
    await expect(page.locator('#pending-desc')).toBeVisible({ timeout: 8000 });
    await page.getByRole('button', { name: 'Simpan transaksi' }).click();
    await expect(page.getByText(/Tercatat/).last()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#pending-desc')).toHaveCount(0, { timeout: 5000 });
  }

  // Verify 3 transactions on Home
  await page.goto('/');
  await expect(page.getByText('3 transaksi')).toBeVisible();

  // Go to Settings → Danger Zone
  await page.goto('/settings');
  await expect(page.getByText('Zona Berbahaya')).toBeVisible();
  await expect(page.getByText('3 transaksi akan dihapus permanen')).toBeVisible();

  // Click Hapus → confirm dialog (aria-label = settings.deleteAll, i18n)
  await page.getByRole('button', { name: 'Hapus semua data', exact: true }).click();
  await expect(page.getByText('Hapus semua data?')).toBeVisible();
  // Use exact name match to avoid collision with 'Hapus' button
  await page.getByRole('button', { name: 'Hapus semua', exact: true }).click();

  // Verify toast and empty state
  await expect(page.getByText('Semua data transaksi berhasil dihapus')).toBeVisible({ timeout: 5000 });
  await page.goto('/');
  await expect(page.getByText('Belum ada transaksi')).toBeVisible();
});
