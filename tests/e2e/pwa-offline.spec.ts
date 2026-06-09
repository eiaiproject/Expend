import { expect, test } from '@playwright/test';
import { completeOnboarding } from './helpers';

test('offline indicator appears when the app loses network', async ({ page, context }) => {
  await completeOnboarding(page);

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));

  await expect(page.getByText('Offline Mode')).toBeVisible();
  await expect(page.getByText('Data stored locally on this device.')).toBeVisible();

  await context.setOffline(false);
});

test('service worker serves the offline fallback page for offline navigation', async ({ page, context }) => {
  await completeOnboarding(page);

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  await context.setOffline(true);
  await page.goto('/offline-fallback-check');

  await expect(page.getByRole('heading', { name: "You're Offline" })).toBeVisible();
  await expect(page.getByText('Local-first data')).toBeVisible();

  await context.setOffline(false);
});
