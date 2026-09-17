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

test.describe('dark OS emulated', () => {
  test.use({ colorScheme: 'dark' });

  test('dark OS + light theme: edit sheet text stays dark', async ({ page }) => {
    await page.goto('/settings');
    await page.getByLabel('Tema').selectOption('light');
    await seedOne(page, 'kopi 25000');
    await openEdit(page);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('light');
    // #1A1A1A = light theme --text-primary (bukan CanvasText putih dari OS dark).
    expect(await page.locator('dialog h2').evaluate((el) => getComputedStyle(el).color)).toBe('rgb(26, 26, 26)');
    expect(await page.locator('dialog input').first().evaluate((el) => getComputedStyle(el).color)).toBe('rgb(26, 26, 26)');
    // Wordmark hijau brand #264025 di light mode.
    await expectWordmark(page, 'rgb(38, 64, 37)');
  });
});

test.describe('light OS (default)', () => {
  test('light OS + dark theme: edit sheet text stays light', async ({ page }) => {
    await page.goto('/settings');
    await page.getByLabel('Tema').selectOption('dark');
    await seedOne(page, 'kopi 25000');
    await openEdit(page);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('dark');
    // #e8e8e8 = dark theme --text-primary.
    expect(await page.locator('dialog h2').evaluate((el) => getComputedStyle(el).color)).toBe('rgb(232, 232, 232)');
    expect(await page.locator('dialog input').first().evaluate((el) => getComputedStyle(el).color)).toBe('rgb(232, 232, 232)');
    // Wordmark hijau #6a9f3e di dark mode.
    await expectWordmark(page, 'rgb(106, 159, 62)');
  });
});
