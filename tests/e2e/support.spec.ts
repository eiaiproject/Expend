import { test, expect } from '@playwright/test';
import { visitApp, completeOnboarding, putRawRows, createExpense } from './helpers';

// Mirrors src/services/supportService.ts — the service imports constants that
// rely on Vite's __APP_VERSION__ define and cannot run in the Node runner.
const TRAKTEER_URL = 'https://trakteer.id/eiaiproject';

function uniqueName(prefix: string): string {
  return `${prefix}${Date.now()}`;
}

// master.md 14.3 #10/#11: support CTA from Settings and contextual prompt
// dismissal cooldown.
test.describe('support (master.md 14.3 #10/#11)', () => {
  test('Settings About shows the Trakteer CTA linking externally', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, { walletName: 'Cash', walletBalance: '100000', categories: [] });

    await page.goto('/settings');
    // About section is always visible (not an accordion).
    const supportLink = page.getByRole('link', { name: /support development/i });
    await expect(supportLink).toBeVisible();
    await expect(supportLink).toHaveAttribute('href', TRAKTEER_URL);
    await expect(supportLink).toHaveAttribute('target', '_blank');
    await expect(supportLink).toHaveAttribute('rel', /noopener/);
    // External-site cue is announced to screen readers.
    await expect(page.getByRole('link', { name: /support development opens external site/i })).toBeVisible();
  });

  test('contextual prompt can be dismissed and respects the cooldown', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, { walletName: 'Cash', walletBalance: '100000', categories: [] });

    // First completed transaction + a recorded backup make the app eligible
    // for the "first backup" milestone prompt (9.4).
    await createExpense(page, {
      walletName: 'Cash',
      amount: '10000',
      description: uniqueName('coffee'),
    });
    await putRawRows(page, 'settings', [
      { key: 'backup_metadata', value: { lastBackupAt: new Date().toISOString(), lastBackupVersion: 3, changesSinceBackup: 0, nextReminderEligibleAt: null } },
      { key: 'support_prompt_state', value: { lastPromptShownAt: null, lastPromptDismissedAt: null, supportClickedAt: null, permanentlySuppressed: false, promptedMilestones: [], milestoneEvents: {} } },
    ]);
    await page.reload();

    const prompt = page.getByRole('dialog', { name: /enjoying expend/i });
    await expect(prompt).toBeVisible({ timeout: 10_000 });
    await prompt.getByRole('button', { name: /not now/i }).click();
    await expect(prompt).toBeHidden();

    // Cooldown: after a reload the prompt must not reappear.
    await page.reload();
    // App bootstrap completes (and the support-prompt evaluation has run).
    await expect(page.getByRole('heading', { name: /overview/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('dialog', { name: /enjoying expend/i })).not.toBeVisible();
  });
});

// master.md 14.3 #12: the PWA reloads and works offline.
test.describe('offline reload (master.md 14.3 #12)', () => {
  // Friction audit B3: WebKit fails `page.reload()` while offline with an
  // engine error ("WebKit encountered an internal error") regardless of app
  // code — reproduced on the pre-fix baseline too. Covered by chromium CI.
  test.skip(({ browserName }) => browserName === 'webkit', 'WebKit engine cannot reload while offline (flaky engine error)');

  test('app renders from the service worker cache when offline', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, { walletName: 'Cash', walletBalance: '100000', categories: [] });
    await page.waitForLoadState('networkidle');

    await page.context().setOffline(true);
    await page.reload();
    // The cached shell must render and the local DB must still be readable.
    await expect(page.getByRole('heading', { name: /overview/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/from all wallets/i).first()).toBeVisible();
    await page.context().setOffline(false);
  });
});
