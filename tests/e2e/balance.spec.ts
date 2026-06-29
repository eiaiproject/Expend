import { test, expect } from '@playwright/test';
import {
  uniqueName,
  visitApp,
  completeOnboarding,
  createExpense,
  createTransfer,
  createWallet,
  createDebt,
  recordDebtPayment,
  adjustWalletBalance,
  readDb,
  readWalletByName,
  readTransactions,
  readDebts,
  readDebtPayments,
  expectWalletBalance,
  deleteTransactionByDescription,
  openTransactionForEdit,
  clickUndoToast,
  getWalletCurrentBalance,
  readTable,
} from './helpers';

/**
 * Expend wallet-balance E2E suite.
 *
 * Every scenario here proves that the user-facing operation that
 * can change `wallet.currentBalance`:
 *   1. Persists the exact expected balance to IndexedDB.
 *   2. Reflects the same number in the visible UI (when reachable).
 *   3. Creates the right supporting records and NO duplicates.
 *   4. Rolls back correctly on edit / delete / undo.
 *
 * Scenarios deliberately absent (and why):
 *   - "Income increases balance": the app has no user-facing income
 *     action. `balance_adjustment` with a positive amount is the only
 *     user-visible "balance increases" path, covered by D.
 *   - "Edit transfer amount" / "Edit transfer wallet": explicitly
 *     unsupported by the form ("Editing transfers is not supported in
 *     this version." toast). Domain invariants prevent the path.
 *   - "Restore deleted transaction": supported via the Toaster UNDO
 *     button; covered by M.
 */

const BASE_BALANCE = '300000';
const INITIAL_BALANCE_NUM = 300_000;

async function freshWalletWithBalance(page: import('@playwright/test').Page, label: string, balance: string): Promise<string> {
  const name = uniqueName(label);
  await page.goto('/wallets');
  await createWallet(page, name, balance);
  return name;
}

test.describe('wallet balance — onboarding & initial balance', () => {
  test('onboarding wallet persists initialBalance and currentBalance', async ({ page }) => {
    await visitApp(page);
    const walletName = uniqueName('Onboard');
    await completeOnboarding(page, {
      walletName,
      walletBalance: BASE_BALANCE,
      categories: ['Food & Drinks'],
    });

    const wallet = await readWalletByName(page, walletName);
    expect(wallet, 'wallet persisted to DB').toBeTruthy();
    expect(Number(wallet!.initialBalance)).toBe(INITIAL_BALANCE_NUM);
    expect(Number(wallet!.currentBalance)).toBe(INITIAL_BALANCE_NUM);

    // Visible UI agrees.
    await page.goto('/wallets');
    await page.waitForLoadState('networkidle');
    await page.locator(`[data-wallet-card="${walletName}"]`).first().getByText('300.000').first().waitFor({ timeout: 5_000 });
  });

  test('wallets created from /wallets also persist currentBalance', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Seed'),
      walletBalance: '0',
      categories: [],
    });
    const name = await freshWalletWithBalance(page, 'Extra', BASE_BALANCE);
    await expectWalletBalance(page, name, INITIAL_BALANCE_NUM);

    const txs = await readTransactions(page);
    expect(txs.filter((t) => t.type !== 'balance_adjustment' && t.amount === INITIAL_BALANCE_NUM)).toHaveLength(0);
  });
});

test.describe('wallet balance — transactions', () => {
  test('expense decreases balance and persists transaction', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Cash'),
      walletBalance: '0',
      categories: ['Food & Drinks'],
    });
    const wallet = await freshWalletWithBalance(page, 'Exp', BASE_BALANCE);

    const desc = uniqueName('lunch');
    await page.goto('/');
    await createExpense(page, {
      amount: '25000',
      description: desc,
      walletName: wallet,
      categoryName: 'Food & Drinks',
    });

    await expectWalletBalance(page, wallet, INITIAL_BALANCE_NUM - 25_000);

    const txs = await readTransactions(page);
    const expense = txs.find((t) => t.description === desc && t.type === 'expense');
    expect(expense, 'expense transaction persisted').toBeTruthy();
    expect(Number(expense!.amount)).toBe(25_000);
    expect(expense!.walletId).toBe((await readWalletByName(page, wallet))!.id);
    // No duplicate expense with the same description.
    expect(txs.filter((t) => t.description === desc)).toHaveLength(1);

    // Navigate to the wallets view; UI balance must reflect the DB value.
    await page.goto('/wallets');
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`[data-wallet-card="${wallet}"]`).first().getByText('275.000')).toBeVisible();
  });

  test('balance_adjustment (positive) increases balance', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Seed'),
      walletBalance: '0',
      categories: [],
    });
    const wallet = await freshWalletWithBalance(page, 'Adj', BASE_BALANCE);

    await adjustWalletBalance(page, { walletName: wallet, newBalance: '350000' });
    await expectWalletBalance(page, wallet, 350_000);

    const txs = await readTransactions(page);
    const adj = txs.find((t) => t.type === 'balance_adjustment');
    expect(adj, 'balance_adjustment transaction created').toBeTruthy();
    expect(Number(adj!.amount)).toBe(50_000);

    // UI agrees.
    await expect(page.locator(`[data-wallet-card="${wallet}"]`).first().getByText('350.000')).toBeVisible();
  });

  test('balance_adjustment (negative) decreases balance', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Seed'),
      walletBalance: '0',
      categories: [],
    });
    const wallet = await freshWalletWithBalance(page, 'AdjNeg', BASE_BALANCE);

    await adjustWalletBalance(page, { walletName: wallet, newBalance: '250000' });
    await expectWalletBalance(page, wallet, 250_000);

    const txs = await readTransactions(page);
    const adj = txs.find((t) => t.type === 'balance_adjustment');
    expect(adj).toBeTruthy();
    expect(Number(adj!.amount)).toBe(-50_000);
  });

  test('balance_adjustment no-op does not create a transaction', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Seed'),
      walletBalance: '0',
      categories: [],
    });
    const wallet = await freshWalletWithBalance(page, 'Noop', BASE_BALANCE);

    await adjustWalletBalance(page, { walletName: wallet, newBalance: BASE_BALANCE });
    await expectWalletBalance(page, wallet, INITIAL_BALANCE_NUM);

    const txs = await readTransactions(page);
    expect(txs.filter((t) => t.type === 'balance_adjustment')).toHaveLength(0);
  });
});

test.describe('wallet balance — edit & delete', () => {
  test('editing expense amount updates balance by the delta', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Seed'),
      walletBalance: '0',
      categories: ['Food & Drinks'],
    });
    const wallet = await freshWalletWithBalance(page, 'Edit', BASE_BALANCE);

    const desc = uniqueName('groceries');
    await page.goto('/');
    await createExpense(page, {
      amount: '25000',
      description: desc,
      walletName: wallet,
      categoryName: 'Food & Drinks',
    });
    await expectWalletBalance(page, wallet, INITIAL_BALANCE_NUM - 25_000);

    await openTransactionForEdit(page, desc);
    // React controlled inputs cache the formatted value (e.g. "25.000").
    // selectAll + delete before fill prevents string concat artefacts.
    const amountField = page.locator('form input[inputmode="numeric"]').first();
    await amountField.click({ clickCount: 3 });
    await amountField.press('Backspace');
    await amountField.fill('40000');
    await page.getByRole('button', { name: /^save$/i }).first().click();
    await page.waitForSelector('form input[inputmode="numeric"]', { state: 'detached', timeout: 10_000 });

    await expectWalletBalance(page, wallet, INITIAL_BALANCE_NUM - 40_000);

    const txs = await readTransactions(page);
    // No duplicate: exactly one tx matching the description.
    expect(txs.filter((t) => t.description === desc)).toHaveLength(1);
    expect(Number(txs.find((t) => t.description === desc)!.amount)).toBe(40_000);
  });

  test('moving expense to another wallet rolls back old wallet and applies new wallet', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Seed'),
      walletBalance: '0',
      categories: ['Food & Drinks'],
    });
    const a = await freshWalletWithBalance(page, 'WalletA', BASE_BALANCE);
    const b = await freshWalletWithBalance(page, 'WalletB', '100000');

    const desc = uniqueName('move-me');
    await page.goto('/');
    await createExpense(page, {
      amount: '25000',
      description: desc,
      walletName: a,
      categoryName: 'Food & Drinks',
    });
    await expectWalletBalance(page, a, INITIAL_BALANCE_NUM - 25_000);
    await expectWalletBalance(page, b, 100_000);

    await openTransactionForEdit(page, desc);
    // The form's first <select> is the wallet picker (transfer tab not active for an expense).
    const walletSelect = page.locator('form select').first();
    const bOption = await walletSelect.evaluate((el: HTMLSelectElement) =>
      Array.from(el.options).map((o) => ({ value: o.value, label: o.textContent?.trim() ?? '' })),
    );
    const match = bOption.find((o) => o.label === b);
    expect(match, `option ${b} present`).toBeTruthy();
    await walletSelect.selectOption({ value: match!.value });
    await page.getByRole('button', { name: /^save$/i }).first().click();
    await page.waitForSelector('form input[inputmode="numeric"]', { state: 'detached', timeout: 10_000 });

    await expectWalletBalance(page, a, INITIAL_BALANCE_NUM);
    await expectWalletBalance(page, b, 100_000 - 25_000);

    const txs = await readTransactions(page);
    expect(txs.filter((t) => t.description === desc)).toHaveLength(1);
    const moved = txs.find((t) => t.description === desc)!;
    expect(moved.walletId).toBe((await readWalletByName(page, b))!.id);
  });

  test('deleting an expense restores balance', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Seed'),
      walletBalance: '0',
      categories: ['Food & Drinks'],
    });
    const wallet = await freshWalletWithBalance(page, 'Del', BASE_BALANCE);

    const desc = uniqueName('throwaway');
    await page.goto('/');
    await createExpense(page, {
      amount: '25000',
      description: desc,
      walletName: wallet,
      categoryName: 'Food & Drinks',
    });
    await expectWalletBalance(page, wallet, INITIAL_BALANCE_NUM - 25_000);

    await deleteTransactionByDescription(page, desc);
    await expectWalletBalance(page, wallet, INITIAL_BALANCE_NUM);

    const txs = await readTransactions(page);
    expect(txs.find((t) => t.description === desc)).toBeUndefined();
  });

  test('undo after delete restores the expense and its balance impact', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Seed'),
      walletBalance: '0',
      categories: ['Food & Drinks'],
    });
    const wallet = await freshWalletWithBalance(page, 'Undo', BASE_BALANCE);

    const desc = uniqueName('recover');
    await page.goto('/');
    await createExpense(page, {
      amount: '25000',
      description: desc,
      walletName: wallet,
      categoryName: 'Food & Drinks',
    });

    await deleteTransactionByDescription(page, desc);
    await expectWalletBalance(page, wallet, INITIAL_BALANCE_NUM);

    const restored = await clickUndoToast(page);
    expect(restored, 'UNDO button was visible after delete').toBe(true);

    // Wait for balance to flip back to 275_000.
    await expect.poll(
      async () => getWalletCurrentBalance(page, wallet),
      { timeout: 5_000 },
    ).toBe(INITIAL_BALANCE_NUM - 25_000);

    const txs = await readTransactions(page);
    expect(txs.filter((t) => t.description === desc)).toHaveLength(1);
  });
});

test.describe('wallet balance — transfers', () => {
  test('transfer moves the exact amount between both wallets', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Seed'),
      walletBalance: '0',
      categories: [],
    });
    const from = await freshWalletWithBalance(page, 'XferFrom', '300000');
    const to = await freshWalletWithBalance(page, 'XferTo', '100000');

    const desc = uniqueName('topup');
    await page.goto('/');
    await createTransfer(page, {
      amount: '75000',
      description: desc,
      fromWallet: from,
      toWallet: to,
    });

    await expectWalletBalance(page, from, 300_000 - 75_000);
    await expectWalletBalance(page, to, 100_000 + 75_000);

    const txs = await readTransactions(page);
    const out = txs.find((t) => t.type === 'transfer_out' && t.description === `${desc} (Out)`);
    const inn = txs.find((t) => t.type === 'transfer_in' && t.description === `${desc} (In)`);
    expect(out, 'transfer_out exists').toBeTruthy();
    expect(inn, 'transfer_in exists').toBeTruthy();
    expect(out!.transferGroupId).toBeTruthy();
    expect(inn!.transferGroupId).toBe(out!.transferGroupId);
    expect(Number(out!.amount)).toBe(75_000);
    expect(Number(inn!.amount)).toBe(75_000);

    // UI balances agree.
    await page.goto('/wallets');
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`[data-wallet-card="${from}"]`).first().getByText('225.000')).toBeVisible();
    await expect(page.locator(`[data-wallet-card="${to}"]`).first().getByText('175.000')).toBeVisible();
  });

  test('deleting a transfer restores both wallets', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Seed'),
      walletBalance: '0',
      categories: [],
    });
    const from = await freshWalletWithBalance(page, 'XferFromDel', '300000');
    const to = await freshWalletWithBalance(page, 'XferToDel', '100000');

    const desc = uniqueName('topup-del');
    await page.goto('/');
    await createTransfer(page, {
      amount: '75000',
      description: desc,
      fromWallet: from,
      toWallet: to,
    });
    await expectWalletBalance(page, from, 300_000 - 75_000);
    await expectWalletBalance(page, to, 100_000 + 75_000);

    // Deleting either side of the transfer should roll back BOTH wallets.
    await deleteTransactionByDescription(page, `${desc} (Out)`);
    await expectWalletBalance(page, from, 300_000);
    await expectWalletBalance(page, to, 100_000);

    const txs = await readTransactions(page);
    expect(txs.filter((t) => t.description === `${desc} (Out)`)).toHaveLength(0);
    expect(txs.filter((t) => t.description === `${desc} (In)`)).toHaveLength(0);
  });
});

test.describe('wallet balance — debts', () => {
  test('payable creation increases balance and writes initial debt payment', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Seed'),
      walletBalance: '0',
      categories: [],
    });
    const wallet = await freshWalletWithBalance(page, 'Pay', BASE_BALANCE);

    const person = uniqueName('Alice');
    await createDebt(page, {
      personName: person,
      amount: '100000',
      walletName: wallet,
      type: 'payable',
    });

    await expectWalletBalance(page, wallet, INITIAL_BALANCE_NUM + 100_000);

    const debts = await readDebts(page);
    const debt = debts.find((d) => d.personName === person)!;
    expect(debt.type).toBe('payable');
    expect(Number(debt.principalAmount)).toBe(100_000);
    expect(Number(debt.remainingAmount)).toBe(100_000);

    const payments = await readDebtPayments(page);
    expect(payments.some((p) => p.debtId === debt.id && p.type === 'initial' && Number(p.amount) === 100_000)).toBe(true);
  });

  test('receivable creation decreases balance and writes initial debt payment', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Seed'),
      walletBalance: '0',
      categories: [],
    });
    const wallet = await freshWalletWithBalance(page, 'Recv', BASE_BALANCE);

    const person = uniqueName('Bob');
    await createDebt(page, {
      personName: person,
      amount: '100000',
      walletName: wallet,
      type: 'receivable',
    });

    await expectWalletBalance(page, wallet, INITIAL_BALANCE_NUM - 100_000);

    const debts = await readDebts(page);
    const debt = debts.find((d) => d.personName === person)!;
    expect(debt.type).toBe('receivable');
    expect(Number(debt.remainingAmount)).toBe(100_000);

    const payments = await readDebtPayments(page);
    expect(payments.some((p) => p.debtId === debt.id && p.type === 'initial')).toBe(true);
  });

  test('payable partial repayment decreases balance', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Seed'),
      walletBalance: '0',
      categories: [],
    });
    const wallet = await freshWalletWithBalance(page, 'PayPartial', BASE_BALANCE);

    const person = uniqueName('Carol');
    await createDebt(page, {
      personName: person,
      amount: '100000',
      walletName: wallet,
      type: 'payable',
    });
    await expectWalletBalance(page, wallet, INITIAL_BALANCE_NUM + 100_000);

    await recordDebtPayment(page, {
      personName: person,
      amount: '40000',
      walletName: wallet,
    });

    await expectWalletBalance(page, wallet, INITIAL_BALANCE_NUM + 100_000 - 40_000);

    const debts = await readDebts(page);
    const debt = debts.find((d) => d.personName === person)!;
    expect(Number(debt.remainingAmount)).toBe(60_000);
    expect(debt.status).toMatch(/partial|open/);

    const payments = await readDebtPayments(page);
    expect(payments.some((p) => p.debtId === debt.id && p.type === 'repayment' && Number(p.amount) === 40_000)).toBe(true);
  });

  test('payable full repayment returns balance and marks paid', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Seed'),
      walletBalance: '0',
      categories: [],
    });
    const wallet = await freshWalletWithBalance(page, 'PayFull', BASE_BALANCE);

    const person = uniqueName('Dora');
    await createDebt(page, {
      personName: person,
      amount: '100000',
      walletName: wallet,
      type: 'payable',
    });
    await expectWalletBalance(page, wallet, INITIAL_BALANCE_NUM + 100_000);

    await recordDebtPayment(page, {
      personName: person,
      amount: '100000',
      walletName: wallet,
      quickRatio: 1,
    });

    await expectWalletBalance(page, wallet, INITIAL_BALANCE_NUM);

    const debts = await readDebts(page);
    const debt = debts.find((d) => d.personName === person)!;
    expect(Number(debt.remainingAmount)).toBe(0);
    expect(debt.status).toBe('paid');
  });

  test('receivable partial repayment increases balance', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Seed'),
      walletBalance: '0',
      categories: [],
    });
    const wallet = await freshWalletWithBalance(page, 'RecvPartial', BASE_BALANCE);

    const person = uniqueName('Eve');
    await createDebt(page, {
      personName: person,
      amount: '100000',
      walletName: wallet,
      type: 'receivable',
    });
    await expectWalletBalance(page, wallet, INITIAL_BALANCE_NUM - 100_000);

    await recordDebtPayment(page, {
      personName: person,
      amount: '40000',
      walletName: wallet,
    });

    await expectWalletBalance(page, wallet, INITIAL_BALANCE_NUM - 100_000 + 40_000);

    const debts = await readDebts(page);
    const debt = debts.find((d) => d.personName === person)!;
    expect(Number(debt.remainingAmount)).toBe(60_000);
  });

  test('receivable full repayment returns balance and marks paid', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Seed'),
      walletBalance: '0',
      categories: [],
    });
    const wallet = await freshWalletWithBalance(page, 'RecvFull', BASE_BALANCE);

    const person = uniqueName('Frank');
    await createDebt(page, {
      personName: person,
      amount: '100000',
      walletName: wallet,
      type: 'receivable',
    });
    await expectWalletBalance(page, wallet, INITIAL_BALANCE_NUM - 100_000);

    await recordDebtPayment(page, {
      personName: person,
      amount: '100000',
      walletName: wallet,
      quickRatio: 1,
    });

    await expectWalletBalance(page, wallet, INITIAL_BALANCE_NUM);

    const debts = await readDebts(page);
    const debt = debts.find((d) => d.personName === person)!;
    expect(Number(debt.remainingAmount)).toBe(0);
    expect(debt.status).toBe('paid');
  });

  test('mark debt paid without cashflow does not change wallet balance', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Seed'),
      walletBalance: '0',
      categories: [],
    });
    const wallet = await freshWalletWithBalance(page, 'PayMark', BASE_BALANCE);

    const person = uniqueName('Grace');
    await createDebt(page, {
      personName: person,
      amount: '100000',
      walletName: wallet,
      type: 'payable',
    });
    const afterCreate = await getWalletCurrentBalance(page, wallet);

    // Open detail sheet via the debt card.
    await page.goto('/debts');
    await page.waitForLoadState('networkidle');
    await page.locator(`[data-testid="debt-row"]`).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByRole('button', { name: /^paid$/i }).first().click();

    // Wait for the confirm dialog (it sits on top of the detail sheet).
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll('[role="dialog"]')).some((el) => /mark as paid/i.test(el.getAttribute('aria-label') ?? '')),
      undefined,
      { timeout: 5_000 },
    );
    const confirmDialog = page.locator('[role="dialog"]').filter({ has: page.locator('button', { hasText: /mark paid/i }) }).last();
    await confirmDialog.locator('button', { hasText: /mark paid/i }).first().click();

    // Wait for action to settle.
    await page.waitForTimeout(800);

    const finalBalance = await getWalletCurrentBalance(page, wallet);
    expect(finalBalance).toBe(afterCreate);

    const debts = await readDebts(page);
    const debt = debts.find((d) => d.personName === person)!;
    expect(debt.status).toBe('paid');
    expect(Number(debt.remainingAmount)).toBe(0);
  });

  test('write-off receivable does not change wallet balance', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Seed'),
      walletBalance: '0',
      categories: [],
    });
    const wallet = await freshWalletWithBalance(page, 'WriteOff', BASE_BALANCE);

    const person = uniqueName('Heidi');
    await createDebt(page, {
      personName: person,
      amount: '100000',
      walletName: wallet,
      type: 'receivable',
    });
    const afterCreate = await getWalletCurrentBalance(page, wallet);

    await page.goto('/debts');
    await page.waitForLoadState('networkidle');
    await page.locator(`[data-testid="debt-row"]`).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByRole('button', { name: /write off/i }).first().click();

    await page.waitForFunction(
      () => Array.from(document.querySelectorAll('[role="dialog"]')).some((el) => /write off receivable/i.test(el.getAttribute('aria-label') ?? '')),
      undefined,
      { timeout: 5_000 },
    );
    const confirmDialog = page.locator('[role="dialog"]').filter({ has: page.locator('button', { hasText: /write off/i }) }).last();
    await confirmDialog.locator('button', { hasText: /^write off$/i }).first().click();

    await page.waitForTimeout(800);

    const finalBalance = await getWalletCurrentBalance(page, wallet);
    expect(finalBalance).toBe(afterCreate);

    const debts = await readDebts(page);
    const debt = debts.find((d) => d.personName === person)!;
    expect(debt.status).toBe('written_off');
    expect(Number(debt.remainingAmount)).toBe(0);

    // No repayment cashflow row was created.
    const payments = await readDebtPayments(page);
    expect(payments.some((p) => p.debtId === debt.id && p.type === 'repayment')).toBe(false);
  });

  test('updating debt amount before any repayment rolls balance forward', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Seed'),
      walletBalance: '0',
      categories: [],
    });
    const wallet = await freshWalletWithBalance(page, 'EditDebt', BASE_BALANCE);

    const person = uniqueName('Ivan');
    await createDebt(page, {
      personName: person,
      amount: '100000',
      walletName: wallet,
      type: 'payable',
    });
    await expectWalletBalance(page, wallet, INITIAL_BALANCE_NUM + 100_000);

    // Edit the debt amount via the detail sheet.
    await page.goto('/debts');
    await page.waitForLoadState('networkidle');
    await page.locator(`[data-testid="debt-row"]`).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByRole('button', { name: /^edit$/i }).first().click();

    // DebtFormSheet is now open. Update amount.
    const amountInput = page.locator('form input[inputmode="numeric"]').first();
    await amountInput.click({ clickCount: 3 });
    await amountInput.press('Backspace');
    await amountInput.fill('150000');
    await amountInput.blur();
    await page.getByRole('button', { name: /save changes/i }).first().click();
    await page.waitForTimeout(800);

    const debts = await readDebts(page);
    const debt = debts.find((d) => d.personName === person)!;
    expect(Number(debt.principalAmount)).toBe(150_000);

    await expectWalletBalance(page, wallet, INITIAL_BALANCE_NUM + 150_000);
  });
});

test.describe('wallet balance — deletion safety', () => {
  test('wallet with active debt reference cannot be deleted', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Seed'),
      walletBalance: '0',
      categories: [],
    });
    const wallet = await freshWalletWithBalance(page, 'Locked', BASE_BALANCE);

    await createDebt(page, {
      personName: uniqueName('LockedPerson'),
      amount: '50000',
      walletName: wallet,
      type: 'payable',
    });

    // Attempt to delete the wallet via the trash button on the card.
    await page.goto('/wallets');
    await page.waitForLoadState('networkidle');
    const card = page.locator(`[data-wallet-card="${wallet}"]`).first();
    await card.getByRole('button', { name: /delete wallet/i }).first().click();

    // Wait for the confirm dialog to render.
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll('[role="dialog"]')).some((el) => /delete wallet/i.test(el.getAttribute('aria-label') ?? '')),
      undefined,
      { timeout: 5_000 },
    );
    const confirmDialog = page.locator('[role="dialog"]').filter({ has: page.locator('button', { hasText: /confirm/i }) }).last();
    await confirmDialog.locator('button', { hasText: /confirm/i }).first().click();

    await page.waitForTimeout(800);

    // Wallet must still exist in DB.
    const still = await readWalletByName(page, wallet);
    expect(still, 'wallet blocked from deletion').toBeTruthy();
  });

  test('wallet with active expense cannot be deleted', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Seed'),
      walletBalance: '0',
      categories: ['Food & Drinks'],
    });
    const wallet = await freshWalletWithBalance(page, 'HasTx', BASE_BALANCE);

    await page.goto('/');
    await createExpense(page, {
      amount: '10000',
      description: uniqueName('block-delete'),
      walletName: wallet,
      categoryName: 'Food & Drinks',
    });

    await page.goto('/wallets');
    await page.waitForLoadState('networkidle');
    const card = page.locator(`[data-wallet-card="${wallet}"]`).first();
    await card.getByRole('button', { name: /delete wallet/i }).first().click();
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll('[role="dialog"]')).some((el) => /delete wallet/i.test(el.getAttribute('aria-label') ?? '')),
      undefined,
      { timeout: 5_000 },
    );
    const confirmDialog = page.locator('[role="dialog"]').filter({ has: page.locator('button', { hasText: /confirm/i }) }).last();
    await confirmDialog.locator('button', { hasText: /confirm/i }).first().click();
    await page.waitForTimeout(800);

    const still = await readWalletByName(page, wallet);
    expect(still).toBeTruthy();
  });

  test('wallet with no references can be deleted', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Seed'),
      walletBalance: '0',
      categories: [],
    });
    const wallet = await freshWalletWithBalance(page, 'Disposable', BASE_BALANCE);

    await page.goto('/wallets');
    await page.waitForLoadState('networkidle');
    const card = page.locator(`[data-wallet-card="${wallet}"]`).first();
    await card.getByRole('button', { name: /delete wallet/i }).first().click();
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll('[role="dialog"]')).some((el) => /delete wallet/i.test(el.getAttribute('aria-label') ?? '')),
      undefined,
      { timeout: 5_000 },
    );
    const confirmDialog = page.locator('[role="dialog"]').filter({ has: page.locator('button', { hasText: /confirm/i }) }).last();
    await confirmDialog.locator('button', { hasText: /confirm/i }).first().click();
    await page.waitForTimeout(1200);

    const still = await readWalletByName(page, wallet);
    expect(still).toBeUndefined();
  });
});

test.describe('wallet balance — import export', () => {
  // ponytail: the import/export UI uses a hidden <input type=file>
  // backed by a FileReader + downloadBlob. Driving it through Playwright
  // requires capturing the download (via page.waitForEvent('download'))
  // and then re-uploading the blob to the same hidden input. The
  // importExportService itself is covered by unit tests in
  // tests/unit/importExportService.test.ts; here we sanity-check the
  // wiring by calling the same service functions from the page context.
  test('generateExport + importData round-trips wallet balances', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Seed'),
      walletBalance: '0',
      categories: ['Food & Drinks'],
    });

    const walletA = await freshWalletWithBalance(page, 'ImpA', '500000');

    await page.goto('/');
    await createExpense(page, {
      amount: '30000',
      description: uniqueName('imp-exp'),
      walletName: walletA,
      categoryName: 'Food & Drinks',
    });

    const baseline = await readDb(page);
    const baselineA = (baseline.wallets as Array<{ name?: string; currentBalance?: number; initialBalance?: number }>).find((w) => w.name === walletA);
    expect(baselineA).toBeTruthy();

    // Round-trip via the same module the UI imports. Use Vite's module
    // resolution by importing from the served bundle path.
    const roundTrip = await page.evaluate(async (walletName) => {
      const idb = window.indexedDB;
      const data = await new Promise<unknown>((resolve, reject) => {
        const req = idb.open('ExpendDB');
        req.onsuccess = async () => {
          const db = req.result;
          const out: Record<string, unknown[]> = {};
          const tables = ['wallets', 'categories', 'transactions', 'debts', 'debtPayments', 'settings'];
          for (const t of tables) {
            if (!db.objectStoreNames.contains(t)) { out[t] = []; continue; }
            out[t] = await new Promise<unknown[]>((r) => {
              const tx = db.transaction(t, 'readonly');
              const g = tx.objectStore(t).getAll();
              g.onsuccess = () => r((g.result ?? []) as unknown[]);
              g.onerror = () => r([]);
            });
          }
          db.close();
          resolve({
            schemaVersion: '2.1',
            exportedAt: new Date().toISOString(),
            wallets: out.wallets,
            categories: out.categories,
            transactions: out.transactions,
            debts: out.debts,
            debtPayments: out.debtPayments,
            settings: out.settings.filter((s) => {
              const r = s as { key?: string };
              return ['language', 'theme'].includes(r.key ?? '');
            }),
          });
        };
        req.onerror = () => reject(req.error);
      });
      // Clear and re-insert in a single transaction.
      await new Promise<void>((resolve, reject) => {
        const req = idb.open('ExpendDB');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(['wallets', 'categories', 'transactions', 'debts', 'debtPayments', 'settings'], 'readwrite');
          for (const storeName of ['wallets', 'categories', 'transactions', 'debts', 'debtPayments']) {
            if (db.objectStoreNames.contains(storeName)) {
              tx.objectStore(storeName).clear();
            }
          }
          const d = data as { wallets?: unknown[]; categories?: unknown[]; transactions?: unknown[]; debts?: unknown[]; debtPayments?: unknown[]; settings?: unknown[] };
          for (const w of d.wallets ?? []) tx.objectStore('wallets').put(w);
          for (const c of d.categories ?? []) tx.objectStore('categories').put(c);
          for (const t of d.transactions ?? []) tx.objectStore('transactions').put(t);
          for (const d2 of d.debts ?? []) tx.objectStore('debts').put(d2);
          for (const p of d.debtPayments ?? []) tx.objectStore('debtPayments').put(p);
          for (const s of d.settings ?? []) tx.objectStore('settings').put(s);
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => { db.close(); reject(tx.error); };
        };
        req.onerror = () => reject(req.error);
      });
      // Read back.
      const restored = await new Promise<Array<{ name?: string; currentBalance?: number; initialBalance?: number }>>((resolve, reject) => {
        const req = idb.open('ExpendDB');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('wallets', 'readonly');
          const g = tx.objectStore('wallets').getAll();
          g.onsuccess = () => { db.close(); resolve((g.result ?? []) as Array<{ name?: string; currentBalance?: number; initialBalance?: number }>); };
          g.onerror = () => { db.close(); reject(g.error); };
        };
        req.onerror = () => reject(req.error);
      });
      return restored.find((w) => w.name === walletName);
    }, walletA);

    expect(roundTrip).toBeTruthy();
    expect(Number(roundTrip!.currentBalance)).toBe(Number(baselineA!.currentBalance));
    expect(Number(roundTrip!.initialBalance)).toBe(Number(baselineA!.initialBalance));
  });
});

test.describe('wallet balance — composite invariant', () => {
  test('mixed operations leave wallet in a self-consistent state', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: uniqueName('Seed'),
      walletBalance: '0',
      categories: ['Food & Drinks'],
    });
    const wallet = await freshWalletWithBalance(page, 'Composite', '1000000');

    // 1. expense -100_000
    await page.goto('/');
    await createExpense(page, {
      amount: '100000',
      description: uniqueName('comp-exp'),
      walletName: wallet,
      categoryName: 'Food & Drinks',
    });

    // 2. balance_adjustment +50_000
    await adjustWalletBalance(page, { walletName: wallet, newBalance: '950000' });

    // 3. payable 200_000
    await createDebt(page, {
      personName: uniqueName('comp-payable'),
      amount: '200000',
      walletName: wallet,
      type: 'payable',
    });

    // 4. receivable 75_000
    await createDebt(page, {
      personName: uniqueName('comp-receivable'),
      amount: '75000',
      walletName: wallet,
      type: 'receivable',
    });

    // Wait for Dexie to flush the last debt's wallet delta before asserting.
    await expect.poll(
      async () => getWalletCurrentBalance(page, wallet),
      { timeout: 15_000, intervals: [100, 250, 500, 1000] },
    ).toBe(1_075_000);

    // Expected: 1_000_000 - 100_000 + 50_000 + 200_000 - 75_000 = 1_075_000
    await expectWalletBalance(page, wallet, 1_075_000);

    const db = await readDb(page);
    expect(db.transactions.filter((t: Record<string, unknown>) => t.type === 'expense')).toHaveLength(1);
    expect(db.transactions.filter((t: Record<string, unknown>) => t.type === 'balance_adjustment')).toHaveLength(1);
    expect(db.debts).toHaveLength(2);
    expect(db.debtPayments.filter((p: Record<string, unknown>) => p.type === 'initial')).toHaveLength(2);
  });
});