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
export async function clearAllStorage(page: Page): Promise<void> {
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
  await clearAllStorage(page);
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
}

export async function createDebt(
  page: Page,
  opts: { personName: string; amount: string; walletName: string; type?: 'payable' | 'receivable' },
): Promise<void> {
  await openActionPicker(page);
  await clickPickerAction(page, /record debt/i);
  await page.waitForSelector('h3:has-text("I Owe Money")', { timeout: 10_000 });

  const typeLabel = opts.type === 'receivable' ? /i lent money/i : /i owe money/i;
  await page.getByRole('button', { name: typeLabel }).first().click();
  await page.waitForSelector('input[required][type="text"]', { timeout: 10_000 });

  const personInput = page.locator('input[required][type="text"]').first();
  await personInput.fill(opts.personName);

  const amountInput = page.locator('form input[inputmode="numeric"]').first();
  await amountInput.fill(opts.amount);

  if (opts.walletName) {
    const walletSelect = page.locator('form select').first();
    await walletSelect.selectOption({ label: opts.walletName });
  }

  await page.getByRole('button', { name: /save payable|save receivable|^save$/i }).first().click();
  await page.waitForFunction(
    () => !document.querySelector('form input[inputmode="numeric"]'),
    undefined,
    { timeout: 10_000 },
  );
}

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

/** Navigate to a route via the sidebar nav (visible on desktop viewports). */
export async function navigateViaSidebar(page: Page, label: RegExp): Promise<void> {
  const link = page.getByRole('link', { name: label });
  await link.first().click();
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
  await dialog.getByRole('button', { name: label }).first().click();
}


async function pickWalletFromSelect(page: Page, walletName: string): Promise<void> {
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
