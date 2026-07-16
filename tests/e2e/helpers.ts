/**
 * Playwright E2E helpers for Expend.
 *
 * Goals:
 * - Start every test from a clean slate (localStorage, sessionStorage,
 *   IndexedDB, Cache Storage). IndexedDB is the source of truth, so we
 *   wipe it via a page-side script that runs before app bootstrap.
 * - Complete onboarding with a wallet + a category, in a stable way.
 * - Read IndexedDB directly from the page context for assertions.
 * - Generate unique names so parallel browser projects don't collide.
 * - Wrap balance-mutating flows with stable helpers so tests assert
 *   exact numeric state without coupling to UI details.
 *
 * ponytail: no framework deps, no extra Playwright fixture plumbing.
 * Everything exposes plain functions that take a Playwright `Page` or
 * `BrowserContext`. If selectors stabilize further, extract to a PageObject.
 */
import type { Page } from '@playwright/test';

const DB_NAME = 'ExpendDB';

export function uniqueName(prefix: string): string {
  // Worker + random suffix keeps data unique per browser project, per test.
  const wpid = process.pid.toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${wpid}-${rand}`;
}

/**
 * Wipe localStorage, sessionStorage, Cache Storage, and the app's
 * IndexedDB databases (ExpendDB + any legacy stores).
 */
export async function clearAppStorage(page: Page): Promise<void> {
  await page.context().clearCookies();
  // Storage APIs + Cache API need a real page context.
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async ({ dbName }) => {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      /* ignore (private browsing) */
    }
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {
      /* no Cache API */
    }
    try {
      // Delete by name + version sweep — newer IDB engines require version.
      const toDelete: Promise<unknown>[] = [];
      const known = [dbName, `${dbName}_db`];
      for (const name of known) {
        toDelete.push(
          new Promise<void>((resolve) => {
            const req = indexedDB.deleteDatabase(name);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
            req.onblocked = () => resolve();
          }),
        );
      }
      await Promise.all(toDelete);
    } catch {
      /* ignore */
    }
  }, { dbName: DB_NAME });
}

/**
 * Land the app from a clean slate. Returns when the splash is replaced
 * by either the landing view or the onboarding wizard / main app shell.
 */
export async function visitApp(page: Page): Promise<void> {
  await clearAppStorage(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // The Security bootstrap shows a spinner first. Wait for it to clear.
  await page.waitForFunction(() => document.body.innerText.length > 0);
}

/**
 * Read all records from a Dexie table via the live `db` instance the
 * app booted. Returns `[]` if the table is empty or the DB is gone.
 */
export async function readTable<T = unknown>(
  page: Page,
  table: 'wallets' | 'categories' | 'transactions' | 'debts' | 'debtPayments' | 'settings',
): Promise<T[]> {
  return page.evaluate(async ({ table }) => {
    return new Promise<T[]>((resolve) => {
      const request = indexedDB.open('ExpendDB');
      request.onerror = () => resolve([]);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(table)) {
          db.close();
          resolve([]);
          return;
        }
        const tx = db.transaction(table, 'readonly');
        const store = tx.objectStore(table);
        const getAll = store.getAll();
        getAll.onsuccess = () => {
          db.close();
          resolve((getAll.result ?? []) as T[]);
        };
        getAll.onerror = () => {
          db.close();
          resolve([]);
        };
      };
    });
  }, { table });
}

export async function readWalletByName(
  page: Page,
  walletName: string,
): Promise<(Record<string, unknown> & { id?: number; name?: string; currentBalance?: number; initialBalance?: number }) | undefined> {
  return page.evaluate(async ({ walletName }) => {
    return new Promise<(Record<string, unknown> & { id?: number; name?: string; currentBalance?: number; initialBalance?: number }) | undefined>((resolve) => {
      const request = indexedDB.open('ExpendDB');
      request.onerror = () => resolve(undefined);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('wallets')) {
          db.close();
          resolve(undefined);
          return;
        }
        const tx = db.transaction('wallets', 'readonly');
        const req = tx.objectStore('wallets').getAll();
        req.onsuccess = () => {
          db.close();
          const wallets = (req.result ?? []) as Array<Record<string, unknown> & { id?: number; name?: string; currentBalance?: number; initialBalance?: number }>;
          resolve(wallets.find((w) => w.name === walletName));
        };
        req.onerror = () => { db.close(); resolve(undefined); };
      };
    });
  }, { walletName });
}

export async function readTransactions(page: Page): Promise<Array<Record<string, unknown> & { id?: number; description?: string; type?: string; amount?: number; walletId?: number; transferGroupId?: string }>> {
  return readTable(page, 'transactions') as Promise<Array<Record<string, unknown> & { id?: number; description?: string; type?: string; amount?: number; walletId?: number; transferGroupId?: string }>>;
}

export async function readDebts(page: Page): Promise<Array<Record<string, unknown> & { id?: string; personName?: string; type?: string; principalAmount?: number; remainingAmount?: number; walletId?: number; status?: string }>> {
  return readTable(page, 'debts') as Promise<Array<Record<string, unknown> & { id?: string; personName?: string; type?: string; principalAmount?: number; remainingAmount?: number; walletId?: number; status?: string }>>;
}

export async function readDebtPayments(page: Page): Promise<Array<Record<string, unknown> & { id?: string; debtId?: string; type?: string; amount?: number; walletId?: string }>> {
  return readTable(page, 'debtPayments') as Promise<Array<Record<string, unknown> & { id?: string; debtId?: string; type?: string; amount?: number; walletId?: string }>>;
}

/**
 * Assert wallet.currentBalance (DB) equals expected.
 * Accepts a tolerance for currency rounding when needed.
 */
export async function expectWalletBalance(
  page: Page,
  walletName: string,
  expectedAmount: number,
  tolerance = 0,
): Promise<void> {
  const wallet = await readWalletByName(page, walletName);
  if (!wallet) throw new Error(`Wallet not found in DB: ${walletName}`);
  // Use currentBalance first (DB truth). Fall back to initialBalance for
  // freshly-created wallets where currentBalance may not have been set.
  const stored = Number(wallet.currentBalance);
  const actual = Number.isFinite(stored) ? stored : Number(wallet.initialBalance ?? 0);
  if (Math.abs(actual - expectedAmount) > tolerance) {
    throw new Error(
      `Wallet "${walletName}" balance mismatch: expected ${expectedAmount}, got ${actual}. DB row: ${JSON.stringify(wallet)}`,
    );
  }
}

/**
 * Assert the visible UI balance for a wallet matches expected.
 * Looks for the rendered amount inside the wallet card; falls back to
 * scanning the wallets list page for the formatted number.
 */
export async function expectVisibleWalletBalance(
  page: Page,
  walletName: string,
  expectedAmount: number,
): Promise<void> {
  const expected = expectedAmount.toLocaleString('id-ID');
  const card = page.locator(`[data-wallet-card="${walletName}"]`);
  if (await card.count() > 0) {
    await card.first().scrollIntoViewIfNeeded();
    await card.first().getByText(expected).first().waitFor({ state: 'visible', timeout: 5_000 });
    return;
  }
  // Fallback: search for "<wallet name>" near the formatted amount.
  await page.goto('/wallets');
  await page.waitForLoadState('networkidle');
  const card2 = page.locator(`[data-wallet-card="${walletName}"]`);
  await card2.first().getByText(expected).first().waitFor({ state: 'visible', timeout: 5_000 });
}

/**
 * Proceed past the landing page. Clicking "Start Tracking Expenses"
 * enters the onboarding wizard (which is what we want for fresh users).
 * Returns true if landing was found and clicked, false otherwise.
 */
export async function dismissLanding(page: Page): Promise<boolean> {
  const start = page.getByRole('button', { name: /^start tracking/i });
  if (await start.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await start.first().click();
    return true;
  }
  // "Try Without Setup" alternative (sets bypass_pwa).
  const tryWeb = page.getByRole('button', { name: /try without setup/i });
  if (await tryWeb.first().isVisible({ timeout: 1000 }).catch(() => false)) {
    await tryWeb.first().click();
    return true;
  }
  return false;
}

interface OnboardOptions {
  walletName: string;
  walletBalance?: string;
  categories?: string[];
}

/**
 * Walk the onboarding wizard until the main app shell is visible.
 * Creates the initial wallet and (optionally) selects categories.
 */
export async function completeOnboarding(page: Page, options: OnboardOptions): Promise<void> {
  await dismissLanding(page);

  // Wait for wizard step 1 (Welcome to Expend)
  await page.waitForSelector('h1:has-text("Welcome to Expend")', { timeout: 10_000 });

  // ---- Step 1 — wallet name + balance ----
  const nameInput = page.locator('input').first();
  await nameInput.fill(options.walletName);
  if (options.walletBalance) {
    const balanceInput = page.locator('input[inputmode="numeric"]').first();
    await balanceInput.fill(options.walletBalance);
  }
  // The Next button is the only accent-coloured CTA at the bottom.
  const nextBtn = page.locator('button.h-12:has-text("Next")');
  await nextBtn.click();

  // ---- Step 2 — categories (optional) ----
  await page.waitForSelector('h1:has-text("Choose Categories")', { timeout: 10_000 });

  if (options.categories?.length) {
    for (const category of options.categories) {
      // Use exact button name match to avoid hitting footer-related text.
      const catButton = page.getByRole('button', { name: new RegExp(`^${escapeRegex(category)}$`, 'i') });
      await catButton.first().click({ timeout: 5_000 });
    }
  }
  const nextBtn2 = page.locator('button.h-12:has-text("Next")');
  await nextBtn2.click();

  // ---- Step 3 — finish ----
  await page.waitForSelector('h1:has-text("All Set")', { timeout: 10_000 });
  const finish = page.locator('button.h-12').last();
  await finish.click();

  // Wait for the main shell — `<main id="main-content">` is always rendered
  // once onboarding completes.
  await page.waitForSelector('main#main-content', { timeout: 15_000 });
}

/**
 * Create a wallet from the /wallets view (after onboarding or alongside
 * already-existing wallets).
 */
export async function createWallet(
  page: Page,
  name: string,
  balance = '',
): Promise<void> {
  if (!page.url().includes('/wallets')) {
    await page.goto('/wallets');
    await page.waitForLoadState('networkidle');
  }

  await page.getByRole('button', { name: /add wallet/i }).first().click();
  const inputs = page.locator('input');
  await inputs.nth(0).fill(name);
  if (balance) {
    await inputs.nth(1).fill(balance);
  }
  await page.getByRole('button', { name: /^save$/i }).first().click();

  await page.waitForFunction(
    (label) => document.body.innerText.includes(label),
    name,
    { timeout: 5_000 },
  );
}

/**
 * Create an expense transaction through the TransactionFormSheet.
 * Caller must have already onboarded with at least one wallet + category.
 */
export async function createExpense(
  page: Page,
  opts: { amount: string; description: string; walletName?: string; categoryName?: string },
): Promise<void> {
  await openActionPicker(page);
  await clickPickerAction(page, /add expense/i);
  await page.waitForSelector('form input[inputmode="numeric"]', { timeout: 10_000 });

  // Amount input has BOTH `type="text"` and `inputmode="numeric"`; pin to
  // the numeric one to avoid double-matching with the description input.
  await page.locator('form input[inputmode="numeric"]').first().fill(opts.amount);
  // Description: `input[type="text"]:not([inputmode])`.
  await page.locator('form input[type="text"]:not([inputmode])').first().fill(opts.description);

  if (opts.categoryName) {
    const categoryInput = page.locator('form input[placeholder*="category" i], form input[placeholder*="select" i]').first();
    if (await categoryInput.count() > 0) {
      await categoryInput.fill(opts.categoryName);
      await page.waitForTimeout(150);
      await page.keyboard.press('Tab');
    }
  }

  if (opts.walletName) {
    await pickWalletFromSelect(page, opts.walletName);
  }

  await page.getByRole('button', { name: /^save$/i }).first().click();
  await page.waitForSelector('form input[inputmode="numeric"]', { state: 'detached', timeout: 10_000 });
  // ponytail: see createDebt — let the IDB tx flush before caller reads.
  await page.waitForTimeout(500);
}

export async function createTransfer(
  page: Page,
  opts: { amount: string; description: string; fromWallet: string; toWallet: string },
): Promise<void> {
  await openActionPicker(page);
  await clickPickerAction(page, /^transfer$/i);
  await page.waitForSelector('form input[inputmode="numeric"]', { timeout: 10_000 });

  await page.locator('form input[inputmode="numeric"]').first().fill(opts.amount);
  await page.locator('form input[type="text"]:not([inputmode])').first().fill(opts.description);

  await pickTransferWalletFromSelect(page, 0, opts.fromWallet);
  await pickTransferWalletFromSelect(page, 1, opts.toWallet);

  await page.getByRole('button', { name: /^save$/i }).first().click();
  await page.waitForSelector('form input[inputmode="numeric"]', { state: 'detached', timeout: 10_000 });
  // ponytail: see createDebt — let the IDB tx flush before caller reads.
  await page.waitForTimeout(500);
}

/**
 * Create a debt from /debts (the /debts page's own Record Debt button).
 * Uses the DebtFormSheet's two-step flow (type → details).
 */
export async function createDebt(
  page: Page,
  opts: { personName: string; amount: string; walletName: string; type?: 'payable' | 'receivable' },
): Promise<void> {
  if (!page.url().includes('/debts')) {
    await page.goto('/debts');
    await page.waitForLoadState('networkidle');
  }
  await page.getByRole('button', { name: /add debt or receivable/i }).first().click();
  // Wait for the debt-type dialog step (h3 says "I owe someone" per debt.formIOwe).
  await page.waitForSelector('h3:has-text("I owe someone")', { timeout: 10_000 });

  const typeLabel = opts.type === 'receivable' ? /someone owes me/i : /i owe someone/i;
  await page.getByRole('button', { name: typeLabel }).first().click();

  await page.waitForSelector('input[required][type="text"]', { timeout: 10_000 });

  const personInput = page.locator('input[required][type="text"]').first();
  await personInput.fill(opts.personName);

  const amountInput = page.locator('form input[inputmode="numeric"]').first();
  await amountInput.fill(opts.amount);

  // Wallet: pick by label within the open DebtFormSheet
  await pickWalletFromSelect(page, opts.walletName);

  // Submit button text depends on debt type
  const submitLabel = opts.type === 'receivable' ? /save receivable/i : /save payable/i;
  await page.getByRole('button', { name: submitLabel }).first().click();

  // Wait for sheet to close
  await page.waitForFunction(
    () => !document.querySelector('form input[inputmode="numeric"]'),
    undefined,
    { timeout: 10_000 },
  );

  // ponytail: a fresh IDB connection opened from page.evaluate right after
  // the submit click can race with Dexie's transaction commit microtask.
  // Yield to let the wallet update fully settle before the caller reads it.
  await page.waitForTimeout(500);
}

/**
 * Record a debt repayment against a given debt (looked up by person name).
 * Opens the debt detail sheet from /debts, then opens the payment sheet.
 */
export async function recordDebtPayment(
  page: Page,
  opts: { personName: string; amount: string; walletName?: string; quickRatio?: 0.25 | 0.5 | 0.75 | 1 },
): Promise<void> {
  if (!page.url().includes('/debts')) {
    await page.goto('/debts');
    await page.waitForLoadState('networkidle');
  }

  // Locate the debt card by its person name and click it.
  const card = page.locator(`text=${opts.personName}`).first();
  await card.scrollIntoViewIfNeeded();
  await card.click();

  // Wait for the detail sheet to render and click the "Pay debt" /
  // "Receive payment" CTA. This button is inside the detail sheet, NOT
  // a menu, so we can locate it via the dialog itself.
  const detailDialog = page.getByRole('dialog');
  await detailDialog.waitFor({ state: 'visible', timeout: 5_000 });
  const payButton = detailDialog.getByRole('button', { name: /pay debt|receive payment/i }).first();
  await payButton.click();

  // Payment sheet is rendered on top of the detail sheet.
  const paymentDialog = page.getByRole('dialog');
  await paymentDialog.waitFor({ state: 'visible', timeout: 5_000 });

  if (opts.quickRatio !== undefined) {
    const label = opts.quickRatio === 1 ? /pay in full/i : new RegExp(`^${Math.round(opts.quickRatio * 100)}%$`);
    await paymentDialog.getByRole('button', { name: label }).first().click();
  } else {
    await paymentDialog.locator('input[inputmode="numeric"]').first().fill(opts.amount);
  }

  if (opts.walletName) {
    await pickWalletFromSelect(page, opts.walletName);
  }

  // Submit button reuses the sheet title — fall back to role+name match.
  const submitButton = paymentDialog.getByRole('button', { name: /pay debt|receive payment/i }).first();
  await submitButton.click();

  // Wait for payment sheet to close.
  await page.waitForFunction(
    () => document.querySelectorAll('[role="dialog"]').length === 0
      || !document.querySelector('form input[inputmode="numeric"]'),
    undefined,
    { timeout: 10_000 },
  );
}

/**
 * Open the "Update Balance" sheet for a wallet and set an absolute value.
 * The sheet creates a `balance_adjustment` transaction whose signed
 * delta brings the balance to the requested target.
 */
export async function adjustWalletBalance(
  page: Page,
  opts: { walletName: string; newBalance: string },
): Promise<void> {
  if (!page.url().includes('/wallets')) {
    await page.goto('/wallets');
    await page.waitForLoadState('networkidle');
  }
  // Open overflow menu and click Reconcile Balance
  await clickWalletMenuOption(page, opts.walletName, /reconcile balance/i);

  // Wait for the reconcile sheet dialog
  const dialog = page.getByRole('dialog', { name: /reconcile balance/i });
  await dialog.waitFor({ state: 'visible', timeout: 5_000 });

  const numericInput = dialog.locator('input[inputmode="numeric"]').first();
  await numericInput.fill(opts.newBalance);
  await dialog.getByRole('button', { name: /^save$/i }).first().click();

  // Wait for the dialog to close.
  await page.waitForFunction(
    () => !document.querySelector('[role="dialog"][aria-label*="Reconcile"]'),
    undefined,
    { timeout: 10_000 },
  );
  // ponytail: see createDebt — let the IDB tx flush before caller reads.
  await page.waitForTimeout(500);
}

/**
 * Find a transaction by description (exact), open the kebab menu,
 * then click "Delete" in the menu.
 */
export async function deleteTransactionByDescription(
  page: Page,
  description: string,
): Promise<void> {
  const row = page.locator('[data-testid="transaction-row"]').filter({
    has: page.locator(`p`, { hasText: new RegExp(`^\\s*${escapeRegex(description)}\\s*$`) }),
  }).first();
  await row.scrollIntoViewIfNeeded();

  // First try the kebab menu — the cleaner path.
  const kebab = row.getByRole('button', { name: /open transaction actions|transaction actions|actions for/i }).first();
  await kebab.click();
  const menu = page.getByRole('menu');
  await menu.waitFor({ state: 'visible', timeout: 2_000 });
  await menu.getByRole('menuitem', { name: /^delete/i }).click();
  await page.waitForFunction(
    (label) => !document.body.innerText.includes(label),
    description,
    { timeout: 10_000 },
  );
}

/**
 * Find a transaction by description and open it for edit. Caller fills
 * form fields and saves. Returns when the form re-opens in edit mode.
 */
export async function openTransactionForEdit(
  page: Page,
  description: string,
): Promise<void> {
  await page.goto('/');
  const row = page.locator('[data-testid="transaction-row"]').filter({
    has: page.locator(`p`, { hasText: new RegExp(`^\\s*${escapeRegex(description)}\\s*$`) }),
  }).first();
  await row.scrollIntoViewIfNeeded();

  const kebab = row.getByRole('button', { name: /open transaction actions|transaction actions|actions for/i }).first();
  await kebab.click();
  const menu = page.getByRole('menu');
  const menuVisible = await menu.isVisible({ timeout: 2_000 }).catch(() => false);
  if (menuVisible) {
    await menu.getByRole('menuitem', { name: /^edit/i }).click();
  } else {
    await row.getByRole('button', { name: /^edit$/i }).first().click();
  }
  await page.waitForSelector('form input[inputmode="numeric"]', { timeout: 10_000 });
}

/**
 * Click the UNDO button on the most recently shown undo toast. Useful
 * for restore-after-delete flows.
 */
export async function clickUndoToast(page: Page): Promise<boolean> {
  // The toaster renders a button labeled "UNDO".
  const undoButton = page.getByRole('button', { name: /^undo$/i }).first();
  if (await undoButton.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await undoButton.click();
    return true;
  }
  return false;
}

/** All visible buttons in the current page should have an accessible name. */
export async function assertAllButtonsAccessible(page: Page): Promise<void> {
  const offenders = await page.evaluate(() => {
    const result: { html: string }[] = [];
    document.querySelectorAll('button').forEach((btn) => {
      const aria = btn.getAttribute('aria-label')?.trim();
      const text = btn.textContent?.trim();
      const title = btn.getAttribute('title')?.trim();
      if (!aria && !text && !title) {
        result.push({ html: btn.outerHTML.slice(0, 120) });
      }
    });
    return result;
  });
  if (offenders.length > 0) {
    throw new Error(`Found ${offenders.length} button(s) without an accessible name:\n${JSON.stringify(offenders, null, 2)}`);
  }
}

// --- Internal helpers ---

async function openActionPicker(page: Page): Promise<void> {
  // Desktop sidebar button or mobile FAB both share the same aria-label.
  const fab = page.getByRole('button', { name: /add transaction/i });
  await fab.first().click({ timeout: 10_000 });
  // The picker is rendered as a dialog with multiple action buttons. Scope
  // all further interaction to the dialog to avoid collisions with header
  // buttons (e.g. /debts page has its own "Record Debt" button).
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible', timeout: 5_000 });
}

async function clickPickerAction(page: Page, label: RegExp): Promise<void> {
  const dialog = page.getByRole('dialog');
  const action = dialog.getByRole('button', { name: label }).first();
  await action.waitFor({ state: 'visible', timeout: 5_000 });
  await action.click();
}

export async function pickWalletFromSelect(page: Page, walletName: string): Promise<void> {
  const selects = page.locator('form select');
  const count = await selects.count();
  for (let i = 0; i < count; i++) {
    const select = selects.nth(i);
    const values = await select.evaluate((el: HTMLSelectElement) =>
      Array.from(el.options).map((o) => ({ value: o.value, label: o.textContent?.trim() ?? '' })),
    );
    const match = values.find((v) => v.label === walletName);
    if (match) {
      await select.selectOption({ value: match.value });
      return;
    }
  }
}

async function pickTransferWalletFromSelect(page: Page, index: number, walletName: string): Promise<void> {
  const selects = page.locator('form select');
  await selects.nth(index).selectOption({ label: walletName });
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create an expense via the payee quick-add flow: navigate to /payees,
 * click the `+` button on a payee card, and complete the form.
 * The description field is pre-filled with the payee name by the app.
 */
export async function createExpenseFromPayee(
  page: Page,
  opts: { payeeName: string; amount: string; walletName?: string; categoryName?: string },
): Promise<void> {
  if (!page.url().includes('/payees')) {
    await page.goto('/payees');
    await page.waitForLoadState('networkidle');
  }

  // The + button has an aria-label like "Add expense for <payeeName>".
  const plusBtn = page.getByRole('button', {
    name: new RegExp(`add expense.*${escapeRegex(opts.payeeName)}`, 'i'),
  }).first();
  await plusBtn.scrollIntoViewIfNeeded();
  await plusBtn.click();

  // Wait for the TransactionFormSheet to open.
  await page.waitForSelector('form input[inputmode="numeric"]', { timeout: 10_000 });

  // Description should be pre-filled with the payee name.
  // Wait for React to commit the initialDescription via useEffect.
  const descInput = page.locator('form input[type="text"]:not([inputmode])').first();
  await page.waitForFunction(
    (payeeName) => {
      const input = document.querySelector('form input[type="text"]:not([inputmode])') as HTMLInputElement | null;
      return input && new RegExp(payeeName, 'i').test(input.value);
    },
    opts.payeeName,
    { timeout: 5_000 },
  );

  // Fill amount.
  await page.locator('form input[inputmode="numeric"]').first().fill(opts.amount);

  if (opts.categoryName) {
    const categoryInput = page.locator('form input[placeholder*="category" i], form input[placeholder*="select" i]').first();
    if (await categoryInput.count() > 0) {
      await categoryInput.fill(opts.categoryName);
      await page.waitForTimeout(150);
      await page.keyboard.press('Tab');
    }
  }

  if (opts.walletName) {
    await pickWalletFromSelect(page, opts.walletName);
  }

  await page.getByRole('button', { name: /^save$/i }).first().click();
  await page.waitForSelector('form input[inputmode="numeric"]', { state: 'detached', timeout: 10_000 });
  await page.waitForTimeout(500);
}

// ===================== Service-level helpers =====================
// These bypass the ActionPickerSheet UI to set up state directly via
// the app's service layer. Use them when the test's subject under
// test is NOT the picker flow itself.

/**
 * Create a transfer pair via the app's `saveTransfer()` service.
 * Bypasses the ActionPickerSheet + TransactionFormSheet UI.
 */
export async function createTransferViaService(
  page: Page,
  opts: { fromWallet: string; toWallet: string; amount: number; description: string; date?: string },
): Promise<void> {
  await page.evaluate(async (args) => {
    const dbModule = await import('/src/db/db.ts');
    const txModule = await import('/src/services/transactionSaveService.ts');

    const wallets = await dbModule.db.wallets.toArray();
    const from = wallets.find((w) => w.name === args.fromWallet);
    const to = wallets.find((w) => w.name === args.toWallet);
    if (!from?.id || !to?.id) throw new Error(`Wallet not found: ${args.fromWallet} or ${args.toWallet}`);

    await txModule.saveTransfer({
      fromWalletId: from.id,
      toWalletId: to.id,
      amount: args.amount,
      description: args.description,
      date: args.date ?? '2025-01-15',
      notes: '',
    });
  }, opts);
  // Let Dexie flush.
  await page.waitForTimeout(500);
}

/**
 * Create an expense via the app's `saveTransaction()` service.
 * Bypasses the ActionPickerSheet + TransactionFormSheet UI.
 */
export async function createExpenseViaService(
  page: Page,
  opts: { walletName: string; amount: number; description: string; categoryName?: string; date?: string },
): Promise<void> {
  await page.evaluate(async (args) => {
    const dbModule = await import('/src/db/db.ts');
    const txModule = await import('/src/services/transactionSaveService.ts');

    const wallets = await dbModule.db.wallets.toArray();
    const wallet = wallets.find((w) => w.name === args.walletName);
    if (!wallet?.id) throw new Error(`Wallet not found: ${args.walletName}`);

    let categoryId: number | null = null;
    if (args.categoryName) {
      const cats = await dbModule.db.categories.toArray();
      const cat = cats.find((c) => c.name === args.categoryName);
      categoryId = cat?.id ?? null;
    }

    await txModule.saveTransaction({
      walletId: wallet.id,
      amount: args.amount,
      description: args.description,
      date: args.date ?? '2025-01-15',
      categoryId,
      notes: '',
      type: 'expense',
    });
  }, opts);
  // Let Dexie flush.
  await page.waitForTimeout(500);
}

/**
 * Open a wallet's overflow menu and click an option by name.
 * Handles the new overflow menu pattern (MoreVertical → menuitem).
 */
export async function clickWalletMenuOption(
  page: Page,
  walletName: string,
  optionName: string | RegExp,
): Promise<void> {
  const card = page.locator(`[data-wallet-card="${walletName}"]`).first();
  await card.scrollIntoViewIfNeeded();

  // Click the overflow menu trigger (MoreVertical icon button)
  const menuTrigger = card.getByRole('button', { name: /actions for/i });
  await menuTrigger.click();

  // Wait for menu to appear
  const menu = page.getByRole('menu');
  await menu.waitFor({ state: 'visible', timeout: 3_000 });

  // Click the option
  const option = menu.getByRole('menuitem', { name: optionName });
  await option.click();
}
