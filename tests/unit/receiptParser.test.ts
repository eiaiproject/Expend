import { describe, it, expect } from 'vitest';
import { parseReceiptText } from '../../src/utils/receiptParser';

describe('parseReceiptText', () => {
  // ─── Amount extraction ────────────────────────────────────────────────────────
  it('ambil total bukan admin', () => {
    const t = `Transfer Berhasil\nNominal: Rp 50.000\nBiaya Admin: Rp 2.500\nTotal: Rp 52.500\nPenerima: Toko Kopi\nTanggal: 31/08/2026`;
    expect(parseReceiptText(t)).toMatchObject({ amount: 52500, description: 'Toko Kopi', date: '2026-08-31' });
  });
  it('fallback max amount jika tanpa keyword', () => {
    expect(parseReceiptText('Rp 5.000\nRp 100.000\nhello')!.amount).toBe(100000);
  });
  it('fuzzy TotaI tetap prioritas total', () => {
    const t = `TotaI: Rp 52.500\nNominal Rp 50.000`;
    expect(parseReceiptText(t)!.amount).toBe(52500);
  });
  it('abaikan no ref panjang', () => {
    const t = `Total: Rp 52.500\nNo. Ref: 123456789012\nPenerima: Budi`;
    expect(parseReceiptText(t)!.amount).toBe(52500);
  });
  it('abaikan tahun dari tanggal', () => {
    const t = `Tanggal: 31/08/2026\nTotal Rp 10.000\nKe: Ani`;
    expect(parseReceiptText(t)!.amount).toBe(10000);
  });
  it('null jika tanpa amount', () => {
    expect(parseReceiptText('Halo dunia no number')).toBeNull();
  });

  // ─── Decimal handling ─────────────────────────────────────────────────────────
  it('decimal with comma: Rp 15.500,50', () => {
    expect(parseReceiptText('Total: Rp 15.500,50\nPenerima: Toko')!.amount).toBe(15500.5);
  });
  it('decimal with dot: Rp 15.50', () => {
    // "15.50" → dot is decimal (2 digits after last dot)
    expect(parseReceiptText('Total: Rp 15.50\nPenerima: Toko')!.amount).toBe(15.5);
  });
  it('thousand separator: Rp 1.500.000', () => {
    expect(parseReceiptText('Total: Rp 1.500.000\nPenerima: Toko')!.amount).toBe(1500000);
  });

  // ─── Date extraction ──────────────────────────────────────────────────────────
  it('date Agu', () => {
    expect(parseReceiptText('Total Rp 10.000\n31 Agu 2026\nKe: Budi')!.date).toBe('2026-08-31');
  });
  it('date dash + penerima keyword', () => {
    const t = `Kepada: Siti\nJumlah Transfer Rp 1.500.000\nTanggal 31-08-2026`;
    expect(parseReceiptText(t)).toMatchObject({ amount: 1500000, date: '2026-08-31' });
  });

  // ─── Description extraction ───────────────────────────────────────────────────
  it('fallback description titleCase 80', () => {
    expect(parseReceiptText('Total Rp 10.000\nhello world test')!.description).toBe('Hello World Test');
  });
  it('penerima dengan ekor dash dan rekening', () => {
    const t = `Penerima: Toko Kopi - BCA Digital - 1234567890\nTotal: Rp 52.500`;
    expect(parseReceiptText(t)!.description).toBe('Toko Kopi');
  });
  it('penerima tanpa colon', () => {
    const t = `Penerima John Doe\nTotal Rp 10.000`;
    expect(parseReceiptText(t)!.description).toBe('John Doe');
  });
  it('penerima dengan kurung dan caps', () => {
    const t = `Penerima: BUDI SANTOSO (BCA 1234567890)\nTotal Rp 20.000`;
    expect(parseReceiptText(t)!.description).toBe('Budi Santoso');
  });

  // ─── Acronym preservation ─────────────────────────────────────────────────────
  it('preserves BCA in description', () => {
    const t = `Penerima: BCA Digital\nTotal: Rp 50.000`;
    expect(parseReceiptText(t)!.description).toBe('BCA Digital');
  });
  it('preserves PLN in description', () => {
    const t = `Penerima: PLN\nTotal: Rp 200.000`;
    expect(parseReceiptText(t)!.description).toBe('PLN');
  });
  it('preserves BRI in description', () => {
    const t = `Penerima: BRI\nTotal: Rp 100.000`;
    expect(parseReceiptText(t)!.description).toBe('BRI');
  });
  it('preserves GOPAY in description', () => {
    const t = `Penerima: GOPAY\nTotal: Rp 50.000`;
    expect(parseReceiptText(t)!.description).toBe('GOPAY');
  });

  // ─── Source detection ─────────────────────────────────────────────────────────
  it('detect Mandiri from header', () => {
    const t = `BANK MANDIRI\nTransfer Berhasil\nPenerima: John Doe\nTotal: Rp 500.000\nTanggal: 01/09/2026`;
    expect(parseReceiptText(t)!.source).toBe('Mandiri');
  });
  it('detect BCA from header', () => {
    const t = `BCA\nTransfer ke\nPenerima: Toko Kopi\nJumlah: Rp 100.000`;
    expect(parseReceiptText(t)!.source).toBe('BCA');
  });
  it('detect GoPay from text', () => {
    const t = `GOPAY\nTop Up Berhasil\nNominal: Rp 50.000\nTotal: Rp 50.000`;
    expect(parseReceiptText(t)!.source).toBe('GoPay');
  });
  it('detect BSI from header', () => {
    const t = `Bank Syariah Indonesia\nTransfer\nTotal Rp 7.500.000\nPenerima: KPR`;
    expect(parseReceiptText(t)!.source).toBe('BSI');
  });
  it('prefer desc source over text scan', () => {
    const t = `MANDIRI\nTransfer via BSI\nPenerima: Budi\nTotal: Rp 200.000`;
    expect(parseReceiptText(t)!.source).toBe('BSI');
  });
  it('detect OVO from text', () => {
    const t = `OVO\nTransfer Berhasil\nNominal: Rp 75.000`;
    expect(parseReceiptText(t)!.source).toBe('OVO');
  });
  it('detect Dana from text', () => {
    const t = `DANA\nBerhasil\nRp 30.000`;
    expect(parseReceiptText(t)!.source).toBe('Dana');
  });
  it('detect BRI from text', () => {
    const t = `BRI\nTransfer\nRp 150.000`;
    expect(parseReceiptText(t)!.source).toBe('BRI');
  });
});
