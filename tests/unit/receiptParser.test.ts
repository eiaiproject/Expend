import { describe, it, expect } from 'vitest';
import { parseReceiptText } from '../../src/utils/receiptParser';
import { detectSource } from '../../src/utils/sources';

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
  it('debris "Nama Ac r" + FINPAY falls back to merchant', () => {
    const t = `Jago\nAccess By KAI Oo\nRp790.000\n02 Sep 2026, 08:26 WIB\nNama Ac r\nFINPAY\nBiaya\nGratis\nPulang Jember`;
    const r = parseReceiptText(t)!;
    expect(r.description).toBe('Access By KAI');
    expect(r.amount).toBe(790000);
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
  it('missing recipient block never yields "Pan"', () => {
    const t = `( .. eo\nby mandiri\nQR Transfer\nTransfer Berhasil!\n09 Sep 2026 : 16:08:40 WIB - No. Ref. 609098405206\nBank Mandiri - -........7056\nDetail Transaksi\nTotal Transaksi Rp 9.300\nBeneficiary PAN 9360000812116970564\nSender PAN 9360000812071174087`;
    const r = parseReceiptText(t)!;
    expect(r.description).not.toBe('Pan');
    expect(r.description).toBe('QR Transfer');
    expect(r.amount).toBe(9300);
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

// ─── Perbaikan daftar-temuan-parser.md ────────────────────────────────────────

describe('parseReceiptText - temuan 1.2 kata umum dana', () => {
  it('lowercase "dana" (kata benda) bukan e-wallet', () => {
    const t = `Transfer Berhasil\nTotal: Rp 52.500\ndana darurat\nPenerima: Budi`;
    expect(parseReceiptText(t)?.source).toBeUndefined();
  });
  it('ALL-CAPS DANA tetap e-wallet', () => {
    expect(detectSource('DANA\nBerhasil\nRp 30.000')).toBe('Dana');
  });
});

describe('sources - temuan 1.3 & 1.4', () => {
  it('OCBC Niaga tanpa aksen terdeteksi', () => {
    expect(detectSource('OCBC Niaga\nTransfer\nRp 100.000')).toBe('OCBC');
  });
  it('OCBC Níaga beraksen tetap terdeteksi', () => {
    expect(detectSource('OCBC Níaga\nTransfer\nRp 100.000')).toBe('OCBC');
  });
  it('Maybank/HSBC/DBS/ICBC tidak cocok sebagai sub-string kata lain', () => {
    expect(detectSource('xmaybankx 100rb')).toBeUndefined();
    expect(detectSource('xhsbcx 100rb')).toBeUndefined();
    expect(detectSource('xdbsx 100rb')).toBeUndefined();
    expect(detectSource('xicbcx 100rb')).toBeUndefined();
  });
  it('Maybank/HSBC/DBS/ICBC utuh tetap cocok', () => {
    expect(detectSource('Maybank\nRp 100.000')).toBe('Maybank');
    expect(detectSource('HSBC\nRp 100.000')).toBe('HSBC');
    expect(detectSource('DBS\nRp 100.000')).toBe('DBS');
    expect(detectSource('ICBC\nRp 100.000')).toBe('ICBC');
  });
});

describe('parseReceiptText - temuan 4.1 nomor ref dengan Rp', () => {
  it('nomor ref pada baris ber-Rp tetap di-skip', () => {
    const t = `No. Ref: Rp 982341234\nTotal: Rp 52.500\nPenerima: Budi`;
    expect(parseReceiptText(t)!.amount).toBe(52500);
  });
});

describe('parseReceiptText - temuan 4.2 huruf OCR', () => {
  it('kata berhuruf O/I/L tidak dibaca sebagai angka', () => {
    const t = `TOTAL O.OO\nINDRA\nTotal: Rp 52.500\nPenerima: Budi`;
    const r = parseReceiptText(t)!;
    expect(r.amount).toBe(52500);
    expect(Number.isNaN(r.amount)).toBe(false);
  });
  it('teks tanpa digit sama sekali → null', () => {
    expect(parseReceiptText('Halo O.OO dan INDRA')).toBeNull();
  });
});

describe('parseReceiptText - temuan 4.3 tier vs bare', () => {
  it('angka Rp menang walau lebih kecil dari angka polos', () => {
    const t = `100.000\nRp 50.000\nPenerima: Budi`;
    expect(parseReceiptText(t)!.amount).toBe(50000);
  });
});

describe('parseReceiptText - temuan 4.4 potongan dari/via', () => {
  it('nama dengan kata "dari" bukan sumber tidak terpotong', () => {
    const t = `Total Rp 20.000\nPenerima: Nasi Goreng Dari Abang`;
    expect(parseReceiptText(t)!.description).toBe('Nasi Goreng dari Abang');
  });
  it('klausa sumber sungguhan tetap dipotong', () => {
    const t = `Total Rp 20.000\nPenerima: Toko Kopi dari BCA`;
    expect(parseReceiptText(t)!.description).toBe('Toko Kopi');
  });
});

describe('parseReceiptText - temuan 5.2 tanggal OCR menempel', () => {
  it('01Sep2026 tanpa spasi', () => {
    const t = `Total Rp 10.000\nKe: Budi\n01Sep2026`;
    expect(parseReceiptText(t)!.date).toBe('2026-09-01');
  });
  it('15Agustus2026 tanpa spasi', () => {
    const t = `Total Rp 10.000\nKe: Budi\n15Agustus2026`;
    expect(parseReceiptText(t)!.date).toBe('2026-08-15');
  });
  it('01Sep 2026 (spasi) tetap berfungsi', () => {
    const t = `Total Rp 10.000\nKe: Budi\n01Sep 2026`;
    expect(parseReceiptText(t)!.date).toBe('2026-09-01');
  });
});
