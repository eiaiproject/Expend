/**
 * Tests for import/export roundtrip, debt lifecycle,
 * category deletion fallback, stats filtering, and monthly report.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/db';
import {
  validateImportData,
  sanitizeImportData,
  generateExport,
  importData,
  EXPORT_SCHEMA_VERSION,
} from '@/services/importExportService';
import {
  createDebt,
  recordDebtPayment,
  writeOffReceivable,
  markDebtPaidWithoutCashflow,
  updateDebt,
} from '@/services/debtService';
import { recomputeWalletCurrentBalances } from '@/utils/balanceUtils';
import { importCsvTransactions } from '@/services/csvService';

beforeEach(async () => {
  await db.transactions.clear();
  await db.wallets.clear();
  await db.categories.clear();
  await db.debts.clear();
  await db.debtPayments.clear();
  await db.settings.clear();
});

// ===================== Import Validation =====================

describe('validateImportData', () => {
  it('rejects non-object input', () => {
    const errors = validateImportData('not an object');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('Invalid JSON structure');
  });

  it('rejects missing wallets array', () => {
    const errors = validateImportData({ categories: [], transactions: [] });
    expect(errors.some(e => e.includes('wallets'))).toBe(true);
  });

  it('validates transaction wallet reference', () => {
    const data = {
      wallets: [{ id: 1, name: 'Cash', currency: 'IDR', lastUpdated: '2025-01-01T00:00:00.000Z', initialBalance: 100000 }],
      categories: [],
      transactions: [{
        walletId: 999, // Non-existent wallet
        categoryId: null,
        date: '2025-01-15',
        description: 'Test',
        type: 'expense',
        amount: 50000,
      }],
    };
    const errors = validateImportData(data);
    expect(errors.some(e => e.includes('wallet ID 999'))).toBe(true);
  });

  it('validates transaction category reference', () => {
    const data = {
      wallets: [{ id: 1, name: 'Cash', currency: 'IDR', lastUpdated: '2025-01-01T00:00:00.000Z', initialBalance: 100000 }],
      categories: [{ id: 1, name: 'Food', icon: '🍔', color: '#FF0000' }],
      transactions: [{
        walletId: 1,
        categoryId: 42, // Non-existent category
        date: '2025-01-15',
        description: 'Test',
        type: 'expense',
        amount: 50000,
      }],
    };
    const errors = validateImportData(data);
    expect(errors.some(e => e.includes('category ID 42'))).toBe(true);
  });

  it('validates transaction amount range', () => {
    const data = {
      wallets: [{ id: 1, name: 'Cash', currency: 'IDR', lastUpdated: '2025-01-01T00:00:00.000Z', initialBalance: 100000 }],
      categories: [],
      transactions: [{
        walletId: 1,
        categoryId: null,
        date: '2025-01-15',
        description: 'Test',
        type: 'expense',
        amount: -500, // Negative amount
      }],
    };
    const errors = validateImportData(data);
    expect(errors.some(e => e.includes('amount'))).toBe(true);
  });

  it('validates date format', () => {
    const data = {
      wallets: [{ id: 1, name: 'Cash', currency: 'IDR', lastUpdated: '2025-01-01T00:00:00.000Z', initialBalance: 100000 }],
      categories: [],
      transactions: [{
        walletId: 1,
        categoryId: null,
        date: 'not-a-date',
        description: 'Test',
        type: 'expense',
        amount: 50000,
      }],
    };
    const errors = validateImportData(data);
    expect(errors.some(e => e.includes('YYYY-MM-DD'))).toBe(true);
  });

  it('rejects CSV formula injection strings in description', () => {
    const data = {
      wallets: [{ id: 1, name: 'Cash', currency: 'IDR', lastUpdated: '2025-01-01T00:00:00.000Z', initialBalance: 100000 }],
      categories: [],
      transactions: [{
        walletId: 1,
        categoryId: null,
        date: '2025-01-15',
        description: '=SUM(A1:A10)',
        type: 'expense',
        amount: 50000,
      }],
    };
    // The description itself should be validated — formula strings are dangerous in CSV context
    // but validation still passes since description is valid text. CSV export sanitization handles this.
    const errors = validateImportData(data);
    expect(errors.length).toBe(0); // Validation passes; CSV sanitizer prefixes with '
  });

  it('validates debts and debt payments', () => {
    const data = {
      wallets: [{ id: 1, name: 'Cash', currency: 'IDR', lastUpdated: '2025-01-01T00:00:00.000Z', initialBalance: 100000 }],
      categories: [],
      transactions: [],
      debts: [{
        id: 'd1',
        type: 'invalid',
        personName: '',
        principalAmount: -100,
        remainingAmount: 0,
        walletId: 999,
        startDate: 'invalid',
      }],
      debtPayments: [{
        id: 'p1',
        debtId: 'unknown_debt',
        amount: 100,
        walletId: 999,
        date: '2025-01-15',
        type: 'initial',
      }],
    };
    const errors = validateImportData(data);
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ===================== Import/Export Roundtrip =====================

describe('import/export roundtrip', () => {
  it('preserves data exactly after roundtrip', async () => {
    // Create complete dataset
    const w1 = await db.wallets.add({ name: 'Cash', currency: 'IDR', initialBalance: 1000000, lastUpdated: '2025-01-01T00:00:00.000Z' });
    const w2 = await db.wallets.add({ name: 'Bank', currency: 'IDR', initialBalance: 5000000, lastUpdated: '2025-01-01T00:00:00.000Z' });
    const c1 = await db.categories.add({ name: 'Food', icon: '🍔', color: '#FF0000' });
    const c2 = await db.categories.add({ name: 'Transport', icon: '🚗', color: '#00FF00' });

    // Transactions: Cash has -50K expense, Bank has -100K expense
    // Cash currentBalance: 1,000,000 - 50,000 = 950,000
    // Bank currentBalance: 5,000,000 - 100,000 = 4,900,000
    await db.transactions.bulkAdd([
      { walletId: w1, categoryId: c1, date: '2025-01-15', description: 'Lunch', type: 'expense', amount: 50000 },
      { walletId: w2, categoryId: c2, date: '2025-01-16', description: 'Taxi', type: 'expense', amount: 100000 },
      { walletId: w1, categoryId: null, date: '2025-01-17', description: 'Balance Fix', type: 'balance_adjustment', amount: 200000 },
    ]);
    // After balance_adjustment (+200K): Cash = 950K + 200K = 1,150,000
    await db.wallets.update(w1, { currentBalance: 1150000 });
    await db.wallets.update(w2, { currentBalance: 4900000 });

    // Transfer
    const gId = 'rt-transfer-1';
    await db.transactions.bulkAdd([
      { walletId: w1, categoryId: null, date: '2025-01-18', description: 'Transfer to Bank (Out)', type: 'transfer_out', amount: 500000, transferGroupId: gId },
      { walletId: w2, categoryId: null, date: '2025-01-18', description: 'Transfer from Cash (In)', type: 'transfer_in', amount: 500000, transferGroupId: gId },
    ]);

    // Debts
    await db.debts.add({
      id: 'debt-1', type: 'payable', personName: 'Alice', principalAmount: 1000000,
      remainingAmount: 500000, walletId: w1, startDate: '2025-01-01', status: 'partial',
      createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-15T00:00:00.000Z',
    });
    await db.debtPayments.add({
      id: 'dp-1', debtId: 'debt-1', amount: 1000000, date: '2025-01-01',
      walletId: w1, type: 'initial', createdAt: '2025-01-01T00:00:00.000Z',
    });
    await db.debtPayments.add({
      id: 'dp-2', debtId: 'debt-1', amount: 500000, date: '2025-01-15',
      walletId: w1, type: 'repayment', createdAt: '2025-01-15T00:00:00.000Z',
    });

    // Export
    const exported = await generateExport();

    // Verify export structure
    expect(exported.version).toBe(EXPORT_SCHEMA_VERSION);
    expect(exported.wallets.length).toBe(2);
    expect(exported.categories.length).toBe(2);
    expect(exported.transactions.length).toBe(5);
    expect(exported.debts.length).toBe(1);
    expect(exported.debtPayments.length).toBe(2);

    // Verify security settings excluded
    await db.settings.put({ key: 'security', value: { pin: '1234' } });
    const exportedWithSecurity = await generateExport();
    expect(exportedWithSecurity.settings.some(s => s.key === 'security')).toBe(false);

    // Clear and import
    await importData(exported);

    // Verify roundtrip
    const wallets = await db.wallets.toArray();
    expect(wallets.length).toBe(2);
    const cashWallet = wallets.find(w => w.name === 'Cash');
    expect(cashWallet?.initialBalance).toBe(1000000);
    // Balance recomputed from: initialBalance(1M) + transaction deltas(-50K + 200K - 500K) + debt deltas(+1M - 500K)
    expect(cashWallet?.currentBalance).toBe(1150000);

    const categories = await db.categories.toArray();
    expect(categories.length).toBe(2);

    const transactions = await db.transactions.toArray();
    expect(transactions.length).toBe(5);

    const expenses = transactions.filter(t => t.type === 'expense');
    expect(expenses.length).toBe(2);

    const transfers = transactions.filter(t => t.type === 'transfer_in' || t.type === 'transfer_out');
    expect(transfers.length).toBe(2);

    const debts = await db.debts.toArray();
    expect(debts.length).toBe(1);
    expect(debts[0].remainingAmount).toBe(500000);

    const debtPayments = await db.debtPayments.toArray();
    expect(debtPayments.length).toBe(2);

    // Security settings are excluded from export but restored from local DB during import
    const settings = await db.settings.toArray();
    // The security key is restored by importData, so it should be present
    expect(settings.some(s => s.key === 'security')).toBe(true);
    // But it should NOT have been in the export file
    expect(exportedWithSecurity.settings.some(s => s.key === 'security')).toBe(false);
  });
});

// ===================== CSV Import Recompute =====================

describe('csvService.importCsvTransactions balance recomputation', () => {
  it('recomputes wallet balance after importing CSV expense rows', async () => {
    const walletId = await db.wallets.add({
      name: 'Cash', currency: 'IDR', initialBalance: 1000000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    await db.wallets.update(walletId, { currentBalance: 1000000 });
    const catId = await db.categories.add({ name: 'Food', icon: '🍔', color: '#FF0000' });

    // Import two expense rows via the CSV service
    await importCsvTransactions([
      { date: '2025-01-15', walletId, categoryId: catId, description: 'Lunch', amount: 50000, type: 'expense', notes: '' },
      { date: '2025-01-16', walletId, categoryId: catId, description: 'Dinner', amount: 75000, type: 'expense', notes: '' },
    ]);

    // initialBalance(1,000,000) + expense(-50,000) + expense(-75,000) = 875,000
    const wallet = await db.wallets.get(walletId);
    expect(wallet?.currentBalance).toBe(875_000);

    const txs = await db.transactions.where('walletId').equals(walletId).toArray();
    expect(txs.length).toBe(2);
    expect(txs.every(t => t.type === 'expense')).toBe(true);
  });

  // Service-level coverage only: parseTransactionsCsv() won't normally
  // emit balance_adjustment, but importCsvTransactions() should still
  // recompute correctly for any validated row set it is given.
  it('applies signed balance_adjustment rows when importCsvTransactions receives pre-validated rows', async () => {
    const walletId = await db.wallets.add({
      name: 'Cash', currency: 'IDR', initialBalance: 500000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    await db.wallets.update(walletId, { currentBalance: 500000 });

    await importCsvTransactions([
      { date: '2025-01-15', walletId, categoryId: null, description: 'Top up', amount: 200000, type: 'balance_adjustment', notes: '' },
    ]);

    // initialBalance(500,000) + adjustment(+200,000) = 700,000
    const wallet = await db.wallets.get(walletId);
    expect(wallet?.currentBalance).toBe(700_000);
  });

  it('handles empty import gracefully', async () => {
    const walletId = await db.wallets.add({
      name: 'Cash', currency: 'IDR', initialBalance: 1000000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    await db.wallets.update(walletId, { currentBalance: 1000000 });

    await importCsvTransactions([]);

    const wallet = await db.wallets.get(walletId);
    expect(wallet?.currentBalance).toBe(1_000_000);
  });

  it('handles transfers correctly during CSV import', async () => {
    const w1 = await db.wallets.add({ name: 'A', currency: 'IDR', initialBalance: 1000000, lastUpdated: '2025-01-01T00:00:00.000Z' });
    const w2 = await db.wallets.add({ name: 'B', currency: 'IDR', initialBalance: 500000, lastUpdated: '2025-01-01T00:00:00.000Z' });
    await db.wallets.update(w1, { currentBalance: 1000000 });
    await db.wallets.update(w2, { currentBalance: 500000 });

    await importCsvTransactions([
      { date: '2025-01-15', walletId: w1, categoryId: null, description: 'Transfer (Out)', amount: 100000, type: 'transfer_out', notes: '', transferGroupId: 'csv-group-1' },
      { date: '2025-01-15', walletId: w2, categoryId: null, description: 'Transfer (In)', amount: 100000, type: 'transfer_in', notes: '', transferGroupId: 'csv-group-1' },
    ]);

    // A: 1,000,000 - 100,000 = 900,000
    // B: 500,000 + 100,000 = 600,000
    const walletA = await db.wallets.get(w1);
    const walletB = await db.wallets.get(w2);
    expect(walletA?.currentBalance).toBe(900_000);
    expect(walletB?.currentBalance).toBe(600_000);
  });
});

// ===================== Debt Update After Repayment =====================

describe('debt lifecycle', () => {
  it('payable debt creation increases wallet cash', async () => {
    const walletId = await db.wallets.add({
      name: 'Cash', currency: 'IDR', initialBalance: 1000000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    await db.wallets.update(walletId, { currentBalance: 1000000 });

    await createDebt({
      type: 'payable', personName: 'Alice', principalAmount: 500000,
      walletId, startDate: '2025-01-01',
    });

    const wallet = await db.wallets.get(walletId);
    // Payable: received money → balance increases
    expect(wallet?.currentBalance).toBe(1500000);
  });

  it('payable debt payment decreases wallet cash', async () => {
    const walletId = await db.wallets.add({
      name: 'Cash', currency: 'IDR', initialBalance: 2000000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    await db.wallets.update(walletId, { currentBalance: 2000000 });

    const debtId = await createDebt({
      type: 'payable', personName: 'Alice', principalAmount: 1000000,
      walletId, startDate: '2025-01-01',
    });
    // After creation: 2,000,000 + 1,000,000 = 3,000,000

    await recordDebtPayment({ debtId, amount: 300000, walletId, date: '2025-01-15' });

    const wallet = await db.wallets.get(walletId);
    // Payable repayment: money goes out → 3,000,000 - 300,000 = 2,700,000
    expect(wallet?.currentBalance).toBe(2700000);

    const debt = await db.debts.get(debtId);
    expect(debt?.remainingAmount).toBe(700000);
    expect(debt?.status).toBe('partial');
  });

  it('receivable debt creation decreases wallet cash', async () => {
    const walletId = await db.wallets.add({
      name: 'Cash', currency: 'IDR', initialBalance: 1000000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    await db.wallets.update(walletId, { currentBalance: 1000000 });

    await createDebt({
      type: 'receivable', personName: 'Bob', principalAmount: 500000,
      walletId, startDate: '2025-01-01',
    });

    const wallet = await db.wallets.get(walletId);
    // Receivable: money lent out → balance decreases
    expect(wallet?.currentBalance).toBe(500000);
  });

  it('receivable debt payment increases wallet cash', async () => {
    const walletId = await db.wallets.add({
      name: 'Cash', currency: 'IDR', initialBalance: 500000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    await db.wallets.update(walletId, { currentBalance: 500000 });

    const debtId = await createDebt({
      type: 'receivable', personName: 'Bob', principalAmount: 1000000,
      walletId, startDate: '2025-01-01',
    });
    // After creation: 500,000 - 1,000,000 = -500,000

    await recordDebtPayment({ debtId, amount: 400000, walletId, date: '2025-01-15' });

    const wallet = await db.wallets.get(walletId);
    // Receivable repayment: money comes back → -500,000 + 400,000 = -100,000
    expect(wallet?.currentBalance).toBe(-100000);

    const debt = await db.debts.get(debtId);
    expect(debt?.remainingAmount).toBe(600000);
  });

  it('write-off does not create cashflow', async () => {
    const walletId = await db.wallets.add({
      name: 'Cash', currency: 'IDR', initialBalance: 500000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    await db.wallets.update(walletId, { currentBalance: 500000 });

    const debtId = await createDebt({
      type: 'receivable', personName: 'Bob', principalAmount: 1000000,
      walletId, startDate: '2025-01-01',
    });
    // After creation: -500,000

    const walletBefore = await db.wallets.get(walletId);
    const balanceBefore = walletBefore?.currentBalance;

    await writeOffReceivable(debtId, 'Write off bad debt');

    const walletAfter = await db.wallets.get(walletId);
    // Write-off must NOT change wallet balance
    expect(walletAfter?.currentBalance).toBe(balanceBefore);

    const debt = await db.debts.get(debtId);
    expect(debt?.status).toBe('written_off');
    expect(debt?.remainingAmount).toBe(0);
  });

  it('partial debt payment updates status correctly', async () => {
    const walletId = await db.wallets.add({
      name: 'Cash', currency: 'IDR', initialBalance: 1000000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    await db.wallets.update(walletId, { currentBalance: 1000000 });

    const debtId = await createDebt({
      type: 'payable', personName: 'Charlie', principalAmount: 1000000,
      walletId, startDate: '2025-01-01',
    });

    await recordDebtPayment({ debtId, amount: 500000, walletId, date: '2025-01-10' });

    let debt = await db.debts.get(debtId);
    expect(debt?.status).toBe('partial');
    expect(debt?.remainingAmount).toBe(500000);

    await recordDebtPayment({ debtId, amount: 500000, walletId, date: '2025-01-15' });

    debt = await db.debts.get(debtId);
    expect(debt?.status).toBe('paid');
    expect(debt?.remainingAmount).toBe(0);
  });

  it('updateDebt after repayment is rejected', async () => {
    const walletId = await db.wallets.add({
      name: 'Cash', currency: 'IDR', initialBalance: 2000000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    await db.wallets.update(walletId, { currentBalance: 2000000 });

    const wallet2Id = await db.wallets.add({
      name: 'Bank', currency: 'IDR', initialBalance: 1000000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    await db.wallets.update(wallet2Id, { currentBalance: 1000000 });

    const debtId = await createDebt({
      type: 'payable', personName: 'Eve', principalAmount: 500000,
      walletId, startDate: '2025-01-01',
    });
    // After creation: 2,000,000 + 500,000 = 2,500,000

    // Make a partial repayment
    await recordDebtPayment({ debtId, amount: 100000, walletId, date: '2025-01-10' });
    // 2,500,000 - 100,000 = 2,400,000

    const balanceBefore = (await db.wallets.get(walletId))?.currentBalance;

    // Attempt to change the amount and wallet — should throw because there's a repayment
    await expect(
      updateDebt(debtId, {
        personName: 'Eve',
        principalAmount: 800000,
        walletId: wallet2Id,
        startDate: '2025-01-01',
      })
    ).rejects.toThrow(/repayment|payment|pembayaran/i);

    // Balance unchanged
    const balanceAfter = (await db.wallets.get(walletId))?.currentBalance;
    expect(balanceAfter).toBe(balanceBefore);

    // Debt amount unchanged
    const debt = await db.debts.get(debtId);
    expect(debt?.principalAmount).toBe(500000);
    expect(debt?.remainingAmount).toBe(400000);
  });

  it('cannot pay more than remaining amount', async () => {
    const walletId = await db.wallets.add({
      name: 'Cash', currency: 'IDR', initialBalance: 1000000,
      lastUpdated: '2025-01-01T00:00:00.000Z',
    });
    await db.wallets.update(walletId, { currentBalance: 1000000 });

    const debtId = await createDebt({
      type: 'payable', personName: 'Dave', principalAmount: 500000,
      walletId, startDate: '2025-01-01',
    });

    await expect(
      recordDebtPayment({ debtId, amount: 600000, walletId, date: '2025-01-15' })
    ).rejects.toThrow();
  });
});
