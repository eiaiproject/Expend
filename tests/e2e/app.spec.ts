import { test, expect } from '@playwright/test';

test.describe('App Loading', () => {
  test('loads the landing page', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
    
    // Check that the page title contains Expend
    await expect(page).toHaveTitle(/Expend/i);
  });

  test('shows main app after onboarding', async ({ page }) => {
    await page.goto('/');
    
    // Look for the enter button or try web button
    const enterButton = page.getByRole('button', { name: /enter|try/i });
    
    // If onboarding is shown, click through it
    if (await enterButton.isVisible()) {
      await enterButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Check that we can see the home view
    const homeLink = page.getByRole('link', { name: /home/i });
    await expect(homeLink).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Skip onboarding if present
    const enterButton = page.getByRole('button', { name: /enter|try/i });
    if (await enterButton.isVisible()) {
      await enterButton.click();
      await page.waitForTimeout(1000);
    }
  });

  test('navigates to wallets page', async ({ page }) => {
    await page.getByRole('link', { name: /wallets/i }).click();
    await expect(page).toHaveURL(/wallets/);
  });

  test('navigates to debts page', async ({ page }) => {
    await page.getByRole('link', { name: /debts/i }).click();
    await expect(page).toHaveURL(/debts/);
  });

  test('navigates to stats page', async ({ page }) => {
    await page.getByRole('link', { name: /stats/i }).click();
    await expect(page).toHaveURL(/stats/);
  });

  test('navigates to settings page', async ({ page }) => {
    await page.getByRole('link', { name: /settings/i }).click();
    await expect(page).toHaveURL(/settings/);
  });
});

test.describe('Accessibility', () => {
  test('has no major accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check for basic accessibility attributes
    const html = await page.content();
    
    // Check for lang attribute
    expect(html).toContain('lang=');
    
    // Check for main landmark
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('all buttons have accessible names', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Skip onboarding if present
    const enterButton = page.getByRole('button', { name: /enter|try/i });
    if (await enterButton.isVisible()) {
      await enterButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Check that all buttons have accessible names
    const buttons = page.locator('button');
    const count = await buttons.count();
    
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const name = await button.getAttribute('aria-label');
      const text = await button.textContent();
      
      // Button should have either aria-label or visible text
      expect(name || text?.trim()).toBeTruthy();
    }
  });
});
