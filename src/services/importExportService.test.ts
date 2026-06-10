import { describe, expect, it } from 'vitest';
import { recomputeWalletCurrentBalances } from '../utils/balanceUtils';
import {
  EXPORT_SCHEMA_VERSION,
  sanitizeCsvField,
  sanitizeCsvRows,
  sanitizeImportData,
  validateImportData,
} from './importExportService';

function basePayload() {
  return {
    version: EXPORT_SCHEMA_VERSION,
    exportedAt: '2026-06-09T00:00:00.000Z',
    wallets: [
      {
        id: 1,
        name: 'Cash',
        currency: 'IDR',
        lastUpdated: '2026-06-09',
        initialBalance: 100000,
      },
    ],
    categories: [
      {
        id: 1,
        name: 'Food',
        icon: 'utensils',
        color: '#EF4444',
      },
    ],
    transactions: [
      {
        id: 1,
        walletId: 1,
        categoryId: 1,
        date: '2026-06-09',
        description: 'Lunch',
        type: 'expense',
        amount: 25000,
      },
    ],
    settings: [],
  };
}

describe('import/export schema validation', () => {
  it('keeps legacy backups without debt tables valid', () => {
    const payload = {
      ...basePayload(),
      version: '1.0',
    };

    expect(validateImportData(payload)).toEqual([]);
  });

  it('accepts backups with empty optional debt fields', () => {
    const payload = {
      ...basePayload(),
      debts: [],
      debt_payments: [],
    };

    expect(validateImportData(payload)).toEqual([]);
  });

  it('validates debt records and debt payments when present', () => {
    const payload = {
      ...basePayload(),
      debts: [
        {
          id: 'debt_1',
          type: 'receivable',
          personName: 'Budi',
          principalAmount: 500000,
          remainingAmount: 300000,
          walletId: 1,
          startDate: '2026-06-09',
          dueDate: '2026-06-20',
          status: 'partial',
          createdAt: '2026-06-09T00:00:00.000Z',
          updatedAt: '2026-06-10T00:00:00.000Z',
        },
      ],
      debtPayments: [
        {
          id: 'payment_1',
          debtId: 'debt_1',
          amount: 500000,
          date: '2026-06-09',
          walletId: 1,
          type: 'initial',
          createdAt: '2026-06-09T00:00:00.000Z',
        },
      ],
    };

    expect(validateImportData(payload)).toEqual([]);
  });

  it('rejects malformed debt table fields', () => {
    const payload = {
      ...basePayload(),
      debts: {},
      debtPayments: [],
    };

    const errors = validateImportData(payload);

    expect(errors.some(error => error.includes('Invalid "debts" array'))).toBe(true);
  });

  it('rejects extreme values and invalid strict date strings', () => {
    const payload = basePayload();
    payload.wallets[0]!.name = 'x'.repeat(81);
    payload.transactions[0]!.date = '2026-99-99';
    payload.transactions[0]!.description = 'x'.repeat(161);
    payload.transactions[0]!.amount = Number.MAX_VALUE;

    const errors = validateImportData(payload);

    expect(errors.some(error => error.includes('Wallet 0: "name"'))).toBe(true);
    expect(errors.some(error => error.includes('Transaction 0: "date"'))).toBe(true);
    expect(errors.some(error => error.includes('Transaction 0: "description"'))).toBe(true);
    expect(errors.some(error => error.includes('Transaction 0: "amount"'))).toBe(true);
  });

  it('strips unknown fields and security settings before import', () => {
    const payload = {
      ...basePayload(),
      wallets: [
        {
          ...basePayload().wallets[0],
          currentBalance: 999999,
          unexpected: 'remove me',
        },
      ],
      transactions: [
        {
          ...basePayload().transactions[0],
          unexpected: 'remove me too',
        },
      ],
      settings: [
        { key: 'security', value: { enabled: true, pinHash: 'stolen' } },
        { key: 'lockout_record', value: { attempts: 10, lockoutUntil: Date.now() + 1000 } },
        { key: 'theme', value: 'dark' },
      ],
    };

    const sanitized = sanitizeImportData(payload);

    expect('unexpected' in sanitized.wallets[0]!).toBe(false);
    expect('unexpected' in sanitized.transactions[0]!).toBe(false);
    expect(sanitized.wallets[0]!.currentBalance).toBeUndefined();
    expect(sanitized.settings).toEqual([{ key: 'theme', value: 'dark' }]);
  });

  it('recomputes wallet currentBalance from imported transactions', () => {
    const wallets = [
      {
        id: 1,
        name: 'Cash',
        currency: 'IDR',
        lastUpdated: '2026-06-09',
        initialBalance: 100000,
        currentBalance: 999999,
      },
      {
        id: 2,
        name: 'Bank',
        currency: 'IDR',
        lastUpdated: '2026-06-09',
        initialBalance: 250000,
      },
    ];
    const transactions = [
      {
        id: 1,
        walletId: 1,
        categoryId: 1,
        date: '2026-06-09',
        description: 'Lunch',
        type: 'expense' as const,
        amount: 25000,
      },
      {
        id: 2,
        walletId: 1,
        categoryId: null,
        date: '2026-06-09',
        description: 'Move out',
        type: 'transfer_out' as const,
        amount: 10000,
      },
      {
        id: 3,
        walletId: 2,
        categoryId: null,
        date: '2026-06-09',
        description: 'Move in',
        type: 'transfer_in' as const,
        amount: 10000,
      },
    ];

    const recomputed = recomputeWalletCurrentBalances(wallets, transactions);

    expect(recomputed[0]!.currentBalance).toBe(65000);
    expect(recomputed[1]!.currentBalance).toBe(260000);
  });
});

describe('CSV export sanitization', () => {
  it('escapes string values that spreadsheet apps may treat as formulas', () => {
    expect(sanitizeCsvField('=IMPORTXML("https://example.com")')).toBe('\'=IMPORTXML("https://example.com")');
    expect(sanitizeCsvField('+SUM(1,2)')).toBe("'+SUM(1,2)");
    expect(sanitizeCsvField('-10+20')).toBe("'-10+20");
    expect(sanitizeCsvField('@cmd')).toBe("'@cmd");
    expect(sanitizeCsvField('  =SUM(1,2)')).toBe("'  =SUM(1,2)");
  });

  it('keeps non-string fields and safe strings unchanged', () => {
    expect(sanitizeCsvField(100000)).toBe(100000);
    expect(sanitizeCsvField('Lunch')).toBe('Lunch');
  });

  it('sanitizes rows without mutating numeric amounts', () => {
    const rows = sanitizeCsvRows([
      { description: '=formula', amount: 100000, notes: 'safe' },
    ]);

    expect(rows[0]).toEqual({
      description: "'=formula",
      amount: 100000,
      notes: 'safe',
    });
  });
});
