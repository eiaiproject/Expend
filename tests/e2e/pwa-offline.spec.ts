import { expect, test, type Page } from '@playwright/test';
import { completeOnboarding } from './helpers';

async function waitForServiceWorkerReady(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
}

test('offline indicator appears when the app loses network', async ({ page, context }) => {
  await completeOnboarding(page);

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));

  await expect(page.getByText('Offline Mode')).toBeVisible();
  await expect(page.getByText('Data stored locally on this device.')).toBeVisible();

  await context.setOffline(false);
});

test('service worker serves app shell for offline app route navigation', async ({ page, context }) => {
  await completeOnboarding(page);
  await waitForServiceWorkerReady(page);

  const appRoutes = [
    { path: '/', heading: 'Expend' },
    { path: '/wallets', heading: 'Wallets' },
    { path: '/debts', heading: 'Debts' },
    { path: '/stats', heading: 'Stats' },
    { path: '/settings', heading: 'Settings' },
    { path: '/categories', heading: 'Categories & Budgets' },
  ];

  await context.setOffline(true);

  for (const route of appRoutes) {
    await page.goto(route.path);
    await expect(page.locator('#root').getByRole('heading', { name: route.heading })).toBeVisible();
    await expect(page.getByRole('heading', { name: "You're Offline" })).toHaveCount(0);
  }

  await context.setOffline(false);
});

test('offline page remains available directly', async ({ page, context }) => {
  await completeOnboarding(page);
  await waitForServiceWorkerReady(page);

  await context.setOffline(true);
  await page.goto('/offline.html');

  await expect(page.getByRole('heading', { name: "You're Offline" })).toBeVisible();
  await expect(page.getByText('Local-first data')).toBeVisible();

  await context.setOffline(false);
});
