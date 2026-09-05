/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { toCSV, xlsxBlob, filterByDate, exportFilename } from '../../src/utils/export';
import type { Transaction } from '../../src/db/db';
import * as XLSX from 'xlsx';

describe('toCSV', () => {
  it('escapes comma, quote, newline and formats header', () => {
    const csv = toCSV([{ Tanggal: '2026-09-02', Deskripsi: 'Kopi, "Susu"', Jumlah: 25000, Sumber: 'GoPay', Catatan: '', Dibuat: '2026-09-02T10:00:00.000Z' }]);
    expect(csv).toBe('Tanggal,Deskripsi,Jumlah,Sumber,Catatan,Dibuat\r\n2026-09-02,"Kopi, ""Susu""",25000,GoPay,,2026-09-02T10:00:00.000Z\r\n');
  });
  it('empty rows returns header only', () => {
    expect(toCSV([])).toBe('Tanggal,Deskripsi,Jumlah,Sumber,Catatan,Dibuat\r\n');
  });
});

describe('xlsxBlob', () => {
  it('neutralizes formula cells (no executable formula from user input)', async () => {
    const txs: Transaction[] = [{ description: '=SUM(A1:A2)', amount: 10000, date: '2026-09-02', createdAt: '2026-09-02T10:00:00.000Z', source: '@evil', note: '+cmd' }];
    const blob = await xlsxBlob(txs);
    const ab = await new Response(blob).arrayBuffer();
    const wb = XLSX.read(new Uint8Array(ab), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]!]!;
    const json = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
    expect(json[0]!['Deskripsi']).toBe("'=SUM(A1:A2)");
    expect(json[0]!['Sumber']).toBe("'@evil");
    expect(json[0]!['Catatan']).toBe("'+cmd");
    // amount tetap angka, bukan string terprefix
    expect(json[0]!['Jumlah']).toBe(10000);
    // tidak ada cell bertipe formula (f) dari input pengguna
    const addrs = Object.keys(ws).filter((k) => !k.startsWith('!'));
    for (const a of addrs) {
      const cell = ws[a] as { f?: string } | undefined;
      expect(cell?.f).toBeUndefined();
    }
  });
  it('produces valid xlsx with header and rows', async () => {
    const txs: Transaction[] = [{ description: 'Kopi', amount: 25000, date: '2026-09-02', createdAt: '2026-09-02T10:00:00.000Z', source: 'GoPay' }];
    const blob = await xlsxBlob(txs);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const ab = await new Response(blob).arrayBuffer();
    const wb = XLSX.read(new Uint8Array(ab), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]!];
    const json = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
    expect(json).toHaveLength(1);
    expect(json[0]!['Deskripsi']).toBe('Kopi');
  });
});

describe('filterByDate', () => {
  it('filters inclusive range', () => {
    const txs: Transaction[] = [
      { description: 'A', amount: 1, date: '2026-09-01', createdAt: '2026-09-01T00:00:00.000Z' },
      { description: 'B', amount: 2, date: '2026-09-02', createdAt: '2026-09-02T00:00:00.000Z' },
      { description: 'C', amount: 3, date: '2026-09-03', createdAt: '2026-09-03T00:00:00.000Z' },
    ];
    expect(filterByDate(txs, '2026-09-02', '2026-09-03')).toHaveLength(2);
  });
  it('exportFilename respects range', () => {
    expect(exportFilename('csv', '2026-09-01', '2026-09-02')).toBe('expend-2026-09-01_2026-09-02.csv');
  });
});

describe('CSV formula injection', () => {
  it('prefixes cells starting with = + - @', () => {
    const csv = toCSV([{ Tanggal: '2026-09-02', Deskripsi: '=SUM(A1:A2)', Jumlah: 10000, Sumber: '+62812', Catatan: '@evil', Dibuat: '2026-09-02T00:00:00.000Z' }]);
    // OWASP: neutralisasi dengan single-quote agar Excel tidak eksekusi formula
    expect(csv).toContain("'=SUM(A1:A2)");
    expect(csv).toContain("'+62812");
    expect(csv).toContain("'@evil");
  });
  it('does not alter safe values or numeric amount', () => {
    const csv = toCSV([{ Tanggal: '2026-09-02', Deskripsi: 'Kopi', Jumlah: 25000, Sumber: 'GoPay', Catatan: '', Dibuat: '2026-09-02T00:00:00.000Z' }]);
    expect(csv).toContain('Kopi');
    expect(csv).not.toContain("'Kopi");
    expect(csv).toContain('25000');
  });
});

describe('export edge cases', () => {
  it('CSV escapes newline and CRLF', () => {
    const csv = toCSV([{ Tanggal: '2026-09-02', Deskripsi: 'A\nB', Jumlah: 10000, Sumber: '', Catatan: 'C\r\nD', Dibuat: '2026-09-02T00:00:00.000Z' }]);
    expect(csv).toContain('"A\nB"');
    expect(csv).toContain('"C\r\nD"');
  });
  it('toExportRows handles missing note/source', async () => {
    const { toExportRows } = await import('../../src/utils/export');
    const rows = toExportRows([{ description: 'Kopi', amount: 25000, date: '2026-09-02', createdAt: '2026-09-02T00:00:00.000Z' } as unknown as import('../../src/db/db').Transaction]);
    expect(rows[0]!.Sumber).toBe('');
    expect(rows[0]!.Catatan).toBe('');
  });
  it('validateDateRange rejects From after To and invalid dates', async () => {
    const { validateDateRange } = await import('../../src/utils/export');
    expect(validateDateRange(undefined, undefined)).toBeNull();
    expect(validateDateRange('', '')).toBeNull();
    expect(validateDateRange('2026-09-03', '2026-09-01')).toBe('from-after-to');
    expect(validateDateRange('2026-09-02', '2026-09-02')).toBeNull();
    expect(validateDateRange('2026-13-01', undefined)).toBe('invalid-date');
    expect(validateDateRange('01-09-2026', undefined)).toBe('invalid-date');
    expect(validateDateRange('2026-09-01', '2026-09-03')).toBeNull();
  });
  it('JSON round-trip preserves data', async () => {
    const { toJSON, parseImportJSON } = await import('../../src/utils/export');
    const txs = [{ description: 'Kopi', amount: 25000, date: '2026-09-02', createdAt: '2026-09-02T10:00:00.000Z', source: 'GoPay', note: 'pagi' } as unknown as import('../../src/db/db').Transaction];
    const json = toJSON(txs);
    const res = parseImportJSON(json);
    expect(res.ok).toBe(true);
    expect(res.transactions).toHaveLength(1);
    expect(res.transactions[0]!.description).toBe('Kopi');
    expect(res.transactions[0]!.amount).toBe(25000);
  });
  it('JSON import rejects invalid data strictly', async () => {
    const { parseImportJSON } = await import('../../src/utils/export');
    expect(parseImportJSON('bukan json').ok).toBe(false);
    expect(parseImportJSON(JSON.stringify({ version: 99, transactions: [] })).errors[0]).toMatch(/versi/);
    expect(parseImportJSON(JSON.stringify({ foo: 1 })).errors[0]).toMatch(/struktur/);
    const bad = parseImportJSON(JSON.stringify([{ description: '', amount: -5, date: '2026-13-01' }]));
    expect(bad.ok).toBe(false);
    expect(bad.skipped).toBe(1);
    const dup = parseImportJSON(JSON.stringify({ version: 1, transactions: [{ description: 'A', amount: 1000, date: '2026-09-01', createdAt: '2026-09-01T00:00:00.000Z' }, { description: 'A', amount: 1000, date: '2026-09-01', createdAt: '2026-09-01T00:00:00.000Z' }] }));
    expect(dup.transactions).toHaveLength(1);
    expect(dup.skipped).toBe(1);
    // legacy bare array tetap didukung
    const legacy = parseImportJSON(JSON.stringify([{ description: 'B', amount: 2000, date: '2026-09-02', createdAt: '2026-09-02T00:00:00.000Z' }]));
    expect(legacy.ok).toBe(true);
  });
  it('filter handles single bound', () => {
    const txs: import('../../src/db/db').Transaction[] = [
      { description: 'A', amount: 1, date: '2026-09-01', createdAt: '2026-09-01T00:00:00.000Z' },
      { description: 'B', amount: 2, date: '2026-09-05', createdAt: '2026-09-05T00:00:00.000Z' },
    ];
    expect(filterByDate(txs, '2026-09-03')).toHaveLength(1);
    expect(filterByDate(txs, undefined, '2026-09-02')).toHaveLength(1);
  });
});
