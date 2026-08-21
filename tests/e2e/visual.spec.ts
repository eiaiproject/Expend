/**
 * Visual regression tests — pixel-perfect consistency.
 *
 * Run once with --update-snapshots to capture baselines, then rerun to compare.
 *
 *   npx playwright test tests/e2e/visual.spec.ts --update-snapshots
 *   npx playwright test tests/e2e/visual.spec.ts
 *
 * Screenshots live in tests/e2e/__screenshots__/.
 */
import { test, expect, type Page } from '@playwright/test';

// ── Helpers ────────────────────────────────────────────────────────

async function seedRealisticData(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Seed data directly into IndexedDB via raw API (works in production build).
  await page.evaluate(async () => {
    const openDB = (): Promise<IDBDatabase> =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open('ExpendDB');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    const db = await openDB();

    const clearStore = (name: string) => new Promise<void>((resolve, reject) => {
      const tx = db.transaction(name, 'readwrite');
      tx.objectStore(name).clear().onsuccess = () => tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    const addStore = (name: string, data: any) => new Promise<number>((resolve, reject) => {
      const tx = db.transaction(name, 'readwrite');
      const req = tx.objectStore(name).add(data);
      req.onsuccess = () => resolve(req.result as number);
      tx.onerror = () => reject(tx.error);
    });
    const putStore = (name: string, data: any) => new Promise<void>((resolve, reject) => {
      const tx = db.transaction(name, 'readwrite');
      tx.objectStore(name).put(data).onsuccess = () => tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Clear existing data.
    for (const s of ['transactions', 'wallets', 'categories', 'debts', 'debtPayments', 'schedules', 'settings']) {
      await clearStore(s);
    }

    const now = Date.now();
    const day = 86_400_000;

    // Wallets.
    const bcaId = await addStore('wallets', {
      name: 'BCA', currency: 'IDR', initialBalance: 5_000_000,
      currentBalance: 5_000_000, lastUpdated: new Date().toISOString(), icon: 'credit-card', color: '#3B82F6',
    });
    const gopayId = await addStore('wallets', {
      name: 'GoPay', currency: 'IDR', initialBalance: 1_000_000,
      currentBalance: 1_000_000, lastUpdated: new Date().toISOString(), icon: 'smartphone', color: '#22C55E',
    });
    const cashId = await addStore('wallets', {
      name: 'Cash', currency: 'IDR', initialBalance: 500_000,
      currentBalance: 500_000, lastUpdated: new Date().toISOString(), icon: 'banknote', color: '#F97316',
    });

    // Categories.
    const catFood = await addStore('categories', { name: 'Makanan & Minuman', icon: 'utensils', color: '#EF4444' });
    const catTransport = await addStore('categories', { name: 'Transportasi', icon: 'car', color: '#F97316' });
    const catShopping = await addStore('categories', { name: 'Belanja', icon: 'shopping-bag', color: '#EAB308' });
    const catBills = await addStore('categories', { name: 'Tagihan', icon: 'receipt', color: '#06B6D4' });
    const catHealth = await addStore('categories', { name: 'Kesehatan', icon: 'heart-pulse', color: '#22C55E' });
    const catFun = await addStore('categories', { name: 'Hiburan', icon: 'gamepad-2', color: '#A855F7' });
    const catOther = await addStore('categories', { name: 'Lainnya', icon: 'layers', color: '#64748B' });

    const wallets = [bcaId, gopayId, cashId];
    const cats = [catFood, catFood, catFood, catTransport, catShopping, catBills, catHealth, catFun, catOther];
    const payees = ['Warung Bu Tini', 'Kopi Kenangan', 'GoFood', 'Gojek', 'Grab', 'Tokopedia', 'Alfamart', 'Indomaret', 'Cinema XXI', 'Apotek K-24'];
    const amounts = [25000, 35000, 15000, 50000, 12000, 85000, 150000, 42000, 75000, 28000, 65000, 18000];

    // 60 transactions over last 30 days.
    for (let i = 0; i < 60; i++) {
      const daysAgo = Math.floor(i / 2);
      const d = new Date(now - daysAgo * day + Math.random() * day);
      const ds = d.toISOString().slice(0, 10);
      const ts = `${String(8 + Math.floor(Math.random() * 12)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`;
      await addStore('transactions', {
        type: 'expense', amount: amounts[i % amounts.length], description: payees[i % payees.length],
        date: `${ds}T${ts}`, walletId: wallets[i % wallets.length], categoryId: cats[i % cats.length],
        notes: '',
      });
    }

    // Transfer pair.
    const tgId = 'tg-viz-1';
    await addStore('transactions', {
      type: 'transfer_out', amount: 200_000, description: 'Topup GoPay',
      date: new Date(now - day * 2).toISOString().slice(0, 10) + 'T10:00',
      walletId: bcaId, categoryId: null, notes: '', transferGroupId: tgId,
    });
    await addStore('transactions', {
      type: 'transfer_in', amount: 200_000, description: 'Topup GoPay',
      date: new Date(now - day * 2).toISOString().slice(0, 10) + 'T10:00',
      walletId: gopayId, categoryId: null, notes: '', transferGroupId: tgId,
    });

    // Debt.
    await addStore('debts', {
      id: 'debt-budi-1',
      personName: 'Budi', type: 'payable', principalAmount: 500_000, remainingAmount: 500_000,
      walletId: bcaId, status: 'active',
      startDate: new Date(now - day * 10).toISOString().slice(0, 10),
      notes: 'Pinjam Budi', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });

    // Templates — stored in settings table.
    const now2 = new Date().toISOString();
    const templates = [
      { id: 'tpl-kopi', name: 'Kopi', amount: 25000, categoryId: catFood, walletId: gopayId, description: 'Kopi Kenangan', notes: '', createdAt: now2 },
      { id: 'tpl-gojek', name: 'Gojek', amount: 15000, categoryId: catTransport, walletId: gopayId, description: 'Gojek', notes: '', createdAt: now2 },
    ];
    await putStore('settings', { key: 'transactionTemplates', value: templates });

    // Settings — mark onboarding done.
    await putStore('settings', { key: 'onboardingCompleted', value: true });
    await putStore('settings', { key: 'lastSelectedWalletId', value: bcaId });

    db.close();
  });

  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
}

async function dismissOverlays(page: Page): Promise<void> {
  // Dismiss any dialogs/toasts/prompts that might obscure screenshots.
  const dialogs = page.locator('dialog[open]');
  const count = await dialogs.count();
  for (let i = 0; i < count; i++) {
    const closeBtn = dialogs.nth(i).getByRole('button', { name: /close|dismiss|skip|maybe later|not now/i });
    if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    }
  }
}

// ── Tests ──────────────────────────────────────────────────────────

test.describe('Visual consistency — pixel perfect', () => {
  test.beforeEach(async ({ page }) => {
    await seedRealisticData(page);
    await dismissOverlays(page);
  });

  test('home — full page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await dismissOverlays(page);
    await expect(page).toHaveScreenshot('home-full.png', { fullPage: true, maxDiffPixelRatio: 0.01 });
  });

  test('home — viewport mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await dismissOverlays(page);
    await expect(page).toHaveScreenshot('home-viewport.png', { maxDiffPixelRatio: 0.01 });
  });

  test('wallets — list', async ({ page }) => {
    await page.goto('/wallets');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await dismissOverlays(page);
    await expect(page).toHaveScreenshot('wallets-list.png', { fullPage: true, maxDiffPixelRatio: 0.01 });
  });

  test('debts — list', async ({ page }) => {
    await page.goto('/debts');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await dismissOverlays(page);
    await expect(page).toHaveScreenshot('debts-list.png', { fullPage: true, maxDiffPixelRatio: 0.01 });
  });

  test('stats — charts', async ({ page }) => {
    await page.goto('/stats');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await dismissOverlays(page);
    await expect(page).toHaveScreenshot('stats-charts.png', { fullPage: true, maxDiffPixelRatio: 0.01 });
  });

  test('settings — sections', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await dismissOverlays(page);
    await expect(page).toHaveScreenshot('settings-sections.png', { fullPage: true, maxDiffPixelRatio: 0.01 });
  });

  test('categories — list', async ({ page }) => {
    await page.goto('/categories');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await dismissOverlays(page);
    await expect(page).toHaveScreenshot('categories-list.png', { fullPage: true, maxDiffPixelRatio: 0.01 });
  });

  test('payees — list', async ({ page }) => {
    await page.goto('/payees');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await dismissOverlays(page);
    await expect(page).toHaveScreenshot('payees-list.png', { fullPage: true, maxDiffPixelRatio: 0.01 });
  });

  test('schedules — list', async ({ page }) => {
    await page.goto('/schedules');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await dismissOverlays(page);
    await expect(page).toHaveScreenshot('schedules-list.png', { fullPage: true, maxDiffPixelRatio: 0.01 });
  });

  test('quick-add — open form', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await dismissOverlays(page);
    // Open the action picker and click Add Expense.
    await page.getByRole('button', { name: /add|new|create/i }).first().click();
    await page.waitForTimeout(300);
    const addBtn = page.getByRole('button', { name: /add expense|expense/i });
    if (await addBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(500);
    }
    await expect(page).toHaveScreenshot('quick-add-form.png', { maxDiffPixelRatio: 0.01 });
  });

  test('home — dark mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await dismissOverlays(page);
    // Toggle dark mode via settings.
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    const themeToggle = page.getByRole('button', { name: /dark|theme|mode/i });
    if (await themeToggle.isVisible({ timeout: 1000 }).catch(() => false)) {
      await themeToggle.click();
      await page.waitForTimeout(300);
    }
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await dismissOverlays(page);
    await expect(page).toHaveScreenshot('home-dark-mode.png', { fullPage: true, maxDiffPixelRatio: 0.01 });
  });

  test('landing — first visit', async ({ page }) => {
    // Fresh visit without onboarding completed.
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    // If redirected to onboarding, screenshot that instead.
    const url = page.url();
    if (url.includes('onboarding') || await page.locator('h1:has-text("Welcome")').isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(page).toHaveScreenshot('onboarding-welcome.png', { maxDiffPixelRatio: 0.01 });
    } else {
      await expect(page).toHaveScreenshot('landing-page.png', { maxDiffPixelRatio: 0.01 });
    }
  });

  test('wallets — detail page', async ({ page }) => {
    await page.goto('/wallets');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await dismissOverlays(page);
    // Click first wallet to open detail.
    const walletLink = page.getByRole('link', { name: /BCA|GoPay|Cash/i }).first();
    if (await walletLink.isVisible({ timeout: 1000 }).catch(() => false)) {
      await walletLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      await dismissOverlays(page);
    }
    await expect(page).toHaveScreenshot('wallet-detail.png', { fullPage: true, maxDiffPixelRatio: 0.01 });
  });

  test('more — page', async ({ page }) => {
    await page.goto('/more');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await dismissOverlays(page);
    await expect(page).toHaveScreenshot('more-page.png', { fullPage: true, maxDiffPixelRatio: 0.01 });
  });

  test('404 — not found', async ({ page }) => {
    await page.goto('/nonexistent-page');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await dismissOverlays(page);
    await expect(page).toHaveScreenshot('not-found.png', { maxDiffPixelRatio: 0.01 });
  });

  test('debts — detail page', async ({ page }) => {
    await page.goto('/debts');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await dismissOverlays(page);
    // Click first debt to open detail.
    const debtLink = page.getByRole('button', { name: /Budi|payable|receivable/i }).first();
    if (await debtLink.isVisible({ timeout: 1000 }).catch(() => false)) {
      await debtLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      await dismissOverlays(page);
    }
    await expect(page).toHaveScreenshot('debt-detail.png', { fullPage: true, maxDiffPixelRatio: 0.01 });
  });

  test('payees — detail page', async ({ page }) => {
    await page.goto('/payees');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await dismissOverlays(page);
    // Click first payee to open detail.
    const payeeLink = page.getByRole('button', { name: /Warung|Kopi|Gojek|Grab|Tokopedia/i }).first();
    if (await payeeLink.isVisible({ timeout: 1000 }).catch(() => false)) {
      await payeeLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      await dismissOverlays(page);
    }
    await expect(page).toHaveScreenshot('payee-detail.png', { fullPage: true, maxDiffPixelRatio: 0.01 });
  });

  test('onboarding — welcome step', async ({ page }) => {
    // Clear onboarding flag to see onboarding flow.
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      const openDB = (): Promise<IDBDatabase> =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open('ExpendDB');
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      openDB().then(db => {
        const tx = db.transaction('settings', 'readwrite');
        tx.objectStore('settings').delete('onboardingCompleted');
        tx.oncomplete = () => db.close();
      });
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('onboarding-step1.png', { maxDiffPixelRatio: 0.01 });
  });
});
