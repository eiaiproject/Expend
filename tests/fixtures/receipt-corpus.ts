/**
 * Korpus input struk/resi untuk `parseReceiptText` — melengkapi
 * `ocr-receipts.ts` (yang menguji format bank nyata) dengan **ruang input**:
 * anotasi nominal, label, saldo/tunai/kembalian, tanggal, kerusakan OCR,
 * posisi merchant, catatan, mata uang lain, dan input tepi/adversarial.
 *
 * Konvensi:
 * - Entri dengan `expect` mengunci perilaku yang **sudah benar** (regresi).
 * - Entri tanpa `expect` hanya diuji invariant (tidak throw, batas panjang,
 *   performance) — aman untuk semua kemungkinan input.
 * - Temuan yang sudah diperbaiki disimpan sebagai jejak audit di
 *   `RECEIPT_RESOLVED_FINDINGS` (sebelum → sesudah); status terkininya
 *   DI-ASSERT oleh array kategori di atas, bukan oleh daftar itu.
 * - Bila menemukan perilaku baru yang belum ideal, tambahkan ke daftar itu.
 */
export interface ReceiptCase {
  text: string;
  expect?: {
    amount?: number;
    description?: string;
    source?: string;
    date?: string;
    note?: string;
    nullResult?: boolean;
  };
}

// ── 1. Label nominal (Total/Jumlah/Grand Total) — nominal harus dari label ──
export const AMOUNT_LABELS: ReceiptCase[] = [
  { text: 'Total Rp 55.000', expect: { amount: 55000 } },
  { text: 'TOTAL Rp 55.000', expect: { amount: 55000 } },
  { text: 'Total: Rp 55.000', expect: { amount: 55000 } },
  { text: 'Jumlah Rp 55.000', expect: { amount: 55000 } },
  { text: 'Jumlah Transfer 100000', expect: { amount: 100000 } },
  { text: 'Jumlah Transfer Rp 100.000', expect: { amount: 100000 } },
  { text: 'Total 100.000', expect: { amount: 100000 } },
  { text: 'Nominal Rp 75.000', expect: { amount: 75000 } },
  { text: 'Nominal Rp75.000', expect: { amount: 75000 } },
  { text: 'Total Transaksi Rp 14.500', expect: { amount: 14500 } },
  { text: 'Grand Total Rp 111.000', expect: { amount: 111000 } },
  { text: 'Total Bayar Rp 55.000', expect: { amount: 55000 } },
  { text: 'Bayar Rp 55.000', expect: { amount: 55000 } },
  { text: 'Pembayaran Rp 55.000', expect: { amount: 55000 } },
  { text: 'Amount Rp 150.000', expect: { amount: 150000 } },
  // Label + nominal terpisah baris (umum saat OCR memotong baris)
  { text: 'Total\nRp 50.000', expect: { amount: 50000 } },
  { text: 'Total\nRp\n50.000', expect: { amount: 50000 } },
  { text: 'Total Transaksi\nRp 65.000', expect: { amount: 65000 } },
  // OCR menempelkan nominal ke label tanpa spasi
  { text: 'TOTAL:RP55.000', expect: { amount: 55000 } },
  { text: 'Rp50.000', expect: { amount: 50000 } },
  // OCR memotong simbol dari digit (baris terpisah) - tetap nominal
  { text: 'Total\nRp\n50000', expect: { amount: 50000, description: 'Transfer' } },
  { text: 'Pembayaran\nRp\n50000', expect: { amount: 50000 } },
  // Struk promo: Total akhir menang atas Subtotal walau nominalnya lebih kecil
  { text: 'INDOMARET\nSubtotal Rp 100.000\nDiskon Rp 10.000\nTotal Rp 90.000', expect: { amount: 90000, description: 'Indomaret' } },
  { text: 'Voucher Rp 20.000\nTotal Rp 80.000', expect: { amount: 80000 } },
  // Lantai nominal <1000 tanpa Rp (parkir/minuman) tetap diterima
  { text: 'Parkir\nTotal 900', expect: { amount: 900 } },
  { text: 'Total 900', expect: { amount: 900 } },
  // Batas atas selaras chat (≤1e12)
  { text: 'Total Rp 9999999999999999', expect: { nullResult: true } },
  { text: 'Total Rp 1.000.000.000.000', expect: { amount: 1000000000000 } },
];

// ── 2. Anotasi mata uang & desimal (ID vs EN) ────────────────────────────────
export const AMOUNT_NOTATION: ReceiptCase[] = [
  { text: 'Total Rp 50.000', expect: { amount: 50000 } },
  { text: 'Total Rp50.000', expect: { amount: 50000 } },
  { text: 'Total Rp. 50.000', expect: { amount: 50000 } },
  { text: 'Total IDR 50.000', expect: { amount: 50000 } },
  { text: 'Total Rp 1.234.567', expect: { amount: 1234567 } },
  { text: 'Total Rp 1.234.567,89', expect: { amount: 1234567.89 } },
  { text: 'Total Rp1.000.000,00', expect: { amount: 1000000 } },
  { text: 'Total Rp 1,234,567.89', expect: { amount: 1234567.89 } },
  { text: 'Transfer Amount IDR 1,000.00', expect: { amount: 1000 } },
  { text: 'Total Rp 500', expect: { amount: 500 } },
  { text: 'Total Rp 999999999', expect: { amount: 999999999 } },
  { text: 'Total Rp 1.000.000.000', expect: { amount: 1000000000 } },
];

// ── 3. Komponen yang BUKAN nominal (tunai/kembalian/saldo/admin/diskon) ──────
export const NON_AMOUNT_COMPONENTS: ReceiptCase[] = [
  {
    text: 'INDOMARET\nTotal Rp 55.000\nTunai Rp 100.000\nKembalian Rp 45.000',
    expect: { amount: 55000, description: 'Indomaret' },
  },
  {
    text: 'INDOMARET\nTotal Rp 55.000\nUang Pas Rp 55.000',
    expect: { amount: 55000 },
  },
  {
    text: 'CASH Rp 100.000',
    expect: { amount: 100000, source: 'Tunai' },
  },
  {
    text: 'Transfer Berhasil\nNominal: Rp 50.000\nBiaya Admin: Rp 2.500\nTotal: Rp 52.500',
    expect: { amount: 52500 },
  },
  {
    text: 'DANA\nBerhasil\nRp 250.000\nKe Budi Antoni\nSaldo Rp 1.000.000',
    expect: { amount: 250000, description: 'Budi Antoni', source: 'Dana' },
  },
  {
    text: 'Saldo\nAkhir: Rp 2.000.000\nTotal Rp 55.000',
    expect: { amount: 55000 },
  },
  {
    text: 'Saldo Awal\nRp 50.000\nTotal Rp 55.000',
    expect: { amount: 55000 },
  },
  {
    text: 'Totally Gift\nRp 25.000',
    expect: { amount: 25000 },
  },
  // Struk belanja ber-item: Total menang atas harga satuan/baris item
  {
    text: 'INDOMARET\nKopi Susu 2 x 12.000 = 24.000\nRoti 1 x 15.000 = 15.000\nTOTAL Rp 39.000\nTunai Rp 50.000\nKembali Rp 11.000',
    expect: { amount: 39000, description: 'Indomaret' },
  },
  {
    text: 'WARUNG\n2 x 25.000\nTotal Rp 50.000',
    expect: { amount: 50000 },
  },
  {
    text: 'TOTAL Rp 100.000\nPPN 11% Rp 11.000\nGrand Total Rp 111.000',
    expect: { amount: 111000 },
  },
  {
    text: 'ShopeeFood\nHarga Makanan Rp 50.000\nOngkir Rp 10.000\nTotal Rp 60.000',
    expect: { amount: 60000, description: 'ShopeeFood' },
  },
  // Nomor referensi / identitas tidak boleh jadi nominal
  { text: 'Transfer\nNo. Ref 1234567890\nRp 50.000', expect: { amount: 50000 } },
  { text: 'Transfer\nNo. Ref: Rp 982341234\nTotal Rp 50.000', expect: { amount: 50000 } },
  { text: 'Transfer\nNPWP 0123456789012345\nTotal Rp 50.000', expect: { amount: 50000 } },
  { text: 'Transfer\nTotal Rp 50.000\n081234567890', expect: { amount: 50000 } },
  { text: 'ID 1234567890123\nTotal 55000', expect: { amount: 55000 } },
  { text: 'Transfer\nData 31/08/2026\nTotal Rp 50.000', expect: { amount: 50000 } },
  // Hanya kembalian → bukan pengeluaran
  { text: 'Kembalian Rp 45.000', expect: { nullResult: true } },
  // Isi saldo / top up: saldo itu sendiri adalah pengeluaran
  { text: 'Top Up Berhasil\nSaldo Rp 100.000', expect: { amount: 100000, description: 'Top Up' } },
  { text: 'DANA\nIsi Saldo\nRp 100.000\nSaldo Akhir Rp 250.000', expect: { amount: 100000, source: 'Dana' } },
  { text: 'Saldo Awal\nRp 50.000\nTotal Rp 55.000', expect: { amount: 55000, description: 'Transfer' } },
  // Nominal di luar jendela scan lama (500 char) kini terbaca
  { text: 'X'.repeat(2000) + '\nTotal Rp 50.000', expect: { amount: 50000, description: 'Transfer' } },
  // OCR rusak (huruf menggantikan digit) DITOLAK, bukan ditebak
  { text: 'Total Rp 1O.000', expect: { nullResult: true } },
  { text: 'Total Rp O0000', expect: { nullResult: true } },
  { text: 'Total Rp l00.000', expect: { nullResult: true } },
  { text: 'Total Rp S0.000', expect: { nullResult: true } },
  // ...tapi baris bersih lain tetap dipakai bila ada
  { text: 'Total Rp 5O.0OO\nT0tal Rp 50.000', expect: { amount: 50000 } },
];

// ── 4. Tanggal resi ───────────────────────────────────────────────────────────
export const DATES: ReceiptCase[] = [
  { text: 'Transfer\nTotal Rp 50.000\nTanggal 15/08/2026', expect: { date: '2026-08-15' } },
  { text: 'Transfer\nTanggal 15/08/2026\nTotal Rp 50.000', expect: { date: '2026-08-15' } },
  { text: 'Transfer\nTotal Rp 50.000\nTanggal 15-08-2026', expect: { date: '2026-08-15' } },
  { text: 'Transfer\nTotal Rp 50.000\nTanggal 15.08.2026', expect: { date: '2026-08-15' } },
  { text: 'Transfer\nTotal Rp 50.000\nTanggal 15 Agustus 2026', expect: { date: '2026-08-15' } },
  { text: 'Transfer\nTotal Rp 50.000\nTanggal 15 Agu 2026', expect: { date: '2026-08-15' } },
  { text: 'Transfer\nTotal Rp 50.000\nTanggal 31/08/2026', expect: { date: '2026-08-31' } },
  { text: 'Transfer\nTotal Rp 50.000\nTanggal 01 Sep 2026 08:12 WIB', expect: { date: '2026-09-01' } },
  { text: 'Transfer\nTotal Rp 50.000\nTanggal 01Sep 2026', expect: { date: '2026-09-01' } },
  { text: 'Transfer\nTotal Rp 50.000\n31/02/2026', expect: { date: '2026-02-28' } },
  // CRLF dari clipboard/share
  { text: 'Transfer\r\nTotal Rp 50.000\r\nTanggal 15/08/2026', expect: { amount: 50000, date: '2026-08-15' } },
  // Tanpa tanggal → jatuh ke hari ini (bukan kosong)
  { text: 'Total Rp 55.000' },
  { text: 'Transfer\nTotal Rp 50.000\n08:26 WIB' },
  { text: 'Transfer\nTotal Rp 50.000\nTanggal 3l/08/2026' },
  // ISO dari screenshot
  { text: 'Transfer\nTotal Rp 50.000\nTanggal 2026-08-15', expect: { amount: 50000, date: '2026-08-15' } },
  { text: 'Transfer\nTanggal 2026-08-15\nTotal Rp 50.000', expect: { amount: 50000, date: '2026-08-15' } },
  // dd/mm tanpa tahun → tahun berjalan
  { text: 'Transfer\nTotal Rp 50.000\nTanggal 15/08', expect: { amount: 50000, date: '2026-08-15' } },
  { text: 'Transfer\nTotal Rp 50.000\nTanggal 15/8', expect: { amount: 50000, date: '2026-08-15' } },
  // bulan+tahun tanpa hari BUKAN tanggal (dulu dikarang jadi tgl 1)
  { text: 'Transfer\nTotal Rp 50.000\nSep 2026', expect: { amount: 50000, description: 'Transfer' } },
  // satu jendela scan seragam: tanggal di ekor resi panjang tetap terbaca
  {
    text: 'Transfer\nTotal Rp 50.000\n' + 'x'.repeat(600) + '\nTanggal 15/08/2026',
    expect: { amount: 50000, description: 'Transfer', date: '2026-08-15' },
  },
];

// ── 5. Deskripsi: label penerima, merchant, catatan ──────────────────────────
export const DESCRIPTION: ReceiptCase[] = [
  { text: 'Penerima: Toko Kopi\nTotal Rp 52.500', expect: { description: 'Toko Kopi' } },
  { text: 'Penerima\nSEPTIANA ASTI BUANA\nTotal Transaksi Rp 14.500', expect: { description: 'Septiana Asti Buana' } },
  { text: 'Ke: Budi Setiawan\nRp 100.000', expect: { description: 'Budi Setiawan' } },
  { text: 'Ke Budi Antoni\nRp 250.000', expect: { description: 'Budi Antoni' } },
  { text: 'Kepada: Budi Setiawan\nRp 100.000', expect: { description: 'Budi Setiawan' } },
  { text: 'Beneficiary Name LUKY DIAN SUSANTI\nIDR 1,000.00', expect: { description: 'Luky Dian Susanti' } },
  { text: 'Nama: JOKO WIDODO\nTotal Rp 75.000', expect: { description: 'Joko Widodo' } },
  { text: 'Dikirim ke 081234567890 a.n. SITI AMINAH\nRp 50.000', expect: { description: 'Siti Aminah' } },
  { text: 'Ditransfer ke Luky Dian Susanti\nRp 4.627.000', expect: { description: 'Luky Dian Susanti' } },
  { text: 'Product ShopeeFood\nJumlah Transfer Rp 53.730', expect: { description: 'ShopeeFood' } },
  { text: 'Merchant: PLN\nRp 150.000', expect: { amount: 150000, description: 'PLN' } },
  { text: 'WARUNG KOPI\nTotal Rp 50.000\nMerchant: Toko Maju', expect: { amount: 50000 } },
  { text: 'Ke Shopee\nJumlah Transfer Rp 53.730', expect: { description: 'Shopee' } },
  // Merchant tanpa label, sebelum nominal (QRIS/struk)
  { text: 'TYA BUAH 2\nNominal Rp75.000', expect: { description: 'Tya Buah 2' } },
  { text: 'WARUNG KOPI SUDIANG\nTotal Rp 45.000', expect: { description: 'Warung Kopi Sudiang' } },
  { text: 'BCA\nWARUNG KOPI SUDIANG\nTotal Rp 50.000', expect: { description: 'Warung Kopi Sudiang', source: 'BCA' } },
  { text: 'warung kopi\nTotal Rp 50.000', expect: { description: 'Warung Kopi' } },
  { text: 'Warung Kopi\nTotal Rp 50.000', expect: { description: 'Warung Kopi' } },
  { text: 'TOKO 24 JAM\nTotal Rp 50.000', expect: { description: 'Toko 24 Jam' } },
  // Merchant SESUDAH nominal (e-wallet menaruh rincian di bawah)
  { text: 'Pembayaran Berhasil\nTotal Rp 55.000\nWARUNG KOPI SUDIANG', expect: { description: 'Warung Kopi Sudiang' } },
  { text: 'Pembayaran Berhasil\nTotal Rp 55.000\nWarung Kopi Sudiang', expect: { description: 'Warung Kopi Sudiang' } },
  // Catatan conversational share
  { text: 'Halo, aku sudah kirim Rp50.000 ke Budi lewat BCA', expect: { amount: 50000, description: 'Budi', source: 'BCA' } },
  { text: 'Transfer Berhasil\nTotal Rp 100.000\nBerita: bayar kos', expect: { description: 'Bayar Kos' } },
  { text: 'Transfer\nRp 100.000\nKeterangan: uang makan', expect: { description: 'Uang Makan' } },
  // Label acquirer/PAN bukan penerima
  { text: 'PAN Merchant 9360000812132344533\nNominal Rp 75.000' },
  { text: 'beneficiary PAN 9360 1234 5678\nTotal Rp 25.000' },
  { text: 'Dari Rina Wulandari\nKe Shopee\nJumlah Transfer Rp 53.730', expect: { description: 'Shopee' } },
  // Debris OCR
  { text: 'Nama Ac r\nFINPAY\nTotal Rp 25.000', expect: { description: 'FINPAY' } },
  { text: '( .. eo\nTotal Rp 55.000', expect: { amount: 55000, description: 'Transfer' } },
  // Label/baris nominal tidak boleh jadi deskripsi
  { text: 'Total Rp 1.234.567,89', expect: { amount: 1234567.89, description: 'Transfer' } },
  { text: 'TOTAL Rp 100.000\nPPN 11% Rp 11.000\nGrand Total Rp 111.000', expect: { amount: 111000, description: 'Transfer' } },
  { text: 'Total\nRp 50.000', expect: { amount: 50000, description: 'Transfer' } },
  { text: 'Nama Acquirer\nBank Mandiri\nNominal Rp 75.000', expect: { amount: 75000, description: 'Transfer', source: 'Mandiri' } },
  { text: 'TOKO A.B.C\nTotal Rp 50.000', expect: { amount: 50000, description: 'Toko A.B.C' } },
  // Merchant bernama "24 JAM" bukan label waktu
  { text: 'TOKO 24 JAM\nTotal Rp 50.000', expect: { amount: 50000, description: 'Toko 24 Jam' } },
];

// ── 6. Sumber dana ───────────────────────────────────────────────────────────
export const SOURCES: ReceiptCase[] = [
  { text: 'BCA\nTransfer Successful\nIDR1,000.00', expect: { source: 'BCA' } },
  { text: 'BRI\nTransfer Masuk\nRp 500.000\nDari ANDI (Bank BRI)', expect: { source: 'BRI' } },
  { text: 'by mandiri\nTotal Transaksi Rp 14.500', expect: { source: 'Mandiri' } },
  { text: 'OVO\nTransfer Berhasil\nRp 100.000', expect: { source: 'OVO' } },
  { text: 'DANA\nBerhasil\nRp 250.000', expect: { source: 'Dana' } },
  { text: '@ gopay\nRp4.627.000', expect: { source: 'GoPay' } },
  { text: 'ShopeePay\nBerhasil\nRp 50.000', expect: { source: 'ShopeePay' } },
  { text: 'LinkAja\nTransfer Berhasil\nRp 75.000', expect: { source: 'LinkAja' } },
  { text: 'Jago\nRp790.000', expect: { source: 'Jago' } },
  { text: 'SeaBank\nBukti Transaksi\nRp 53.730', expect: { source: 'Sea Bank' } },
  { text: 'INDOMARET\nTotal Rp 55.000\nTunai Rp 100.000', expect: { source: 'Tunai' } },
  // Pengirim vs acquirer: bank pengirim menang walau acquirer ditulis lebih dulu
  { text: 'BRI\nTransfer ke Budi\nRp 50.000\nNama Acquirer Bank Mandiri', expect: { source: 'BRI' } },
  { text: 'Nama Acquirer Bank Mandiri\nTransfer\nRp 50.000\nBRI', expect: { source: 'BRI' } },
  // Tanpa bank → tidak ada sumber
  { text: 'WARUNG KOPI\nTotal Rp 50.000', expect: { source: undefined } },
  // Mata uang asing ditolak konsisten (tidak dicatat sebagai rupiah)
  { text: 'Total $50.00', expect: { nullResult: true } },
  { text: 'Invoice Total $1,234.56', expect: { nullResult: true } },
  { text: 'Payment Successful\nAmount: USD 10.00', expect: { nullResult: true } },
  // ...tapi baris rupiah di resi yang sama tetap dipakai
  { text: '€ 50,00 / Rp 25.000', expect: { amount: 25000 } },
];

// ── 7. Catatan: travel ("Pulang Jember") & catatan pengguna ("Catatan: bensin") ──
export const NOTES: ReceiptCase[] = [
  {
    text: 'Jago\nAccess By KAI\nBANDUNG\nRp790.000\n02 Sep 2026, 08:26 WIB\nPulang Jember',
    expect: { amount: 790000, note: 'Pulang Jember' },
  },
  // Resi travel dengan harga tanpa Rp: dulu seluruh resi hilang (null)
  { text: 'Pulang 25000\nGojek', expect: { amount: 25000, description: 'Gojek', note: 'Pulang 25000' } },
  // Catatan manual pengguna → note (dulu hilang)
  { text: 'Transfer\nRp 100.000\nCatatan: bensin', expect: { amount: 100000, description: 'Transfer', note: 'Bensin' } },
  { text: 'Pergi Jakarta\nRp 150.000', expect: { amount: 150000 } },
  { text: 'Pulang\nRp 150.000' },
];

// ── 8. Input tepi / adversarial ──────────────────────────────────────────────
export const EDGE: string[] = [
  '',
  '   ',
  '\n\n\n',
  '\t',
  'Transfer Berhasil Tanpa Nominal',
  'Total',
  'Total Rp 0',
  'Rp',
  'Rp 0',
  'Rp .',
  'Total Rp ,000',
  'Total Rp 00',
  'Total Rp 000.000',
  '. . .',
  '-',
  '0',
  'null',
  'undefined',
  'NaN',
  'Infinity',
  'Total Rp Infinity',
  'Total Rp NaN',
  '☕ kopi\nTotal Rp 25.000',
  'Total Rp 25.000\n'.repeat(100),
  'Tanggal 15/08/2026\n'.repeat(50) + 'Total Rp 50.000',
  'Rp '.repeat(300),
  'Ref 1234567890\n'.repeat(200) + 'Total Rp 50.000',
  '((((((\n)))))\nTotal Rp 50.000',
  '<script>alert(1)</script>\nTotal Rp 50.000',
  "'; DROP TABLE transactions;--\nTotal Rp 50.000",
  '=1+1\nTotal Rp 50.000',
  'X'.repeat(2000) + '\nTotal Rp 50.000',
  'Total Rp 9999999999999999',
  'Total Rp 1'.repeat(100),
];

// ── 9. Jejak audit temuan yang SUDAH DIPERBAIKI (sebelum → sesudah) ─────────
// Tidak di-assert di sini: setiap baris sudah punya asersi di array kategori
// di atas. Daftar ini menjaga konteks "kenapa" saat kode dibaca/diubah lagi,
// dan menjadi tempat mencatat temuan baru yang belum diperbaiki.
// Bentuk tuple [input, actual, expected] agar kunci objek tak berulang
// 25× (CPD Sonar menghitungnya sebagai duplikasi).
const RESOLVED_ROWS: Array<[input: string, actual: string, expected: string]> = [
  [
    'INDOMARET\nSubtotal Rp 100.000\nDiskon Rp 10.000\nTotal Rp 90.000',
    'amount 100000 (Subtotal menang)',
    'amount 90000 (Total akhir menang atas Subtotal)',
  ],
  [
    'Total\nRp\n50000',
    'null (simbol Rp terpisah baris → dianggap nomor referensi)',
    'amount 50000 (Rp di baris berdampingan tetap sinyal)',
  ],
  [
    'Kembalian Rp 45.000',
    'amount 45000 (kembalian jadi pengeluaran)',
    'null / minta konfirmasi (kembalian bukan pengeluaran)',
  ],
  [
    'Total 900',
    'null (lantai <1000 tanpa Rp)',
    'amount 900 (selaras lantai chat ≥100)',
  ],
  [
    'Top Up Berhasil\nSaldo Rp 100.000',
    'null (hanya saldo → seluruh resi dibuang)',
    'amount 100000 (isi saldo = pengeluaran nyata)',
  ],
  [
    'Saldo Awal\nRp 50.000\nTotal Rp 55.000',
    'desc "Saldo Awal" (baris saldo jadi kandidat deskripsi)',
    'desc merchant/pengeluaran, bukan baris saldo',
  ],
  [
    'Total Rp 1O.000',
    'amount 1 (huruf O dalam digit → nominal salah senyap)',
    'amount 10000 (normalisasi confusable OCR: O→0, l→1, S→5, B→8)',
  ],
  [
    'Total Rp 9999999999999999',
    'amount 1e16 (tanpa batas atas; chat membatasi ≤1e12)',
    'ditolak/dipotong pada 1e12',
  ],
  [
    'Total Rp 1.234.567,89 (satu baris)',
    'desc "Total Rp 1.234.567,89" (label+nominal bocor ke deskripsi)',
    'desc bersih ("Transfer"/merchant)',
  ],
  [
    'TOTAL Rp 100.000\nPPN 11% Rp 11.000\nGrand Total Rp 111.000',
    'desc "Total Rp 100.000" (bocor) walau amount benar 111000',
    'desc bersih',
  ],
  [
    '( .. eo\nTotal Rp 55.000',
    'desc "( .. Eo" (debris lolos jalur fallback terakhir)',
    'desc "Transfer"',
  ],
  [
    'Nama Acquirer\nBank Mandiri\nNominal Rp 75.000',
    'desc "Nama Acquirer" (label acquirer sendiri jadi deskripsi)',
    'desc "Transfer" / merchant',
  ],
  [
    'Merchant: PLN\nRp 150.000',
    'desc "Merchant: PLN" (label + nilai bocor ke deskripsi)',
    'desc "PLN"',
  ],
  [
    'Pulang 25000\nGojek',
    'null (nominal 5 digit tanpa Rp dianggap nomor referensi)',
    'amount 25000 + note "Pulang 25000" (fitur travel note tak terjangkau)',
  ],
  [
    'Total\nRp 50.000',
    'desc "Total" (label saja dianggap deskripsi)',
    'desc "Transfer"/"Pengeluaran"',
  ],
  [
    'Transfer\nTotal Rp 50.000\nTanggal 2026-08-15',
    'date 2015-08-26 (ISO salah-parse, sama dgn KNOWN_ISSUES chat)',
    'date 2026-08-15',
  ],
  [
    'Transfer\nTotal Rp 50.000\nTanggal 15/08',
    'date hari ini (tanpa tahun tidak dikenali)',
    'date 2026-08-15',
  ],
  [
    'Transfer\nTotal Rp 50.000\nSep 2026',
    'date 2026-09-01 (tanggal dikarang)',
    'hari ini, atau tanggal 1 eksplisit di UI',
  ],
  [
    'Transfer\nTotal Rp 50.000\n' + 'x'.repeat(600) + '\nTanggal 15/08/2026',
    'date diambil dari luar batas 500 (amount/desc dibatasi)',
    'batas 500 char diterapkan seragam',
  ],
  [
    'X'.repeat(2000) + '\nTotal Rp 50.000',
    'null (nominal di luar batas 500 char)',
    'nominal tetap ditemukan (atau batas dinaikkan/di-scan bertahap)',
  ],
  [
    'Nama Acquirer Bank Mandiri\nTransfer\nRp 50.000\nBRI',
    'source "Mandiri" (urutan teks menentukan)',
    'source "BRI" (bank pengirim yang menang)',
  ],
  [
    'Transfer\nRp 100.000\nCatatan: bensin',
    'desc "Transfer", note undefined',
    'note "Bensin"',
  ],
  [
    'Total $50.00',
    'null',
    'selaras dgn "Invoice Total $1,234.56" yang menghasilkan 1234.56',
  ],
  [
    'Payment Successful\nAmount: USD 10.00',
    'null (label Inggris tidak dikenali)',
    'amount 10 (atau ditolak konsisten utk mata uang asing)',
  ],
  [
    'TOKO A.B.C\nTotal Rp 50.000',
    'desc "Toko A.b.c" (kapitalisasi merusak akronim bertitik)',
    'desc "Toko ABC" / "Toko A.B.C"',
  ],
  [
    '€ 50,00 / Rp 25.000',
    '€ diabaikan, nominal dari baris Rp',
    'jelas & konsisten utk multi-mata-uang',
  ],
];

export const RECEIPT_RESOLVED_FINDINGS: { input: string; actual: string; expected: string }[] =
  RESOLVED_ROWS.map(([input, actual, expected]) => ({ input, actual, expected }));
