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
  it.each([
    ['BCA', 'BCA Digital', 'BCA Digital'],
    ['PLN', 'PLN', 'PLN'],
    ['BRI', 'BRI', 'BRI'],
    ['GOPAY', 'GOPAY', 'GOPAY'],
  ])('preserves %s in description', (_, input, expected) => {
    const t = `Penerima: ${input}\nTotal: Rp 50.000`;
    expect(parseReceiptText(t)!.description).toBe(expected);
  });

  // ─── Source detection ─────────────────────────────────────────────────────────
  it.each([
    ['Mandiri', 'BANK MANDIRI\nTransfer Berhasil\nPenerima: John Doe\nTotal: Rp 500.000\nTanggal: 01/09/2026', 'Mandiri'],
    ['BCA', 'BCA\nTransfer ke\nPenerima: Toko Kopi\nJumlah: Rp 100.000', 'BCA'],
    ['GoPay', 'GOPAY\nTop Up Berhasil\nNominal: Rp 50.000\nTotal: Rp 50.000', 'GoPay'],
    ['BSI', 'Bank Syariah Indonesia\nTransfer\nTotal Rp 7.500.000\nPenerima: KPR', 'BSI'],
  ])('detect %s from header', (_, text, expected) => {
    expect(parseReceiptText(text)!.source).toBe(expected);
  });
  it('prefer desc source over text scan', () => {
    const t = `MANDIRI\nTransfer via BSI\nPenerima: Budi\nTotal: Rp 200.000`;
    expect(parseReceiptText(t)!.source).toBe('BSI');
  });
  it.each([
    ['OVO', 'OVO\nTransfer Berhasil\nNominal: Rp 75.000', 'OVO'],
    ['Dana', 'DANA\nBerhasil\nRp 30.000', 'Dana'],
    ['BRI', 'BRI\nTransfer\nRp 150.000', 'BRI'],
  ])('detect %s from text', (_, text, expected) => {
    expect(parseReceiptText(text)!.source).toBe(expected);
  });

  // ─── Jago / Access By KAI receipt ─────────────────────────────────────────────
  it('skip source line, use merchant as description', () => {
    const t = `Jago\nAccess By KAI Oo\nBANDUNG\nRp790.000\n260902-PQVT-EJU2YB Sukses\nANGGIE IRAWAN\n02 Sep 2026, 08:26 WIB\nPulang Jember`;
    const r = parseReceiptText(t)!;
    expect(r.description).toBe('Access By KAI');
    expect(r.amount).toBe(790000);
    expect(r.date).toBe('2026-09-02');
    expect(r.source).toBe('Jago');
  });
  it('extract travel note from receipt', () => {
    const t = `Jago\nAccess By KAI\nRp790.000\n02 Sep 2026\nPulang Jember`;
    expect(parseReceiptText(t)!.note).toBe('Pulang Jember');
  });
  it('strip OCR noise Oo from description', () => {
    const t = `Jago\nAccess By KAI Oo\nRp790.000`;
    expect(parseReceiptText(t)!.description).toBe('Access By KAI');
  });

  // ─── SeaBank / ShopeeFood receipt ────────────────────────────────────────────
  it('prefer product line over recipient', () => {
    const t = `© seaBank\nBukti Transaksi\nRp 53.730\nKe (a) Shopee\nUsername: a.irwn\nProduct ShopeeFood\nWaktu Transaksi 01 Sep 2026, 19:16`;
    const r = parseReceiptText(t)!;
    expect(r.description).toBe('ShopeeFood');
    expect(r.amount).toBe(53730);
    expect(r.date).toBe('2026-09-01');
    expect(r.source).toBe('Sea Bank');
  });
  it('preserve mixed-case brand ShopeeFood', () => {
    const t = `SeaBank\nProduct ShopeeFood\nRp 53.730`;
    expect(parseReceiptText(t)!.description).toBe('ShopeeFood');
  });

  // ─── GoPay transfer receipt ──────────────────────────────────────────────────
  it('extract recipient from "Ditransfer ke"', () => {
    const t = `@ gopay\nRp4.627.000\nDitransfer ke Luky Dian Susanti\nblu by BCA Digital 090156918921\nTanggal 01Sep 2026\nTotal Rp4.627.000`;
    const r = parseReceiptText(t)!;
    expect(r.description).toBe('Luky Dian Susanti');
    expect(r.amount).toBe(4627000);
    expect(r.date).toBe('2026-09-01');
    expect(r.source).toBe('GoPay');
  });
  it('parse date without space: 01Sep 2026', () => {
    const t = `GoPay\nRp 10.000\nTanggal 01Sep 2026`;
    expect(parseReceiptText(t)!.date).toBe('2026-09-01');
  });
  it('detect source from header not body', () => {
    const t = `@ gopay\nRp4.627.000\nblu by BCA Digital 090156918921\nTotal Rp4.627.000`;
    expect(parseReceiptText(t)!.source).toBe('GoPay');
  });

  // ─── BCA online transfer (international format) ─────────────────────────────
  it('parse international amount IDR1,000.00', () => {
    const t = `Transfer Successful\n30 Aug 2026 10:22:06\nIDR1,000.00\nBeneficiary Name LUKY DIAN SUSANTI\nTransfer Amount IDR 1,000.00`;
    const r = parseReceiptText(t)!;
    expect(r.amount).toBe(1000);
    expect(r.date).toBe('2026-08-30');
    expect(r.description).toBe('Luky Dian Susanti');
  });
  it('skip account numbers and ref numbers', () => {
    const t = `Transfer Successful\nIDR1,000.00\nBeneficiary Account 555-514 - 5001\nReference No. OE74862C-A214-41BA\nBeneficiary Name LUKY DIAN SUSANTI`;
    expect(parseReceiptText(t)!.amount).toBe(1000);
  });
  it('strip Name label from description', () => {
    const t = `BCA\nIDR 1,000.00\nBeneficiary Name LUKY DIAN SUSANTI`;
    expect(parseReceiptText(t)!.description).toBe('Luky Dian Susanti');
  });

  // ─── Mandiri QR Transfer receipt ──────────────────────────────────────────────
  it('recipient name on next line after label', () => {
    const t = `by mandiri\nTransfer Berhasil!\n11 Agu 2026\nPenerima\nSEPTIANA ASTI BUANA\nTotal Transaksi Rp 14.500\nSender PAN 9360000812071174087`;
    const r = parseReceiptText(t)!;
    expect(r.description).toBe('Septiana Asti Buana');
    expect(r.amount).toBe(14500);
    expect(r.date).toBe('2026-08-11');
    expect(r.source).toBe('Mandiri');
  });
  it('Rp regex does not match PAN in Sender PAN', () => {
    const t = `Mandiri\nRp 14.500\nSender PAN 9360000812071174087`;
    expect(parseReceiptText(t)!.amount).toBe(14500);
  });

  // ─── Conversational share messages ──────────────────────────────────────────
  it('SeaBank share message with recipient', () => {
    const t = 'Halo, aku sudah kirim Rp4.627.000 ke Luky Dian Susanti lewat GoPay. Jangan lupa cek ya!';
    const r = parseReceiptText(t)!;
    expect(r.description).toBe('Luky Dian Susanti');
    expect(r.amount).toBe(4627000);
    expect(r.source).toBe('GoPay');
  });
  it('share message without recipient', () => {
    const t = 'Halo, aku sudah kirim Rp53.730 lewat SeaBank. Kalau kamu sudah diterima, tolong konfirmasi ya. Terima kasih!';
    const r = parseReceiptText(t)!;
    expect(r.description).toBe('Transfer');
    expect(r.amount).toBe(53730);
    expect(r.source).toBe('Sea Bank');
  });
  it('share message with suffix amount', () => {
    const t = 'halo aku sudah kirim 50rb lewat SeaBank';
    const r = parseReceiptText(t)!;
    expect(r.description).toBe('Transfer');
    expect(r.amount).toBe(50000);
    expect(r.source).toBe('Sea Bank');
  });
  it('share message with via keyword', () => {
    const t = 'Aku sudah kirim Rp100.000 ke Budi Antoni via BCA';
    const r = parseReceiptText(t)!;
    expect(r.description).toBe('Budi Antoni');
    expect(r.amount).toBe(100000);
    expect(r.source).toBe('BCA');
  });
  it('share message without source', () => {
    const t = 'Aku sudah transfer Rp100.000 ke Budi Antoni';
    const r = parseReceiptText(t)!;
    expect(r.description).toBe('Budi Antoni');
    expect(r.amount).toBe(100000);
  });
  it('receipt not mistaken as share message', () => {
    // Multi-line receipt should NOT trigger share message detection
    const t = `SeaBank\nBukti Transaksi\nRp 53.730\nProduct ShopeeFood\n01 Sep 2026`;
    const r = parseReceiptText(t)!;
    expect(r.description).toBe('ShopeeFood');
  });
});
