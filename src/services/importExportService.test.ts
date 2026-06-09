import { describe, expect, it } from 'vitest';
import { EXPORT_SCHEMA_VERSION, sanitizeCsvField, sanitizeCsvRows, validateImportData } from './importExportService';

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

  it('accepts v2 backups with debts and debt payments', () => {
    const payload = {
      ...basePayload(),
      debts: [
        {
          id: 1,
          type: 'payable',
          contactName: 'Budi',
          description: 'Loan',
          amount: 100000,
          remainingAmount: 50000,
          dueDate: '2026-06-30',
          createdAt: '2026-06-09T00:00:00.000Z',
          status: 'partial',
          walletId: 1,
          categoryId: 1,
        },
      ],
      debt_payments: [
        {
          id: 1,
          debtId: 1,
          amount: 50000,
          date: '2026-06-10',
          transactionId: 1,
        },
      ],
    };

    expect(validateImportData(payload)).toEqual([]);
  });

  it('rejects debt payments that reference missing debts', () => {
    const payload = {
      ...basePayload(),
      debts: [],
      debt_payments: [
        {
          id: 1,
          debtId: 99,
          amount: 50000,
          date: '2026-06-10',
        },
      ],
    };

    expect(validateImportData(payload)).toContain(
      "Debt payment 0: references debt ID 99 which isn't in the import.",
    );
  });

  it('rejects debts that reference missing wallets', () => {
    const payload = {
      ...basePayload(),
      debts: [
        {
          id: 1,
          type: 'receivable',
          contactName: 'Sari',
          description: 'Loan',
          amount: 100000,
          remainingAmount: 100000,
          createdAt: '2026-06-09T00:00:00.000Z',
          status: 'pending',
          walletId: 99,
        },
      ],
      debt_payments: [],
    };

    expect(validateImportData(payload)).toContain(
      "Debt 0: references wallet ID 99 which isn't in the import.",
    );
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
