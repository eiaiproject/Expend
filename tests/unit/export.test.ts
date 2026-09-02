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
  it('produces valid xlsx with header and rows', async () => {
    const txs: Transaction[] = [{ description: 'Kopi', amount: 25000, date: '2026-09-02', createdAt: '2026-09-02T10:00:00.000Z', source: 'GoPay' }];
    const blob = xlsxBlob(txs);
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
  it('filter handles single bound', () => {
    const txs: import('../../src/db/db').Transaction[] = [
      { description: 'A', amount: 1, date: '2026-09-01', createdAt: '2026-09-01T00:00:00.000Z' },
      { description: 'B', amount: 2, date: '2026-09-05', createdAt: '2026-09-05T00:00:00.000Z' },
    ];
    expect(filterByDate(txs, '2026-09-03')).toHaveLength(1);
    expect(filterByDate(txs, undefined, '2026-09-02')).toHaveLength(1);
  });
});
