import { test, expect } from '@playwright/test';

async function freshDB(page) {
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
}

test.describe('user prefs + edit + keyboard', () => {
  test('edit transaksi via dialog (Escape menutup, simpan tak duplikat)', async ({ page }) => {
    await freshDB(page);
    await page.goto('/chat');
    await page.getByPlaceholder(/Contoh/).fill('kopi 20rb');
    await page.getByRole('button', { name: 'Kirim transaksi' }).click();
    await page.getByRole('button', { name: 'Simpan transaksi' }).click();
    await expect(page.getByText(/Tercatat/)).toBeVisible({ timeout: 8000 });

    await page.goto('/');
    await page.getByRole('button', { name: /Edit transaksi/ }).first().click();
    const desc = page.getByLabel('Deskripsi');
    await expect(desc).toBeFocused({ timeout: 5000 });
    await desc.fill('Kopi Susu');
    await page.getByRole('button', { name: 'Simpan', exact: true }).click();
    await expect(page.getByText('Kopi Susu')).toBeVisible();
    await expect(page.locator('button[aria-label^="Hapus transaksi"]')).toHaveCount(1);

    // Escape menutup dialog tanpa menyimpan
    await page.getByRole('button', { name: /Edit transaksi/ }).first().click();
    await expect(page.getByLabel('Deskripsi')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByLabel('Deskripsi')).toHaveCount(0);
  });

  test('ganti tema tersimpan + ganti bahasa memperbarui UI', async ({ page }) => {
    await page.goto('/settings');
    const theme = page.getByRole('combobox', { name: 'Tema' });
    await expect(theme).toBeVisible();
    await theme.selectOption('dark');
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
    await theme.selectOption('light');
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
    await theme.selectOption('system');

    const langId = page.getByRole('combobox', { name: 'Bahasa' });
    await langId.selectOption('en');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    const langEn = page.getByRole('combobox', { name: 'Language' });
    await langEn.selectOption('id');
    await expect(page.getByRole('heading', { name: 'Pengaturan' })).toBeVisible();
  });

  test('navigasi keyboard dasar: skip link + tab ke composer', async ({ page }) => {
    await page.goto('/chat');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: /Lewati|Skip/ });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    // composer textarea fokus via tab berulang (maks 20x agar tak rapuh)
    const composer = page.getByLabel(/Tulis pengeluaran|Write expense/);
    for (let i = 0; i < 20; i++) {
      if (await composer.evaluate((el) => document.activeElement === el).catch(() => false)) break;
      await page.keyboard.press('Tab');
    }
    await expect(composer).toBeFocused();
  });
});
