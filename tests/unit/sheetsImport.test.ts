/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  parseSheetsCSV,
  parseSheetsDateCell,
  parseSheetsAmountCell,
  parseSheetsSourceCell,
  parseCSVRows,
} from '../../src/utils/sheetsImport';

const BOT_CSV =
  '\uFEFF"Tanggal","Penerima","Nominal","Sumber Dana","Catatan","ID","Input","Status"\n' +
  '"2026-09-15","Kopi Susu","25000","GoPay","untuk rapat","T0001","Teks","OK"\n' +
  '"2026-09-16","Nasi Goreng","35000","","","T0002","Teks","Perlu dicek"\n';

describe('parseCSVRows', () => {
  it('menghormati quote koma/kutip dan CRLF', () => {
    const rows = parseCSVRows('"a","Kopi, ""Susu"""\r\n"2026-09-01","B"\r\n');
    expect(rows[0]).toEqual(['a', 'Kopi, "Susu"']);
    expect(rows[1]).toEqual(['2026-09-01', 'B']);
  });
});

describe('parseSheetsDateCell', () => {
  it('ISO lolos, serial Excel dikonversi, tampil Sheets diparse', () => {
    expect(parseSheetsDateCell('2026-09-15')).toBe('2026-09-15');
    expect(parseSheetsDateCell('2026-13-01')).toBeNull();
    // 46266 = 2026-09-01 (epoch 1899-12-30 UTC)
    expect(parseSheetsDateCell('46266.79166666667')).toBe('2026-09-01');
    expect(parseSheetsDateCell('15 Sep 2026')).toBe('2026-09-15');
    expect(parseSheetsDateCell('15/09/2026')).toBe('2026-09-15');
    expect(parseSheetsDateCell('')).toBeNull();
  });
});

describe('parseSheetsAmountCell', () => {
  it('polos, ribu ID, desimal koma, prefix Rp, guard formula', () => {
    expect(parseSheetsAmountCell('25000')).toBe(25000);
    expect(parseSheetsAmountCell('14.603')).toBe(14603);
    expect(parseSheetsAmountCell('14,603')).toBe(14603);
    expect(parseSheetsAmountCell('14603,0')).toBe(14603);
    expect(parseSheetsAmountCell('Rp 25.000')).toBe(25000);
    expect(parseSheetsAmountCell("'=SUM(A1)")).toBeNull();
    expect(parseSheetsAmountCell('0')).toBeNull();
    expect(parseSheetsAmountCell('-5')).toBeNull();
    expect(parseSheetsAmountCell('abc')).toBeNull();
  });
});

describe('parseSheetsSourceCell', () => {
  it('dikenal → kanonis, kosong/asing → undefined (dihilangkan)', () => {
    expect(parseSheetsSourceCell('GoPay')).toBe('GoPay');
    expect(parseSheetsSourceCell('  bsi  ')).toBe('BSI');
    expect(parseSheetsSourceCell('')).toBeUndefined();
    expect(parseSheetsSourceCell('Belum diisi')).toBeUndefined();
    expect(parseSheetsSourceCell('Kasbon Warung')).toBeUndefined();
    // Mengandung nama bank dikenal → kanonis (bukan dihilangkan)
    expect(parseSheetsSourceCell('Kartu Kredit Mandiri')).toBe('Mandiri');
  });
});

describe('parseSheetsCSV', () => {
  it('CSV /export bot: 5 kolom dipakai, ID/Input/Status dibuang, Perlu dicek ikut', () => {
    const res = parseSheetsCSV(BOT_CSV);
    expect(res.ok).toBe(true);
    expect(res.transactions).toHaveLength(2);
    expect(res.transactions[0]).toMatchObject({
      description: 'Kopi Susu',
      amount: 25000,
      date: '2026-09-15',
      source: 'GoPay',
      note: 'untuk rapat',
    });
    // Baris Perlu dicek ikut masuk dengan source kosong
    expect(res.transactions[1]).toMatchObject({
      description: 'Nasi Goreng',
      amount: 35000,
      date: '2026-09-16',
    });
    expect(res.transactions[1]!.source).toBeUndefined();
    expect(res.skipped).toBe(0);
  });

  it('urutan kolom acak + header Expend-ID tetap terbaca', () => {
    const csv =
      'Catatan,Jumlah,Deskripsi,Tanggal,Sumber\n' +
      '"x",25000,"Kopi","2026-09-15","Tunai"\n';
    const res = parseSheetsCSV(csv);
    expect(res.ok).toBe(true);
    expect(res.transactions[0]).toMatchObject({ description: 'Kopi', amount: 25000, date: '2026-09-15', source: 'Tunai', note: 'x' });
  });

  it('baris rusak di-skip dengan alasan, duplikat dalam-file di-skip', () => {
    const csv =
      'Tanggal,Penerima,Nominal,Sumber Dana,Catatan\n' +
      '2026-09-15,Kopi,25000,GoPay,\n' +
      '2026-09-15,Kopi,25000,GoPay,\n' +
      'bukan-tanggal,Kopi,25000,GoPay,\n' +
      '2026-09-15,,25000,GoPay,\n' +
      '2026-09-15,Teh,nol,GoPay,\n';
    const res = parseSheetsCSV(csv);
    expect(res.ok).toBe(true);
    expect(res.transactions).toHaveLength(1);
    expect(res.skipped).toBe(4);
    expect(res.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('header tak dikenal dan file kosong ditolak', () => {
    expect(parseSheetsCSV('foo,bar\n1,2\n').ok).toBe(false);
    expect(parseSheetsCSV('foo,bar\n1,2\n').errors[0]).toMatch(/header/);
    expect(parseSheetsCSV('   ').ok).toBe(false);
    expect(parseSheetsCSV('Tanggal,Penerima,Nominal\n').ok).toBe(false);
  });
});
