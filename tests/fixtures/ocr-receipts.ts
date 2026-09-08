/**
 * Dataset OCR multi-bank untuk regression test receiptParser.
 * Setiap entri = satu format resi/notifikasi transfer dari bank/e-wallet
 * Indonesia (teks hasil OCR), beserta hasil parse yang diharapkan.
 *
 * Guna: menjamin perubahan parser (regex/skor/deskripsi) tidak memecah format
 * nyata dari berbagai bank. Tambahkan format baru di sini + assert minimal:
 * amount, description, source, date (bila ada di teks).
 */
export interface OcrReceiptFixture {
  /** Nama bank/e-wallet & skenario (dipakai sebagai label test). */
  name: string;
  /** Teks OCR mentah (persis seperti output Tesseract). */
  text: string;
  expected: {
    amount: number;
    description?: string;
    source?: string;
    date?: string;
    note?: string;
  };
}

export const OCR_RECEIPTS: OcrReceiptFixture[] = [
  // ─── Transfer bank: total + admin ───────────────────────────────────────────
  {
    name: 'transfer umum: total bukan admin (Mandiri-style)',
    text: [
      'Transfer Berhasil',
      'Nominal: Rp 50.000',
      'Biaya Admin: Rp 2.500',
      'Total: Rp 52.500',
      'Penerima: Toko Kopi',
      'Tanggal: 31/08/2026',
    ].join('\n'),
    expected: { amount: 52500, description: 'Toko Kopi', source: undefined, date: '2026-08-31' },
  },
  {
    name: 'BSI KPR dari header',
    text: [
      'Bank Syariah Indonesia',
      'Transfer',
      'Total Rp 7.500.000',
      'Penerima: KPR',
      'Tanggal: 01/09/2026',
    ].join('\n'),
    expected: { amount: 7500000, description: 'KPR', source: 'BSI', date: '2026-09-01' },
  },
  {
    name: 'BCA: beneficiary + IDR internasional',
    text: [
      'BCA',
      'Transfer Successful',
      '30 Aug 2026 10:22:06',
      'IDR1,000.00',
      'Beneficiary Name LUKY DIAN SUSANTI',
      'Transfer Amount IDR 1,000.00',
    ].join('\n'),
    expected: { amount: 1000, description: 'Luky Dian Susanti', source: 'BCA', date: '2026-08-30' },
  },
  {
    name: 'BCA: sender line "Dari <rekening> a.n." bukan sumber',
    text: [
      'BCA',
      '30 Agu 2026 10:22:06',
      'Rp 1.000.000,00',
      'Dari 1234567890 a.n. BUDI SANTOSO',
      'Berhasil',
    ].join('\n'),
    expected: { amount: 1000000, source: 'BCA', date: '2026-08-30' },
  },
  {
    name: 'BRI SMS transfer masuk',
    text: [
      'BRI',
      'Transfer Masuk',
      'Rp 500.000',
      'Dari ANDI (Bank BRI)',
      'Berhasil',
    ].join('\n'),
    expected: { amount: 500000, source: 'BRI', date: undefined },
  },
  {
    name: 'Mandiri QR: penerima di baris setelah label',
    text: [
      'by mandiri',
      'Transfer Berhasil!',
      '11 Agu 2026',
      'Penerima',
      'SEPTIANA ASTI BUANA',
      'Total Transaksi Rp 14.500',
      'Sender PAN 9360000812071174087',
    ].join('\n'),
    expected: { amount: 14500, description: 'Septiana Asti Buana', source: 'Mandiri', date: '2026-08-11' },
  },
  {
    name: 'Mandiri klik: merchant PLN + referensi',
    text: [
      'Mandiri',
      'Pembayaran Berhasil',
      'Rp 150.000',
      'Merchant: PLN',
      'Referensi: 9876543210',
      'Tanggal: 05/09/2026',
    ].join('\n'),
    expected: { amount: 150000, source: 'Mandiri', date: '2026-09-05' },
  },

  // ─── E-wallet ───────────────────────────────────────────────────────────────
  {
    name: 'OVO: kirim ke penerima',
    text: [
      'OVO',
      'Transfer Berhasil',
      'Rp 100.000',
      'Kepada: Budi Setiawan',
      'Tanggal 01 Sep 2026 08:12 WIB',
      'No. Ref: 1234567890',
    ].join('\n'),
    expected: { amount: 100000, description: 'Budi Setiawan', source: 'OVO', date: '2026-09-01' },
  },
  {
    name: 'DANA: saldo tidak boleh menang atas nominal',
    text: [
      'DANA',
      'Berhasil',
      'Rp 250.000',
      'Ke Budi Antoni',
      'Saldo Rp 1.000.000',
      'Tanggal 02 Sep 2026',
    ].join('\n'),
    expected: { amount: 250000, description: 'Budi Antoni', source: 'Dana', date: '2026-09-02' },
  },
  {
    name: 'ShopeePay: penerima via a.n. setelah no HP',
    text: [
      'ShopeePay',
      'Berhasil',
      'Rp 50.000',
      'Dikirim ke 081234567890 a.n. SITI AMINAH',
      'Tanggal 03 Sep 2026',
    ].join('\n'),
    expected: { amount: 50000, description: 'Siti Aminah', source: 'ShopeePay', date: '2026-09-03' },
  },
  {
    name: 'LinkAja: "Ke <hp>" lalu "Nama:" di baris berikutnya',
    text: [
      'LinkAja',
      'Transfer Berhasil',
      'Rp 75.000',
      'Ke 081234567890',
      'Nama: JOKO WIDODO',
      'Tanggal 04 Sep 2026',
    ].join('\n'),
    expected: { amount: 75000, description: 'Joko Widodo', source: 'LinkAja', date: '2026-09-04' },
  },
  {
    name: 'GoPay: Ditransfer ke (resi panjang)',
    text: [
      '@ gopay',
      'Rp4.627.000',
      'Ditransfer ke Luky Dian Susanti',
      'blu by BCA Digital 090156918921',
      'Tanggal 01Sep 2026',
      'Total Rp4.627.000',
    ].join('\n'),
    expected: { amount: 4627000, description: 'Luky Dian Susanti', source: 'GoPay', date: '2026-09-01' },
  },

  // ─── Kasus tanpa Rp (OCR menghilangkan simbol) ──────────────────────────────
  {
    name: 'Total tanpa Rp (dengan titik ribuan)',
    text: [
      'Transfer Berhasil',
      'Penerima: Toko Maju',
      'Total 100.000',
      'Biaya Admin 2.500',
      'Tanggal 06 Sep 2026',
    ].join('\n'),
    expected: { amount: 100000, description: 'Toko Maju', source: undefined, date: '2026-09-06' },
  },
  {
    name: 'Jumlah Transfer tanpa Rp (tanpa titik) bukan nomor ref',
    text: [
      'Transfer Berhasil',
      'Penerima: Toko Maju',
      'Jumlah Transfer 100000',
      'Tanggal 06 Sep 2026',
    ].join('\n'),
    expected: { amount: 100000, description: 'Toko Maju', source: undefined, date: '2026-09-06' },
  },

  // ─── Kereta / travel note ────────────────────────────────────────────────────
  {
    name: 'Jago Access by KAI + catatan pulang',
    text: [
      'Jago',
      'Access By KAI Oo',
      'BANDUNG',
      'Rp790.000',
      '260902-PQVT-EJU2YB Sukses',
      'ANGGIE IRAWAN',
      '02 Sep 2026, 08:26 WIB',
      'Pulang Jember',
    ].join('\n'),
    expected: {
      amount: 790000,
      description: 'Access By KAI',
      source: 'Jago',
      date: '2026-09-02',
      note: 'Pulang Jember',
    },
  },
];
