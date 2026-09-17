import { test, expect } from '@playwright/test';

test.describe('chat note clause', () => {
  test('note tampil di live chip + kartu verifikasi + tersimpan', async ({ page }) => {
    await page.goto('/chat');
    await page.evaluate(() => indexedDB.deleteDatabase('ExpendDB'));
    await page.reload();
    const ta = page.getByLabel('Tulis pengeluaran');
    await ta.fill('kopi 25rb note untuk rapat');
    // Chip live: "Catatan: untuk rapat" (debounce 300ms).
    await expect(page.getByText('Catatan: untuk rapat').first()).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Kirim transaksi' }).click();
    // Kartu verifikasi menampilkan catatan.
    await expect(page.getByText('Periksa transaksi')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Catatan: untuk rapat')).toBeVisible();
    await page.getByRole('button', { name: 'Simpan transaksi' }).click();
    await expect(page.getByText(/Tercatat/)).toBeVisible({ timeout: 8000 });
    // Tersimpan sebagai field note, terlihat di Summary.
    await page.goto('/');
    await expect(page.getByText('untuk rapat')).toBeVisible({ timeout: 5000 });
  });

  test('kata produk bukan catatan: buku catatan tetap deskripsi', async ({ page }) => {
    await page.goto('/chat');
    await page.evaluate(() => indexedDB.deleteDatabase('ExpendDB'));
    await page.reload();
    await page.getByLabel('Tulis pengeluaran').fill('beli buku catatan 20rb');
    await page.getByRole('button', { name: 'Kirim transaksi' }).click();
    await expect(page.getByText('Periksa transaksi')).toBeVisible({ timeout: 5000 });
    // Tidak ada baris Catatan di ringkasan pending.
    await expect(page.getByText(/^Catatan:/)).toHaveCount(0);
  });
});
