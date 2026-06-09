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

  it('accepts backups with optional debt fields (ignored by validator)', () => {
    const payload = {
      ...basePayload(),
      debts: [],
      debt_payments: [],
    };

    expect(validateImportData(payload)).toEqual([]);
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
