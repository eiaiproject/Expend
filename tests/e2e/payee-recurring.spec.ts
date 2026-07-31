import { test, expect } from '@playwright/test';
import {
  uniqueName,
  visitApp,
  completeOnboarding,
  createExpenseViaService,
  openActionPicker,
  clickPickerAction,
  readTransactions,
  readTable,
  putRawRows,
} from './helpers';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── master.md 14.3 #3: Add expense through a frequent Payee ────────────
test.describe('frequent payee quick add', () => {
  test('frequently used payee appears in Quick Add and prefills the form', async ({ page }) => {
    const walletName = uniqueName('Cash');
    const payee = uniqueName('Kopi');
    await visitApp(page);
    await completeOnboarding(page, {
      walletName,
      walletBalance: '300000',
      categories: ['Food & Drinks'],
    });

    // Two recent expenses to the same payee → ranks as frequently used (master.md 6.2).
    await createExpenseViaService(page, {
      walletName,
      amount: 10000,
      description: payee,
      categoryName: 'Food & Drinks',
      date: today(),
    });
    await createExpenseViaService(page, {
      walletName,
      amount: 15000,
      description: payee,
      categoryName: 'Food & Drinks',
      date: today(),
    });

    // Open the Quick Add form (no "Add details" expansion needed — payee chip
    // is in the primary quick-add area).
    await openActionPicker(page);
    await clickPickerAction(page, /add expense/i);
    await page.waitForSelector('form input[inputmode="numeric"]', { timeout: 10_000 });

    // Frequently used payee chip is visible (6.2).
    const chip = page
      .getByRole('list', { name: /frequently used/i })
      .getByRole('button', { name: new RegExp(payee, 'i') });
    await chip.waitFor({ state: 'visible', timeout: 10_000 });
    await chip.click();

    // Selecting the payee prefills the description and category (6.3).
    // Description lives behind the progressive-disclosure "Add details" toggle (5.1).
    const detailsToggle = page.getByRole('button', { name: /add details/i });
    if (await detailsToggle.count() > 0) await detailsToggle.first().click();
    await page.waitForFunction(
      (name) => {
        const input = document.querySelector('form input[type="text"]:not([inputmode]):not([role="combobox"])') as HTMLInputElement | null;
        return input && input.value === name;
      },
      payee,
      { timeout: 5_000 },
    );

    // Amount stays empty until typed; save with just amount (6.3).
    await page.locator('form input[inputmode="numeric"]').first().fill('20000');
    await page.getByRole('button', { name: /^save$/i }).first().click();
    await page.waitForSelector('form input[inputmode="numeric"]', { state: 'detached', timeout: 10_000 });

    const txs = await readTransactions(page);
    expect(txs.some((t) => t.description === payee && t.amount === 20000)).toBeTruthy();
  });
});

// ─── master.md 14.3 #9: View Upcoming item ───────────────────────────────
test.describe('upcoming section', () => {
  test('due schedule appears in Upcoming and links to the schedule', async ({ page }) => {
    const walletName = uniqueName('Cash');
    const payee = uniqueName('Rent');
    await visitApp(page);
    await completeOnboarding(page, {
      walletName,
      walletBalance: '300000',
      categories: ['Food & Drinks'],
    });

    // Seed a remind-mode schedule due today (master.md 7.1/7.2).
    const wallets = await readTable<{ id: number; name: string }>(page, 'wallets');
    const wallet = wallets.find((w) => w.name === walletName);
    if (!wallet) throw new Error(`Wallet not found: ${walletName}`);
    await putRawRows(page, 'schedules', [{
      id: `e2e_${Date.now()}`,
      type: 'expense',
      frequency: 'weekly',
      startDate: today(),
      nextOccurrence: today(),
      endDate: null,
      amount: 50000,
      categoryId: null,
      walletId: wallet.id,
      payee,
      mode: 'remind',
      active: true,
      lastProcessedOccurrence: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }]);
    await page.waitForLoadState('networkidle');

    // Upcoming section shows the due item (master.md 7.4).
    const section = page.locator('section[aria-label]').filter({ hasText: payee });
    await section.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(section).toContainText(/50[.,]?000/); // locale-aware separator

    // View all / item links to the schedules page.
    await page.getByText(payee, { exact: true }).click();
    await page.waitForURL(/\/schedules/, { timeout: 10_000 });
    await expect(page.getByText(payee, { exact: true }).first()).toBeVisible();
  });
});
