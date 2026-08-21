import { test, expect } from '@playwright/test';
import { uniqueName, visitApp, completeOnboarding, readTable, putRawRows } from './helpers';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

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
