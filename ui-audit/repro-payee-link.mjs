/** Verify fix: "Choose payee" now opens a picker ABOVE the form.
 * Flow: fresh onboarding → create 1 expense (so a payee exists) →
 * reopen form → open picker → select payee → description filled, form stays open. */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const DB_NAME = 'ExpendDB';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();

// --- fresh slate ---
await page.context().clearCookies();
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(async ({ dbName }) => {
  try { window.localStorage.clear(); window.sessionStorage.clear(); } catch { /* ignore */ }
  try {
    for (const name of [dbName, `${dbName}_db`]) {
      await new Promise((resolve) => {
        const req = indexedDB.deleteDatabase(name);
        req.onsuccess = req.onerror = req.onblocked = () => resolve(null);
      });
    }
  } catch { /* ignore */ }
}, { dbName: DB_NAME });

// --- landing → onboarding ---
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle');
await page.waitForFunction(() => document.body.innerText.length > 0);
const start = page.getByRole('button', { name: /^start tracking/i });
if (await start.first().isVisible({ timeout: 5000 }).catch(() => false)) await start.first().click();
await page.waitForSelector('h1:has-text("Welcome to Expend")', { timeout: 10000 });
await page.locator('input').first().fill('Repro Wallet');
await page.locator('input[inputmode="numeric"]').first().fill('500000');
await page.locator('button.h-12:has-text("Next")').click();
await page.waitForSelector('h1:has-text("Choose Categories")', { timeout: 10000 });
await page.locator('button.h-12:has-text("Next")').click();
await page.waitForSelector('h1:has-text("All Set")', { timeout: 10000 });
await page.locator('button.h-12').last().click();
await page.waitForSelector('main#main-content', { timeout: 15000 });
await page.waitForTimeout(800);

// Helper: open the transaction form (quick add)
async function openForm() {
  await page.locator('nav button[aria-label="Add Transaction"]:visible, aside button[aria-label="Add Transaction"]:visible').first().click({ timeout: 10000 });
  await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByRole('dialog').getByRole('button', { name: /^add expense$/i }).first().click();
  await page.waitForSelector('form input[inputmode="numeric"]', { timeout: 10000 });
}

// --- create one expense so a payee exists ---
await openForm();
await page.locator('form input[inputmode="numeric"]').first().fill('15000');
await page.getByRole('dialog').getByRole('button', { name: /add details/i }).first().click();
await page.locator('form input[type="text"]:not([inputmode]):not([role="combobox"])').first().fill('Warung Bu Tini');
await page.getByRole('dialog').getByRole('button', { name: /^save$/i }).first().click();
await page.waitForSelector('form input[inputmode="numeric"]', { state: 'detached', timeout: 10000 });
await page.waitForTimeout(600);

// --- reopen form, expand details, open the picker ---
await openForm();
await page.getByRole('dialog').getByRole('button', { name: /add details/i }).first().click();
await page.waitForTimeout(400);

const trigger = page.getByRole('dialog').getByRole('button', { name: /choose payee|pilih payee/i }).first();
console.log('choose-payee trigger visible:', await trigger.isVisible().catch(() => false));
await trigger.click();
await page.waitForTimeout(800);

console.log('--- after opening picker ---');
console.log('open dialogs:', await page.locator('dialog[open]').count(), '(expect 2: form + picker)');
console.log('url:', page.url(), '(expect still /)');
const pickerTitle = page.getByRole('dialog', { name: /choose payee|pilih payee/i }).first();
console.log('picker dialog visible:', await pickerTitle.isVisible().catch(() => false));
console.log('search box present:', await page.getByRole('searchbox').count());
const payeeRow = page.getByRole('dialog', { name: /choose payee|pilih payee/i }).getByRole('button', { name: /warung bu tini/i }).first();
console.log('payee "Warung Bu Tini" listed:', await payeeRow.isVisible().catch(() => false));

await page.screenshot({ path: 'ui-audit/out/repro-payee-picker-open.png', fullPage: true });

// --- Escape while picker open: should close ONLY the picker, keep the form ---
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
console.log('--- after Escape with picker open ---');
console.log('open dialogs:', await page.locator('dialog[open]').count(), '(expect 1: form only)');
console.log('form still open:', await page.locator('form input[inputmode="numeric"]').isVisible().catch(() => false));
console.log('no discard-confirm dialog:', (await page.getByRole('dialog', { name: /discard|batal|batalkan/i }).count()) === 0);

// --- reopen picker and select the payee ---
await trigger.click();
await page.waitForTimeout(600);
await payeeRow.click();
await page.waitForTimeout(600);

console.log('--- after selecting payee ---');
console.log('open dialogs:', await page.locator('dialog[open]').count(), '(expect 1: form only)');
console.log('url:', page.url(), '(expect still /)');
const descValue = await page.locator('form input[type="text"]:not([inputmode]):not([role="combobox"])').first().inputValue().catch(() => '');
console.log('description field =', JSON.stringify(descValue), '(expect "Warung Bu Tini")');
console.log('form still open:', await page.locator('form input[inputmode="numeric"]').isVisible().catch(() => false));

await page.screenshot({ path: 'ui-audit/out/repro-payee-selected.png', fullPage: true });
console.log('screenshots saved');

await browser.close();
