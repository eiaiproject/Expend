import { expect, type Page } from '@playwright/test';

export async function openFreshApp(page: Page, path = '/') {
  await page.addInitScript(() => {
    localStorage.setItem('i18nextLng', 'en');
  });
  await page.goto(path);
}

export async function completeOnboarding(page: Page) {
  await openFreshApp(page);
  await page.getByRole('button', { name: 'Start Tracking Expenses' }).click();
  await expect(page.getByText('Welcome to Expend')).toBeVisible();

  await page.getByPlaceholder('e.g. Main Wallet').fill('QA Wallet');
  await page.locator('input[placeholder="0"]').fill('1000000');
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByRole('button', { name: 'Food & Drinks' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Start Tracking' }).click();

  // Scope to main content area to avoid matching sidebar heading
  await expect(page.locator('main').getByRole('heading', { name: 'Expend' })).toBeVisible();
  await expect(page.getByText('Recent Transactions')).toBeVisible();
}

export async function openAddTransactionSheet(page: Page) {
  await page.getByRole('button', { name: 'Add Transaction', exact: true }).filter({ visible: true }).first().click();

  // The FAB may open an action picker first, or go directly to the form.
  // Try the action picker path first.
  const expenseBtn = page.getByRole('button', { name: /Tambah Pengeluaran|Add Expense/ });
  if (await expenseBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await expenseBtn.click();
  }

  // Wait for the form dialog to be visible (whichever path was taken)
  await page.getByRole('dialog', { name: 'Add Transaction' }).last().waitFor({ state: 'visible', timeout: 10_000 });
  // Wait for lazy-loaded form content to render
  await expect(page.getByLabel(/Nominal/)).toBeVisible({ timeout: 10_000 });
}

export async function addExpense(page: Page, description = 'QA Lunch') {
  await openAddTransactionSheet(page);

  await page.getByLabel(/Nominal/).fill('125000');
  await page.getByLabel(/Description/).fill(description);
  await page.getByRole('combobox', { name: /Category|Type or select category/ }).fill('Food & Drinks');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText(description)).toBeVisible();
}

export async function setupPin(page: Page, pin = '1234') {
  await page.getByRole('link', { name: /Settings|More/ }).click();
  await page.getByRole('button', { name: 'Security' }).click();
  await page.getByRole('button', { name: 'Set up PIN' }).click();

  for (const digit of pin) {
    await page.getByRole('button', { name: digit }).click();
  }
  await page.getByRole('button', { name: 'Next' }).click();
  for (const digit of pin) {
    await page.getByRole('button', { name: digit }).click();
  }
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('PIN Lock', { exact: true })).toBeVisible();
}
