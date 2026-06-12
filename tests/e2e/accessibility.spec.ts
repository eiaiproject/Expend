import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { addExpense, completeOnboarding, openAddTransactionSheet } from './helpers';

async function waitForAppShellAnimation(page: Page) {
  await page.waitForFunction(() => {
    const main = document.querySelector('main');
    const shell = main?.closest('.min-h-screen');
    return !shell || getComputedStyle(shell).opacity === '1';
  });
}

async function expectNoSeriousA11yViolations(page: Page, include = 'body') {
  await waitForAppShellAnimation(page);

  const results = await new AxeBuilder({ page })
    .include(include)
    .analyze();

  const seriousViolations = results.violations.filter((violation) =>
    violation.impact === 'serious' || violation.impact === 'critical'
  );

  expect(seriousViolations).toEqual([]);
}

test('main app shell has no serious accessibility violations', async ({ page }) => {
  await completeOnboarding(page);
  await expectNoSeriousA11yViolations(page, 'main');
});

test('transaction form and stats charts have no serious accessibility violations', async ({ page }) => {
  await completeOnboarding(page);
  await addExpense(page, 'QA Accessibility Lunch');

  await openAddTransactionSheet(page);
  await expectNoSeriousA11yViolations(page, '[role="dialog"]');
  await page.keyboard.press('Escape');

  await page.getByRole('link', { name: 'Stats' }).click();
  await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible();
  await expectNoSeriousA11yViolations(page, 'main');
});
