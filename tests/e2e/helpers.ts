import { expect, type Page } from '@playwright/test';

export async function openFreshApp(page: Page, path = '/') {
  await page.addInitScript(() => {
    localStorage.setItem('i18nextLng', 'en');
  });
  await page.goto(path);
}

export async function completeOnboarding(page: Page) {
  await openFreshApp(page);
  await page.getByRole('button', { name: 'Enter App' }).click();
  await expect(page.getByText('Welcome to Expend')).toBeVisible();

  await page.getByPlaceholder('e.g. Main Wallet').fill('QA Wallet');
  await page.locator('input[placeholder="0"]').fill('1000000');
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByRole('button', { name: 'Food & Drinks' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Start Tracking' }).click();

  await expect(page.getByRole('heading', { name: 'Expend' })).toBeVisible();
  await expect(page.getByText('Recent Transactions')).toBeVisible();
}

export async function openAddTransactionSheet(page: Page) {
  await page.getByRole('button', { name: 'Add Transaction', exact: true }).filter({ visible: true }).first().click();

  const transactionDialog = page.getByRole('dialog', { name: 'Add Transaction' });
  try {
    await expect(transactionDialog).toBeVisible({ timeout: 1_000 });
    return;
  } catch {
    // The global FAB now opens an action picker before the transaction form.
  }

  await expect(page.getByRole('dialog', { name: /Pilih jenis catatan|Tambah Catatan|Add Record|Add Transaction/ })).toBeVisible();
  await page.getByRole('button', { name: /Tambah Pengeluaran|Add Expense/ }).click();
  await expect(transactionDialog).toBeVisible();
}

export async function addExpense(page: Page, description = 'QA Lunch') {
  await openAddTransactionSheet(page);

  await page.getByLabel(/Nominal/).fill('125000');
  await page.getByLabel(/Description/).fill(description);
  await page.getByRole('textbox', { name: /Category/ }).fill('Food & Drinks');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText(description)).toBeVisible();
}

export async function setupPin(page: Page, pin = '1234') {
  await page.getByRole('link', { name: 'Settings' }).click();
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
  await expect(page.getByText('PIN Lock')).toBeVisible();
}
