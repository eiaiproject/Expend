import { test, expect } from '@playwright/test';

async function seedOne(page: import('@playwright/test').Page, text: string) {
  await page.goto('/chat');
  await page.evaluate(() => indexedDB.deleteDatabase('ExpendDB'));
  await page.reload();
  await page.getByLabel('Tulis pengeluaran').fill(text);
  await page.getByRole('button', { name: 'Kirim transaksi' }).click();
  await page.getByRole('button', { name: 'Simpan transaksi' }).click();
  await expect(page.getByText(/Tercatat/)).toBeVisible({ timeout: 8000 });
}

async function openEdit(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Edit transaksi/ }).first().click();
  await expect(page.locator('dialog h2')).toBeVisible({ timeout: 5000 });
}

async function expectWordmark(page: import('@playwright/test').Page, rgb: string) {
  await page.goto('/');
  // Wordmark = SVG inline currentColor (aria-hidden, nama dari h1 sr-only).
  // Scoped ke header Summary (sidebar juga punya img alt="Expend",
  // dan QuickToggles punya ikon svg sendiri).
  const host = page.locator('main header span[aria-hidden="true"]').first();
  const mark = host.locator('svg');
  await expect(mark).toBeVisible({ timeout: 5000 });
  expect(await host.evaluate((el) => getComputedStyle(el).color)).toBe(rgb);
  expect(await mark.evaluate((el) => (el as SVGElement).innerHTML)).toContain('<path');
}

async function verifyEditSheetTheme(
  page: import('@playwright/test').Page,
  theme: 'light' | 'dark',
  scheme: 'light' | 'dark',
  textRgb: string,
  markRgb: string,
) {
  await page.goto('/settings');
  await page.getByLabel('Tema').selectOption(theme);
  await seedOne(page, 'kopi 25000');
  await openEdit(page);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(scheme);
  expect(await page.locator('dialog h2').evaluate((el) => getComputedStyle(el).color)).toBe(textRgb);
  expect(await page.locator('dialog input').first().evaluate((el) => getComputedStyle(el).color)).toBe(textRgb);
  await expectWordmark(page, markRgb);
}

test.describe('dark OS emulated', () => {
  test.use({ colorScheme: 'dark' });

  test('dark OS + light theme: edit sheet text stays dark', async ({ page }) => {
    // #1A1A1A = light theme --text-primary (bukan CanvasText putih dari OS dark).
    // Wordmark hijau brand #264025 di light mode.
    await verifyEditSheetTheme(page, 'light', 'light', 'rgb(26, 26, 26)', 'rgb(38, 64, 37)');
  });
});

test.describe('light OS (default)', () => {
  test('light OS + dark theme: edit sheet text stays light', async ({ page }) => {
    // #e8e8e8 = dark theme --text-primary.
    // Wordmark hijau #6a9f3e di dark mode.
    await verifyEditSheetTheme(page, 'dark', 'dark', 'rgb(232, 232, 232)', 'rgb(106, 159, 62)');
  });
});
