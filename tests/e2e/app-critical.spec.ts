import { expect, test } from '@playwright/test';
import { addExpense, completeOnboarding, createDebtWithPayment, setupPin } from './helpers';

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

test('JSON backup restores debts and debt payments after local reset', async ({ page }) => {
  await completeOnboarding(page);
  await page.waitForLoadState('networkidle');
  await createDebtWithPayment(page);

  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Data' }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Full Backup (JSON)' }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  expect(backupPath).toBeTruthy();

  await page.getByRole('button', { name: 'Reset Local Data' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();

  await expect(page.getByRole('button', { name: 'Try Web Version' })).toBeVisible();
  await page.getByRole('button', { name: 'Try Web Version' }).click();
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Data' }).click();

  await page.locator('input[type="file"]').setInputFiles(backupPath!);
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('Import successful.')).toBeVisible();

  await page.getByRole('link', { name: 'Debts' }).click();
  await expect(page.getByText('QA Contact')).toBeVisible();
  await expect(page.getByRole('button', { name: /QA Contact.*Partial/ })).toBeVisible();
});
