import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeTransactionFingerprint,
  normalizeFingerprintText,
  detectDuplicateRows,
  loadExistingFingerprints,
  importCsvTransactions,
} from '@/services/csvService';
import { db } from '@/db/db';
import { sanitizeCsvField } from '@/services/importExportService';

describe('transaction fingerprint (master.md 11)', () => {
  it('normalizes description case and whitespace', () => {
    expect(normalizeFingerprintText('  Kopi   Senja ')).toBe('kopi senja');
    expect(normalizeFingerprintText('KOPI SENJA')).toBe('kopi senja');
  });

  it('same logical transaction produces the same fingerprint', () => {
    const a = computeTransactionFingerprint({ date: '2026-07-01', amount: 15000, type: 'expense', walletId: 1, description: 'Kopi Senja' });
    const b = computeTransactionFingerprint({ date: '2026-07-01', amount: 15000, type: 'expense', walletId: 1, description: 'kopi senja' });
    expect(a).toBe(b);
  });

  it('different date, amount, type or wallet changes the fingerprint', () => {
    const base = { date: '2026-07-01', amount: 15000, type: 'expense', walletId: 1, description: 'Kopi' };
    const baseFp = computeTransactionFingerprint(base);
    expect(computeTransactionFingerprint({ ...base, date: '2026-07-02' })).not.toBe(baseFp);
    expect(computeTransactionFingerprint({ ...base, amount: 16000 })).not.toBe(baseFp);
    expect(computeTransactionFingerprint({ ...base, type: 'income' })).not.toBe(baseFp);
    expect(computeTransactionFingerprint({ ...base, walletId: 2 })).not.toBe(baseFp);
    expect(computeTransactionFingerprint({ ...base, description: 'Teh' })).not.toBe(baseFp);
  });
});

describe('duplicate detection + skip (master.md 11)', () => {
  beforeEach(async () => {
    await db.transactions.clear();
  });

  it('detects rows that already exist in the DB', async () => {
    await db.transactions.add({
      walletId: 1, categoryId: 1, date: '2026-07-01', description: 'Kopi Senja', type: 'expense', amount: 15000,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    const rows = [
      { date: '2026-07-01', amount: 15000, type: 'expense', walletId: 1, description: 'kopi senja' },
      { date: '2026-07-01', amount: 15000, type: 'expense', walletId: 1, description: 'Teh Botol' },
    ];
    const duplicates = await detectDuplicateRows(rows);
    expect(duplicates).toEqual([true, false]);
  });

  it('skipDuplicates imports only new rows and reports counts', async () => {
    const make = (description: string) => ({
      walletId: 1, categoryId: 1, date: '2026-07-01', description, type: 'expense' as const, amount: 15000,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await db.transactions.add(make('Kopi Senja'));

    const report = await importCsvTransactions(
      [make('kopi senja'), make('Teh Botol')],
      { skipDuplicates: true },
    );
    expect(report.imported).toBe(1);
    expect(report.skipped).toBe(1);
    expect(report.failed).toBe(0);
    expect(await db.transactions.count()).toBe(2);
  });

  it('import anyway ignores duplicates', async () => {
    const make = (description: string) => ({
      walletId: 1, categoryId: 1, date: '2026-07-01', description, type: 'expense' as const, amount: 15000,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await db.transactions.add(make('Kopi Senja'));
    const report = await importCsvTransactions([make('kopi senja')], { skipDuplicates: false });
    expect(report.imported).toBe(1);
    expect(report.skipped).toBe(0);
    expect(await db.transactions.count()).toBe(2);
  });

  it('loadExistingFingerprints reflects the DB contents', async () => {
    await db.transactions.add({
      walletId: 1, categoryId: null, date: '2026-07-02', description: 'Gaji', type: 'income' as const, amount: 500000,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    const fingerprints = await loadExistingFingerprints();
    expect(fingerprints.has('2026-07-02|500000|income|1|gaji')).toBe(true);
  });
});

describe('formula injection guard (master.md 11)', () => {
  it('prefixes spreadsheet-formula-looking strings on import', () => {
    expect(sanitizeCsvField('=HYPERLINK("http://evil.example")')).toBe("'=HYPERLINK(\"http://evil.example\")");
    expect(sanitizeCsvField('+SUM(A1:A9)')).toBe("'+SUM(A1:A9)");
    expect(sanitizeCsvField('@cmd|/C calc')).toBe("'@cmd|/C calc");
    expect(sanitizeCsvField('Kopi Senja')).toBe('Kopi Senja');
    expect(sanitizeCsvField("'already sanitized")).toBe("'already sanitized");
  });
});
