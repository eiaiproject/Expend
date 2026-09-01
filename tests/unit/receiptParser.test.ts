import { describe, it, expect } from 'vitest';
import { parseReceiptText } from '../../src/utils/receiptParser';

describe('parseReceiptText', () => {
  it('ambil total bukan admin', () => {
    const t = `Transfer Berhasil\nNominal: Rp 50.000\nBiaya Admin: Rp 2.500\nTotal: Rp 52.500\nPenerima: Toko Kopi\nTanggal: 31/08/2026`;
    expect(parseReceiptText(t)).toMatchObject({ amount: 52500, description: 'Toko Kopi', date: '2026-08-31' });
  });
  it('date Agu', () => {
    expect(parseReceiptText('Total Rp 10.000\n31 Agu 2026\nKe: Budi')!.date).toBe('2026-08-31');
  });
  it('fallback max amount jika tanpa keyword', () => {
    expect(parseReceiptText('Rp 5.000\nRp 100.000\nhello')!.amount).toBe(100000);
  });
  it('fallback description titleCase 80', () => {
    expect(parseReceiptText('Total Rp 10.000\nhello world test')!.description).toBe('Hello World Test');
  });
  it('null jika tanpa amount', () => {
    expect(parseReceiptText('Halo dunia no number')).toBeNull();
  });
  it('date dash + penerima keyword', () => {
    const t = `Kepada: Siti\nJumlah Transfer Rp 1.500.000\nTanggal 31-08-2026`;
    expect(parseReceiptText(t)).toMatchObject({ amount: 1500000, date: '2026-08-31' });
  });
  it('abaikan no ref panjang', () => {
    const t = `Total: Rp 52.500\nNo. Ref: 123456789012\nPenerima: Budi`;
    expect(parseReceiptText(t)!.amount).toBe(52500);
  });
  it('abaikan tahun dari tanggal', () => {
    const t = `Tanggal: 31/08/2026\nTotal Rp 10.000\nKe: Ani`;
    expect(parseReceiptText(t)!.amount).toBe(10000);
  });
  it('fuzzy TotaI tetap prioritas total', () => {
    const t = `TotaI: Rp 52.500\nNominal Rp 50.000`;
    expect(parseReceiptText(t)!.amount).toBe(52500);
  });
});
