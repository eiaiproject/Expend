import { test, expect } from '@playwright/test';

async function freshFirstRun(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.removeItem('expend_onboarded');
    indexedDB.deleteDatabase('ExpendDB');
  });
  await page.reload();
}

test.describe('onboarding + smart input', () => {
  test('first-run coach tampil, bisa skip, flag persist', async ({ page }) => {
    await freshFirstRun(page);
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Selamat datang di Expend')).toBeVisible();
    await page.getByRole('button', { name: 'Lewati' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('expend_onboarded'))).toBe('1');
  });

  test('coach contoh mengisi chat via ?input=', async ({ page }) => {
    await freshFirstRun(page);
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 });
    await page.getByRole('button', { name: 'Lanjut' }).click();
    await page.getByRole('button', { name: /kopi 25rb dari BSI/ }).click();
    await expect(page).toHaveURL(/\/chat\?input=/);
    await expect(page.getByLabel('Tulis pengeluaran')).toHaveValue(/kopi 25rb dari BSI/);
  });

  test('smart input: badge live + InlineAlert + cheat sheet', async ({ page }) => {
    await page.goto('/chat');
    await page.evaluate(() => indexedDB.deleteDatabase('ExpendDB'));
    await page.reload();
    const ta = page.getByLabel('Tulis pengeluaran');
    await ta.fill('kopi 25rb dari BSI');
    // Badge nominal hijau + sumber (debounce 300ms). Intl id-ID menyisipkan
    // NBSP ("Rp 25.000") sehingga matcher berupa regex.
    await expect(page.getByText(/Rp\s*25\.000/).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('BSI').first()).toBeVisible();
    // Gagal parse → pesan actionable.
    await ta.fill('Kopi 50');
    await expect(page.getByText(/Nominal terlalu kecil/)).toBeVisible({ timeout: 5000 });
    // Cheat sheet dari tombol ?.
    await page.getByRole('button', { name: 'Lihat format input' }).click();
    await expect(page.getByText('Format input yang diterima')).toBeVisible();
    await page.getByRole('button', { name: 'Tutup' }).click();
  });

  test('summary: search + shortcut / + one-tap empty examples', async ({ page }) => {
    await page.goto('/chat');
    await page.evaluate(() => indexedDB.deleteDatabase('ExpendDB'));
    await page.reload();
    await page.getByLabel('Tulis pengeluaran').fill('kopi susu 25000');
    await page.getByRole('button', { name: 'Kirim transaksi' }).click();
    await page.getByRole('button', { name: 'Simpan transaksi' }).click();
    await expect(page.getByText(/Tercatat/)).toBeVisible({ timeout: 8000 });
    await page.goto('/');
    const search = page.getByLabel('Cari transaksi');
    await expect(search).toBeVisible();
    await page.keyboard.press('/');
    await expect(search).toBeFocused();
    await search.fill('susu');
    await expect(page.getByText('Kopi Susu')).toBeVisible({ timeout: 5000 });
  });
});
