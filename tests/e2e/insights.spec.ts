import { test, expect } from '@playwright/test';
import { visitApp, completeOnboarding, putRawRows } from './helpers';
import type { Page } from '@playwright/test';

async function dismissSupportPrompt(page: Page): Promise<void> {
  const notNow = page.getByRole('button', { name: /not now/i });
  await notNow.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await notNow.isVisible()) await notNow.click();
}

// master.md 10: actionable insights — generated on Home, dismissible,
// drillable, and privacy-mode aware. Dates are computed relative to the
// real clock so the engine's month-boundary logic holds on any day.
function dateStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

test.describe('insights (master.md 10)', () => {
  test('shows an insight for an overdue debt, drills down, and dismisses it', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, { walletName: 'Cash', walletBalance: '500000', categories: ['Food & Drinks'] });
    await putRawRows(page, 'debts', [
      {
        id: 'debt_insight1',
        type: 'payable',
        personName: 'Bob',
        principalAmount: 100000,
        remainingAmount: 100000,
        walletId: 1,
        startDate: dateStr(-30),
        dueDate: dateStr(-5), // overdue
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    // Raw IndexedDB writes bypass Dexie's liveQuery events; a reload picks
    // the seeded rows up deterministically.
    await page.reload();
    await dismissSupportPrompt(page);

    // Insight card appears on Home with an overdue-debt claim.
    const section = page.getByRole('region', { name: /insights/i });
    await expect(section).toBeVisible();
    await expect(section.getByText(/payment to bob was due/i)).toBeVisible();

    // Drill-down goes to Debts.
    await section.getByRole('link').filter({ hasText: /payment to bob/i }).click();
    await expect(page).toHaveURL(/\/debts/);
    await expect(page.getByText(/Bob/).first()).toBeVisible();

    // Back home, dismiss removes the insight.
    await page.goto('/');
    await page.getByRole('region', { name: /insights/i }).getByRole('button', { name: /dismiss/i }).click();
    await expect(page.getByRole('region', { name: /insights/i })).not.toBeVisible();
  });

  test('hides derived percentages when privacy mode is on', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, { walletName: 'Cash', walletBalance: '500000', categories: ['Food & Drinks'] });

    // Current-month spend (6x 10k) vs previous-month (4x 5k) in category 1
    // → 200% rise, above the 50% guardrail.
    const curDay = Number(dateStr(0).slice(8, 10));
    const prevMonthLastDay = new Date(dateStr(0));
    prevMonthLastDay.setDate(1); // first of current month
    prevMonthLastDay.setDate(0); // last day of the previous month
    const prevMonthKey = prevMonthLastDay.toISOString().slice(0, 8); // YYYY-MM-

    const curRows = Array.from({ length: 6 }, (_, i) => ({
      walletId: 1,
      categoryId: 1,
      date: `${dateStr(0).slice(0, 8)}${String(Math.max(1, curDay - i)).padStart(2, '0')}`,
      description: 'Groceries',
      type: 'expense',
      amount: 10000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    const prevRows = Array.from({ length: 4 }, (_, i) => ({
      walletId: 1,
      categoryId: 1,
      date: `${prevMonthKey}${String(28 - i).padStart(2, '0')}`,
      description: 'Groceries',
      type: 'expense',
      amount: 5000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    await putRawRows(page, 'transactions', [...curRows, ...prevRows]);
    await page.reload();
    await dismissSupportPrompt(page);

    const section = page.getByRole('region', { name: /insights/i });
    await expect(section).toBeVisible();
    await expect(section.getByText(/higher than last month/i).first()).toBeVisible();

    // Toggle privacy from the Home header, then the percentage is masked.
    await page.getByRole('button', { name: /hide balance/i }).click();
    await expect(section.getByText(/\d+% higher than last month/i)).not.toBeVisible();
    await expect(section.getByText(/••%/).first()).toBeVisible();
  });
});
