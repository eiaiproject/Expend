/**
 * Playwright screenshot script for README.
 * Seeds data directly via IndexedDB, then captures key views.
 *
 * Usage: node scripts/screenshots.mjs
 */
import { chromium } from '@playwright/test';
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'docs', 'screenshots');
const PORT = 4399;
const BASE = `http://127.0.0.1:${PORT}`;

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

console.log('Building…');
execSync('npm run build', { stdio: 'pipe', cwd: ROOT }); // NOSONAR — S4036: no user input

const server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {  # NOSONAR javascript:S4036
  stdio: 'pipe', cwd: ROOT,
});

await new Promise((r) => {
  server.stdout.on('data', (d) => { if (d.toString().includes('Local:')) r(); });
  setTimeout(r, 8000);
});

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

try {
  // ── Seed data directly into IndexedDB ─────────────────────
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ExpendDB');
      request.onupgradeneeded = () => {};
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(['wallets', 'categories', 'transactions', 'debts', 'debtPayments', 'settings'], 'readwrite');
        const now = new Date().toISOString();

        // Settings: onboarded flag
        tx.objectStore('settings').put({ key: 'onboarded', value: 'true' });

        // Categories
        const cats = [
          { name: 'Food & Drinks', color: '#f59e0b', icon: 'UtensilsCrossed', budget: 1000000, createdAt: now, updatedAt: now },
          { name: 'Transportation', color: '#3b82f6', icon: 'Car', budget: 500000, createdAt: now, updatedAt: now },
          { name: 'Shopping', color: '#ec4899', icon: 'ShoppingBag', budget: 800000, createdAt: now, updatedAt: now },
          { name: 'Utilities', color: '#8b5cf6', icon: 'Zap', budget: 300000, createdAt: now, updatedAt: now },
        ];
        const catIds = [];  # NOSONAR javascript:S4030
        for (const c of cats) {
          const id = tx.objectStore('categories').put(c);
          catIds.push(id);
        }

        // Wallet
        tx.objectStore('wallets').put({
          name: 'Main Wallet', currency: 'IDR', initialBalance: 5000000, currentBalance: 4598000,
          lastUpdated: now, color: '#10b981',
        });

        // Transactions
        const txs = [
          { walletId: 1, categoryId: 1, date: '2026-07-15', description: 'Lunch at Sate Padang', type: 'expense', amount: 45000, notes: '', createdAt: now, updatedAt: now },
          { walletId: 1, categoryId: 1, date: '2026-07-15', description: 'Morning Coffee', type: 'expense', amount: 12000, notes: '', createdAt: now, updatedAt: now },
          { walletId: 1, categoryId: 2, date: '2026-07-15', description: 'Gojek to Office', type: 'expense', amount: 75000, notes: '', createdAt: now, updatedAt: now },
          { walletId: 1, categoryId: 1, date: '2026-07-14', description: 'Weekly Groceries', type: 'expense', amount: 250000, notes: '', createdAt: now, updatedAt: now },
          { walletId: 1, categoryId: 2, date: '2026-07-14', description: 'Parking', type: 'expense', amount: 20000, notes: '', createdAt: now, updatedAt: now },
          { walletId: 1, categoryId: 3, date: '2026-07-13', description: 'New Headphones', type: 'expense', amount: 350000, notes: '', createdAt: now, updatedAt: now },
        ];
        for (const txData of txs) {
          tx.objectStore('transactions').put(txData);
        }

        // Debt
        const debtId = 'debt-001';
        tx.objectStore('debts').put({
          id: debtId, type: 'payable', personName: 'Alice', title: '', principalAmount: 500000,
          remainingAmount: 350000, walletId: 1, startDate: '2026-07-01', dueDate: '2026-08-01',
          notes: '', status: 'partial', createdAt: now, updatedAt: now, archivedAt: null,
        });
        tx.objectStore('debtPayments').put({
          id: 'dp-001', debtId, amount: 500000, date: '2026-07-01', walletId: 1, type: 'initial',
          notes: '', linkedTransactionId: null, createdAt: now,
        });
        tx.objectStore('debtPayments').put({
          id: 'dp-002', debtId, amount: 150000, date: '2026-07-10', walletId: 1, type: 'repayment',
          notes: '', linkedTransactionId: null, createdAt: now,
        });

        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(new Error(tx.error?.message ?? String(tx.error))); };
      };
      request.onerror = () => reject(new Error(request.error));
    });
  });

  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // ── Screenshots ──────────────────────────────────────────
  const shot = (name, fullPage = false) =>
    page.screenshot({ path: resolve(OUT, `${name}.png`), fullPage });

  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
  await shot('home');

  await page.goto(`${BASE}/wallets`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await shot('wallets');

  await page.goto(`${BASE}/debts`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await shot('debts');

  await page.goto(`${BASE}/stats`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
  await shot('stats');

  await page.goto(`${BASE}/payees`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await shot('payees');

  await page.goto(`${BASE}/settings`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await shot('settings', true);

  // Add expense form
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /add transaction/i }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('dialog').getByRole('button', { name: /add expense/i }).click();
  await page.waitForTimeout(500);
  await page.locator('form input[inputmode="numeric"]').first().fill('35000');
  await page.locator('form input[type="text"]:not([inputmode])').first().fill('Nasi Goreng');
  await shot('add-expense');

  console.log('✅ Screenshots →', OUT);
} catch (err) {
  console.error('❌', err);
  process.exit(1);
} finally {
  await browser.close();
  server.kill();
}
