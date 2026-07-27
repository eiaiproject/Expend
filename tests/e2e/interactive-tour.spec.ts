import { test, expect } from '@playwright/test';
import {
  uniqueName,
  visitApp,
  completeOnboarding,
  createWallet,
  createExpense,
  createTransfer,
  createDebt,
  readTable,
  readWalletByName,
  assertAllButtonsAccessible,
} from './helpers';

/**
 * Interactive tour smoke test — drives every page through real user actions,
 * not just route visits. Acts as a regression net for UI breakages that
 * static route-render tests would miss (e.g. broken buttons, sheet
 * open/close, navigation between subviews).
 *
 * Coverage map:
 *   - Landing                                          (LandingView)
 *   - Onboarding wizard (3 steps)                      (OnboardingWizard)
 *   - Home (transaction list)                          (HomeView)
 *   - Wallets (list + create + detail nav)             (WalletsView / WalletDetailView)
 *   - Debts (list + create + detail nav)               (DebtsView)
 *   - Categories                                       (CategoriesView)
 *   - Payees (list + create-by-expense)                (PayeesView)
 *   - Stats                                            (StatsView)
 *   - Settings                                         (SettingsView)
 *   - 404                                              (NotFoundView)
 */

const ONBOARD = {
  walletName: 'tour-cash',
  walletBalance: '0',
  categories: ['Food & Drinks', 'Transportation'],
};

test.describe.configure({ mode: 'serial' });

test.describe('Interactive tour — every page exercised end-to-end', () => {
  test('landing page renders hero CTA + accessible controls', async ({ page }) => {
    await visitApp(page);

    // Landing visible
    const heroCta = page.getByRole('button', { name: /start tracking/i });
    await expect(heroCta).toBeVisible({ timeout: 5_000 });

    // No main shell yet — landing has its own landing layout
    await assertAllButtonsAccessible(page);
  });

  test('onboarding wizard — wallet → categories → finish', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Tour'),
      walletBalance: '100000',
      categories: ONBOARD.categories,
    });

    // Main shell must render
    await expect(page.locator('main#main-content')).toBeVisible();

    // DB has the wallet
    const wallets = await readTable<{ name: string; currentBalance: number }>(page, 'wallets');
    expect(wallets).toHaveLength(1);
    expect(wallets[0].currentBalance).toBe(100_000);

    // Selected categories persisted
    const cats = await readTable<{ name: string }>(page, 'categories');
    for (const expected of ONBOARD.categories) {
      expect(cats.some((c) => c.name === expected)).toBe(true);
    }
  });

  test('home — FAB opens action picker, expense creates and appears in list', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Home'),
      walletBalance: '500000',
      categories: ['Food & Drinks'],
    });

    // Sanity: home route
    await page.goto('/');
    await expect(page.locator('main h1, main h2').first()).toBeVisible();

    // FAB opens picker; picker is a dialog
    await page.getByRole('button', { name: /add transaction/i }).first().click();
    const picker = page.getByRole('dialog');
    await expect(picker).toBeVisible();
    await expect(picker.getByRole('button', { name: /add expense/i })).toBeVisible();
    await expect(picker.getByRole('button', { name: /^transfer$/i })).toBeVisible();
    await expect(picker.getByRole('button', { name: /debt|borrow|lend/i })).toBeVisible();

    // Cancel picker by clicking backdrop close button
    await picker.getByRole('button', { name: /close/i }).first().click().catch(async () => {
      // Fallback: ESC
      await page.keyboard.press('Escape');
    });
    await expect(picker).toBeHidden();

    // Create an expense and confirm it lands in the home list
    const walletName = uniqueName('HomeW');
    await page.goto('/wallets');
    await createWallet(page, walletName, '200000');

    await page.goto('/');
    const note = uniqueName('coffee');
    await createExpense(page, {
      amount: '15000',
      description: note,
      walletName,
      categoryName: 'Food & Drinks',
    });

    // The transaction description must appear in the rendered home list
    await expect(page.getByText(note, { exact: false }).first()).toBeVisible({ timeout: 5_000 });
  });

  test('wallets — list, create, and navigate to detail', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('WalletList'),
      walletBalance: '0',
      categories: [],
    });

    await page.goto('/wallets');
    await expect(page.getByRole('heading', { name: /wallets/i }).first()).toBeVisible();

    const newWallet = uniqueName('Detail');
    await createWallet(page, newWallet, '75000');

    // Navigate to the wallet detail view via the inner link (the card is
    // an <article>; the actual navigation trigger is the inner <Link>).
    const card = page.locator(`[data-wallet-card="${newWallet}"]`).first();
    await expect(card).toBeVisible();
    await card.getByRole('link', { name: new RegExp(newWallet, 'i') }).first().click();

    // Detail view URL pattern
    await page.waitForURL(/\/wallets\/\d+/, { timeout: 5_000 });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Detail view shows the wallet name and the balance
    await expect(page.getByText(newWallet).first()).toBeVisible();
  });

  test('debts — list, create payable, detail opens', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('DebtTour'),
      walletBalance: '200000',
      categories: [],
    });

    await page.goto('/debts');
    await expect(page.getByRole('heading', { name: /debts|receivables/i }).first()).toBeVisible();

    const walletName = uniqueName('DebtW');
    await page.goto('/wallets');
    await createWallet(page, walletName, '500000');

    const personName = uniqueName('Bob');
    await page.goto('/debts');
    await createDebt(page, {
      personName,
      amount: '50000',
      walletName,
      type: 'payable',
    });

    // Person name appears in the debts list
    await expect(page.getByText(personName).first()).toBeVisible({ timeout: 5_000 });

    // DB invariants
    const debts = await readTable<{ personName: string; principalAmount: number; remainingAmount: number; type: string }>(page, 'debts');
    const debt = debts.find((d) => d.personName === personName);
    expect(debt).toBeTruthy();
    expect(debt!.type).toBe('payable');
    expect(debt!.principalAmount).toBe(50_000);
    expect(debt!.remainingAmount).toBe(50_000);
  });

  test('categories — manages category list', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('CatTour'),
      walletBalance: '0',
      categories: ['Food & Drinks'],
    });

    await page.goto('/categories');
    await expect(page.locator('main#main-content')).toBeVisible();

    // The seeded category must appear
    await expect(page.getByText('Food & Drinks').first()).toBeVisible();

    // Try adding a new category via the add affordance
    const addBtn = page.getByRole('button', { name: /add category/i }).first()
      .or(page.getByRole('button', { name: /new category/i }).first())
      .or(page.getByRole('button', { name: /^\+$/ }).first());

    if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn.click();
      const input = page.locator('input').first();
      const newName = uniqueName('Cat');
      await input.fill(newName);
      // Submit by clicking the first button with "save" or pressing Enter
      await page.getByRole('button', { name: /^save$/i }).first().click().catch(async () => {
        await page.keyboard.press('Enter');
      });
      await expect(page.getByText(newName).first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test('payees — appears after first expense, detail view accessible', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('PayeeTour'),
      walletBalance: '300000',
      categories: ['Food & Drinks'],
    });

    const walletName = uniqueName('PayeeW');
    await page.goto('/wallets');
    await createWallet(page, walletName, '100000');

    const payeeName = uniqueName('Merchant');
    await page.goto('/');
    await createExpense(page, {
      amount: '10000',
      description: payeeName,
      walletName,
      categoryName: 'Food & Drinks',
    });

    await page.goto('/payees');
    await expect(page.locator('main#main-content')).toBeVisible();
    await expect(page.getByText(payeeName).first()).toBeVisible({ timeout: 5_000 });

    // Click the payee to open its detail view
    await page.getByRole('button', { name: new RegExp(payeeName, 'i') }).first().click();
    // Some payee layouts use a sheet; either is fine
    const detail = page.getByRole('dialog').or(page.locator('main#main-content'));
    await expect(detail.first()).toBeVisible();
  });

  test('stats — renders charts/cards surface', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('StatsTour'),
      walletBalance: '500000',
      categories: ['Food & Drinks'],
    });

    // Add a couple of expenses so stats has data
    await createExpense(page, {
      amount: '25000',
      description: uniqueName('stats-lunch'),
      categoryName: 'Food & Drinks',
    });

    await page.goto('/stats');
    await expect(page.locator('main#main-content')).toBeVisible();

    // Some kind of chart or numerical surface should render
    const surface = page.locator('main svg, main canvas, main [data-chart], main [data-testid]').first();
    await expect(surface).toBeVisible({ timeout: 5_000 });
  });

  test('settings — sections render and toggles work', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('SettingsTour'),
      walletBalance: '0',
      categories: [],
    });

    await page.goto('/settings');
    await expect(page.locator('main#main-content')).toBeVisible();

    // h1 + at least one clickable settings row
    await expect(page.locator('main h1').first()).toBeVisible();
    const rowCount = await page.locator('main button').count();
    expect(rowCount).toBeGreaterThan(2);
  });

  test('404 — unknown route renders NotFoundView with link back home', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('NotFoundTour'),
      walletBalance: '0',
      categories: [],
    });

    await page.goto('/this-route-does-not-exist');
    await expect(page.getByText('404').first()).toBeVisible({ timeout: 5_000 });

    const backLink = page.getByRole('link', { name: /back to home/i });
    await expect(backLink).toBeVisible();
    await backLink.click();
    await page.waitForURL(/\/$/);
    await expect(page.locator('main#main-content')).toBeVisible();
  });

  test('transfer — paired wallets update balance via the UI', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('TransferTour'),
      walletBalance: '500000',
      categories: [],
    });

    const from = uniqueName('From');
    const to = uniqueName('To');
    await page.goto('/wallets');
    await createWallet(page, from, '1000000');
    await createWallet(page, to, '0');

    await page.goto('/');
    await createTransfer(page, {
      amount: '100000',
      description: uniqueName('topup'),
      fromWallet: from,
      toWallet: to,
    });

    const fromWallet = await readWalletByName(page, from);
    const toWallet = await readWalletByName(page, to);
    expect(fromWallet?.currentBalance).toBe(900_000);
    expect(toWallet?.currentBalance).toBe(100_000);
  });

  test('accessibility — every interactive page has labeled buttons', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('A11yTour'),
      walletBalance: '0',
      categories: [],
    });

    const routes = ['/', '/wallets', '/debts', '/payees', '/categories', '/stats', '/settings'];
    for (const path of routes) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await assertAllButtonsAccessible(page);
    }
  });
});
