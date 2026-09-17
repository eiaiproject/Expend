import { test, expect } from '@playwright/test';

test.describe('quick toggles in headers', () => {
  test('Summary: theme cycles and persists, language switches UI', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('theme');
      indexedDB.deleteDatabase('ExpendDB');
    });
    await page.reload();
    const themeBtn = page.getByRole('button', { name: /^Tema:/ });
    await expect(themeBtn).toBeVisible({ timeout: 5000 });

    // system → light → dark → system
    await expect(themeBtn).toHaveAttribute('aria-label', 'Tema: Sistem');
    await themeBtn.click();
    await expect(themeBtn).toHaveAttribute('aria-label', 'Tema: Terang');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await themeBtn.click();
    await expect(themeBtn).toHaveAttribute('aria-label', 'Tema: Gelap');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('button', { name: /^Tema:/ })).toHaveAttribute('aria-label', 'Tema: Gelap');

    // ID → EN tanpa buka Settings (aria-label ikut bahasa aktif)
    await page.getByRole('button', { name: 'Bahasa: English', exact: true }).click();
    await expect(page.getByText('Track expenses and recent transactions')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Language: Bahasa Indonesia', exact: true }).click();
    await expect(page.getByText('Pantau pengeluaran dan transaksi terbaru')).toBeVisible({ timeout: 5000 });
  });

  test('Chat header has the same toggles and stays in sync', async ({ page }) => {
    await page.goto('/chat');
    const themeBtn = page.getByRole('button', { name: /^Tema:/ });
    await expect(themeBtn).toBeVisible({ timeout: 5000 });
    await themeBtn.click();
    const label = await themeBtn.getAttribute('aria-label');
    expect(label).toMatch(/^Tema: /);
    // Sinkron dengan dropdown Settings
    await page.goto('/settings');
    const select = page.getByLabel('Tema');
    const expected = label!.includes('Terang') ? 'light' : label!.includes('Gelap') ? 'dark' : 'system';
    await expect(select).toHaveValue(expected);
  });
});
