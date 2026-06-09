import { expect, test } from '@playwright/test';
import { addExpense, completeOnboarding, setupPin } from './helpers';

test('onboarding, transaction, stats, and 404 flows work', async ({ page }) => {
  await completeOnboarding(page);
  await addExpense(page);

  await page.getByRole('link', { name: 'Stats' }).click();
  await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible();
  await expect(page.getByText('Monthly Comparison')).toBeVisible();

  await page.goto('/missing-route');
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
  await expect(page.getByText('Page not found')).toBeVisible();
});

test('PIN lock gates app content after reload and unlocks with the configured PIN', async ({ page }) => {
  await completeOnboarding(page);
  await setupPin(page);

  await page.reload();
  await expect(page.getByText('App Locked')).toBeVisible();
  await expect(page.getByText('Recent Transactions')).toHaveCount(0);

  for (const digit of '1234') {
    await page.getByRole('button', { name: `Enter ${digit}` }).click();
  }

  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByText('App Locked')).toHaveCount(0);
});


