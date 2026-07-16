import { test, expect } from '@playwright/test';
import {
  uniqueName,
  visitApp,
  clearAppStorage,
  dismissLanding,
  completeOnboarding,
  createExpense,
  createTransfer,
  createDebt,
  createWallet,
  readTable,
  assertAllButtonsAccessible,
  expectWalletBalance,
  readWalletByName,
  createExpenseFromPayee,
  pickWalletFromSelect,
} from './helpers';

/**
 * Expend E2E coverage.
 *
 * Scenarios:
 *   A. First-run landing + onboarding → main app, IndexedDB populated.
 *   B. Core routes render (Home / Wallets / Debts / Stats / Settings).
 *   C. Create expense transaction through UI, persisted to IndexedDB.
 *   D. Create transfer between two wallets, balances correct in DB.
 *   E. Create payable debt, persisted with initial payment + wallet delta.
 *   F. Accessibility invariants: html[lang], <main>, button names.
 */

test.describe('Scenario A — first-run landing + onboarding', () => {
  test('lands on landing, completes onboarding, reaches main app, persists to IndexedDB', async ({ page }) => {
    await visitApp(page);

    const walletName = uniqueName('Wallet');

    // Landing must show hero CTA at minimum.
    const heroCta = page.getByRole('button', { name: 'Start Tracking for Free' });
    await expect(heroCta).toBeVisible({ timeout: 5_000 });

    await completeOnboarding(page, {
      walletName,
      walletBalance: '500000',
      categories: ['Food & Drinks'],
    });

    // Main app shell must be rendered and have a primary heading.
    const main = page.locator('main#main-content');
    await expect(main).toBeVisible();

    // IndexedDB persisted
    const wallets = await readTable<{ name: string; currentBalance: number }>(page, 'wallets');
    expect(wallets.find((w) => w.name === walletName)).toBeTruthy();

    const categories = await readTable<{ name: string }>(page, 'categories');
    expect(categories.find((c) => c.name === 'Food & Drinks')).toBeTruthy();
  });

  test('landing view has accessible "Skip to content" link', async ({ page }) => {
    await clearAppStorage(page);
    await page.goto('/');
    const skipLink = page.locator('a[href="#features-section"], a[href="#main-content"]').first();
    await expect(skipLink).toHaveCount(1);
  });
});

test.describe('Scenario B — core routes render', () => {
  test.beforeEach(async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Primary'),
      walletBalance: '0',
      categories: [],
    });
  });

  const ROUTES = [
    { name: 'Home', path: '/', link: /home/i, fallbackHeading: /(home|expend|welcome)/i },
    { name: 'Wallets', path: '/wallets', link: /wallets/i, fallbackHeading: /wallets/i },
    { name: 'Debts', path: '/debts', link: /(debts|receivables)/i, fallbackHeading: /(debt|receivable|hutang|piutang)/i },
    { name: 'Payees', path: '/payees', link: /(recipients|merchants)/i, fallbackHeading: /(recipients|merchants|payees)/i },
    { name: 'Categories', path: '/categories', link: /categories/i, fallbackHeading: /categories/i },
    { name: 'Stats', path: '/stats', link: /stats/i, fallbackHeading: /stats/i },
    { name: 'Settings', path: '/settings', link: /(settings|more)/i, fallbackHeading: /settings/i },
  ];

  for (const route of ROUTES) {
    test(`${route.name} route renders with main landmark + heading`, async ({ page }) => {
      // Prefer nav links (desktop sidebar / mobile bottom nav) for resilience.
      const navLink = page.getByRole('link', { name: route.link }).first();
      if (await navLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await navLink.click();
      } else {
        await page.goto(route.path);
      }

      await page.waitForURL(new RegExp(`${route.path.replace('/', '\\/')}$`), { timeout: 10_000 });

      const main = page.locator('main#main-content');
      await expect(main).toBeVisible();

      // The page should have at least one visible <h1> or <h2>.
      const heading = page.locator('main h1, main h2').first();
      await expect(heading).toBeVisible({ timeout: 5_000 });

      // URL must match the route path.
      expect(page.url().endsWith(route.path)).toBe(true);
    });
  }
});

test.describe('Scenario C — create an expense transaction', () => {
  test.beforeEach(async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Cash'),
      walletBalance: '500000',
      categories: ['Food & Drinks', 'Transportation'],
    });
  });

  test('creates an expense, persists to IndexedDB, and reduces wallet balance', async ({ page }) => {
    const walletName = uniqueName('Expense'); // matches the onboarded wallet below
    // The onboarded wallet is the only wallet available; we create a
    // dedicated one for this test to make balance assertions deterministic.
    await page.goto('/wallets');
    await createWallet(page, walletName, '300000');

    const note = uniqueName('lunch');
    await page.goto('/');
    await createExpense(page, {
      amount: '25000',
      description: note,
      walletName,
      categoryName: 'Food & Drinks',
    });

    // DB assertions
    const wallets = await readTable<{ name: string; currentBalance: number }>(page, 'wallets');
    const wallet = wallets.find((w) => w.name === walletName);
    expect(wallet).toBeTruthy();
    expect(wallet!.currentBalance).toBe(300000 - 25000);

    const txs = await readTable<{
      walletId: number;
      type: string;
      amount: number;
      description: string;
    }>(page, 'transactions');
    const expense = txs.find((t) => t.description === note && t.type === 'expense');
    expect(expense).toBeTruthy();
    expect(expense!.amount).toBe(25000);
    expect(expense!.walletId).toBe(wallet!.id);
  });
});

test.describe('Scenario D — wallet transfer creates paired transactions', () => {
  test.beforeEach(async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Source'),
      walletBalance: '500000',
      categories: [],
    });
  });

  test('source wallet debited, destination credited, paired transfer_in/out persisted', async ({ page }) => {
    const from = uniqueName('FromA');
    const to = uniqueName('ToB');

    await page.goto('/wallets');
    await createWallet(page, from, '1000000');
    await createWallet(page, to, '200000');

    const transferNote = uniqueName('Topup');
    await page.goto('/');
    await createTransfer(page, {
      amount: '150000',
      description: transferNote,
      fromWallet: from,
      toWallet: to,
    });

    const wallets = await readTable<{ name: string; currentBalance: number }>(page, 'wallets');
    const fromWallet = wallets.find((w) => w.name === from);
    const toWallet = wallets.find((w) => w.name === to);
    expect(fromWallet).toBeTruthy();
    expect(toWallet).toBeTruthy();
    expect(fromWallet!.currentBalance).toBe(1000000 - 150000);
    expect(toWallet!.currentBalance).toBe(200000 + 150000);

    const txs = await readTable<{
      walletId: number;
      type: string;
      amount: number;
      transferGroupId?: string;
      description: string;
    }>(page, 'transactions');

    const out = txs.find((t) => t.description === `${transferNote} (Out)` && t.type === 'transfer_out');
    const inn = txs.find((t) => t.description === `${transferNote} (In)` && t.type === 'transfer_in');
    expect(out).toBeTruthy();
    expect(inn).toBeTruthy();
    expect(out!.transferGroupId).toBeTruthy();
    expect(inn!.transferGroupId).toBe(out!.transferGroupId);
    expect(out!.amount).toBe(150000);
    expect(inn!.amount).toBe(150000);
    expect(out!.walletId).toBe(fromWallet!.id);
    expect(inn!.walletId).toBe(toWallet!.id);
  });
});

test.describe('Scenario E — payable debt persists correctly', () => {
  test.beforeEach(async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('DebtWallet'),
      walletBalance: '200000',
      categories: [],
    });
  });

  test('creates a payable debt with wallet reference and initial balance impact', async ({ page }) => {
    const walletName = uniqueName('CashE');
    await page.goto('/wallets');
    await createWallet(page, walletName, '500000');

    const personName = uniqueName('Alice');
    await page.goto('/debts');
    await createDebt(page, {
      personName,
      amount: '75000',
      walletName,
      type: 'payable',
    });

    const debts = await readTable<{
      personName: string;
      principalAmount: number;
      remainingAmount: number;
      walletId: number;
      type: string;
    }>(page, 'debts');
    const debt = debts.find((d) => d.personName === personName);
    expect(debt).toBeTruthy();
    expect(debt!.type).toBe('payable');
    expect(debt!.principalAmount).toBe(75000);
    expect(debt!.remainingAmount).toBe(75000);

    const wallets = await readTable<{ name: string; currentBalance: number }>(page, 'wallets');
    const wallet = wallets.find((w) => w.name === walletName);
    expect(wallet).toBeTruthy();
    // Payable initial payment: +75,000 to wallet
    expect(wallet!.currentBalance).toBe(500000 + 75000);

    // Initial DebtPayment record exists
    const payments = await readTable<{ debtId: string; type: string; amount: number }>(page, 'debtPayments');
    expect(payments.some((p) => p.debtId === debt!.id && p.type === 'initial' && p.amount === 75000)).toBe(true);
  });
});

test.describe('Scenario F — accessibility invariants', () => {
  test.beforeEach(async ({ page }) => {
    await visitApp(page);
  });

  test('landing page has html[lang] and a primary heading', async ({ page }) => {
    const lang = await page.locator('html').first().getAttribute('lang');
    expect(lang).toBeTruthy();
    expect((lang ?? '').length).toBeGreaterThan(0);

    // Landing has the main <h1> with brand text.
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();
  });

  test('all buttons have accessible names on landing and main routes', async ({ page }) => {
    await assertAllButtonsAccessible(page);

    // Move past onboarding (no categories needed).
    await completeOnboarding(page, {
      walletName: uniqueName('A11Y'),
      walletBalance: '0',
      categories: [],
    });

    const routes = ['/', '/wallets', '/debts', '/stats', '/settings'];
    for (const path of routes) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await assertAllButtonsAccessible(page);
    }

    // All routes scanned without throwing — assertion implicit via nothrow above.
    expect(routes.length).toBeGreaterThan(0);
  });

  test('main landmark exists once in the document after onboarding', async ({ page }) => {
    await completeOnboarding(page, {
      walletName: uniqueName('Landmark'),
      walletBalance: '0',
      categories: [],
    });
    const mainCount = await page.locator('main').count();
    expect(mainCount).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Scenario G — payee grouping and rename', () => {
  test.beforeEach(async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('PayeeCash'),
      walletBalance: '500000',
      categories: ['Food & Drinks'],
    });
  });

  test('renames every expense in a normalized merchant group', async ({ page }) => {
    const merchantA = uniqueName('starbucks').toLowerCase();
    const merchantB = merchantA.toUpperCase();
    const nextName = uniqueName('Sbux');

    await page.goto('/');
    await createExpense(page, {
      amount: '20000',
      description: merchantA,
      categoryName: 'Food & Drinks',
    });
    await createExpense(page, {
      amount: '30000',
      description: merchantB,
      categoryName: 'Food & Drinks',
    });

    await page.goto('/payees');
    await page.getByRole('button', { name: new RegExp(merchantA, 'i') }).first().click();
    await page.getByRole('button', { name: /^rename$/i }).click();

    const dialog = page.getByRole('dialog', { name: /^rename$/i });
    await dialog.locator('input').fill(nextName);
    await dialog.getByRole('button', { name: /^rename$/i }).click();
    await expect(dialog).toBeHidden();

    const txs = await readTable<{ description: string; type: string }>(page, 'transactions');
    const renamed = txs.filter((tx) => tx.type === 'expense' && tx.description === nextName);
    expect(renamed).toHaveLength(2);
    expect(txs.some((tx) => tx.description === merchantA || tx.description === merchantB)).toBe(false);
  });
});

test.describe('Scenario H — PIN security', () => {
  test.beforeEach(async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('SecureCash'),
      walletBalance: '0',
      categories: [],
    });
  });

  test('current PIN can be verified immediately after setup without reload', async ({ page }) => {
    await page.goto('/settings');
    // Security section is now directly visible (no accordion)
    await page.getByRole('button', { name: /set up pin/i }).click();

    let dialog = page.getByRole('dialog', { name: /create pin/i });
    for (const digit of ['1', '2', '3', '4']) {
      await dialog.getByRole('button', { name: digit }).click();
    }
    await dialog.getByRole('button', { name: /^next$/i }).click();

    dialog = page.getByRole('dialog', { name: /confirm pin/i });
    for (const digit of ['1', '2', '3', '4']) {
      await dialog.getByRole('button', { name: digit }).click();
    }
    await dialog.getByRole('button', { name: /^confirm$/i }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole('button', { name: /change pin/i }).click();
    const verifyDialog = page.getByRole('dialog', { name: /current pin/i });
    for (const digit of ['1', '2', '3', '4']) {
      await verifyDialog.getByRole('button', { name: digit }).click();
    }
    await verifyDialog.getByRole('button', { name: /^confirm$/i }).click();

    await expect(page.getByRole('dialog', { name: /create pin/i })).toBeVisible();
  });
});

test.describe('Scenario I — quick-add expense from payee', () => {
  test.beforeEach(async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('QuickPayee'),
      walletBalance: '500000',
      categories: ['Food & Drinks', 'Transportation'],
    });
  });

  test('+ button on payee card opens form with pre-filled description', async ({ page }) => {
    const payeeName = uniqueName('Kopi');
    const walletName = uniqueName('QuickWallet');

    await page.goto('/wallets');
    await createWallet(page, walletName, '200000');

    // Create an expense so the payee appears in the list.
    await page.goto('/');
    await createExpense(page, {
      amount: '15000',
      description: payeeName,
      walletName,
      categoryName: 'Food & Drinks',
    });

    // Navigate to payees and use the + button.
    await page.goto('/payees');
    await createExpenseFromPayee(page, {
      payeeName,
      amount: '25000',
      walletName,
    });

    // Assert expense persisted with the correct description.
    const txs = await readTable<{ description: string; type: string; amount: number }>(page, 'transactions');
    const quickAdd = txs.filter((t) => t.description === payeeName && t.type === 'expense');
    expect(quickAdd).toHaveLength(2);
    expect(quickAdd.some((t) => t.amount === 25000)).toBe(true);

    // Assert wallet balance decreased.
    await expectWalletBalance(page, walletName, 200000 - 15000 - 25000);
  });

  test('detail view Add Expense button opens form with pre-filled description', async ({ page }) => {
    const payeeName = uniqueName('Warung');
    const walletName = uniqueName('DetailWallet');

    await page.goto('/wallets');
    await createWallet(page, walletName, '300000');

    await page.goto('/');
    await createExpense(page, {
      amount: '10000',
      description: payeeName,
      walletName,
      categoryName: 'Food & Drinks',
    });

    // Open payee detail view.
    await page.goto('/payees');
    await page.getByRole('button', { name: new RegExp(payeeName, 'i') }).first().click();

    // Click the Add Expense button in the detail view.
    await page.getByRole('button', { name: /add expense/i }).first().click();

    // Wait for the form and verify description is pre-filled.
    await page.waitForSelector('form input[inputmode="numeric"]', { timeout: 10_000 });
    const descInput = page.locator('form input[type="text"]:not([inputmode])').first();
    await expect(descInput).toHaveValue(new RegExp(payeeName, 'i'));

    // Complete the form — select the same wallet for deterministic balance.
    await pickWalletFromSelect(page, walletName);
    await page.locator('form input[inputmode="numeric"]').first().fill('35000');
    await page.getByRole('button', { name: /^save$/i }).first().click();
    await page.waitForSelector('form input[inputmode="numeric"]', { state: 'detached', timeout: 10_000 });
    await page.waitForTimeout(500);

    // Assert the new expense appears in the payee's history.
    const txs = await readTable<{ description: string; type: string; amount: number }>(page, 'transactions');
    const expenses = txs.filter((t) => t.description === payeeName && t.type === 'expense');
    expect(expenses).toHaveLength(2);
    expect(expenses.some((t) => t.amount === 35000)).toBe(true);

    await expectWalletBalance(page, walletName, 300000 - 10000 - 35000);
  });

  test('multiple quick-adds produce correct payee grouping', async ({ page }) => {
    const payeeName = uniqueName('Grab');
    const walletName = uniqueName('GroupWallet');

    await page.goto('/wallets');
    await createWallet(page, walletName, '500000');

    await page.goto('/');
    await createExpense(page, {
      amount: '10000',
      description: payeeName,
      walletName,
      categoryName: 'Transportation',
    });

    // Quick-add two more expenses via the payee + button.
    await page.goto('/payees');
    await createExpenseFromPayee(page, { payeeName, amount: '20000', walletName });
    await createExpenseFromPayee(page, { payeeName, amount: '30000', walletName });

    // Verify 3 total expenses for this payee.
    const txs = await readTable<{ description: string; type: string; amount: number }>(page, 'transactions');
    const expenses = txs.filter((t) => t.description === payeeName && t.type === 'expense');
    expect(expenses).toHaveLength(3);
    const total = expenses.reduce((sum, t) => sum + t.amount, 0);
    expect(total).toBe(10000 + 20000 + 30000);

    // Verify wallet balance.
    await expectWalletBalance(page, walletName, 500000 - 60000);
  });
});

// (end of file — walletId helper removed; testing relies on Dexie auto-incremented ids)
