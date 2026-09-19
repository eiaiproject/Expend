/**
 * Korpus input pengguna untuk optimasi & hardening parser.
 *
 * Dua kegunaan:
 *  1. `ChatCase.expect` mengunci perilaku yang SUDAH dianggap benar (regresi).
 *     Entri tanpa `expect` hanya diuji sifat aman (tidak throw, batas nilai).
 *  2. `KNOWN_ISSUES` mendokumentasikan perilaku yang diduga belum ideal.
 *     Tidak di-assert; dipakai sebagai daftar kerja hardening.
 *
 * Rentang yang dijaga parser (lihat README): nominal 100..1e12, angka polos
 * < 100 tanpa satuan ditolak; deskripsi ≤ 80 char; note ≤ 200 char.
 */

export interface ChatExpect {
  amount?: number;
  description?: string;
  source?: string;
  note?: string;
  /** Hanya untuk tanggal eksplisit (deterministik). */
  date?: string;
  /** true = parser wajib mengembalikan null. */
  nullResult?: boolean;
}

export interface ChatCase {
  input: string;
  expect?: ChatExpect;
}

// ── 1. Nominal: angka polos ──────────────────────────────────────────────────
export const AMOUNT_PLAIN: ChatCase[] = [
  { input: 'kopi 50000', expect: { amount: 50000, description: 'Kopi' } },
  { input: '50000 kopi', expect: { amount: 50000, description: 'Kopi' } },
  { input: 'kopi 50000 enak', expect: { amount: 50000 } },
  { input: 'kopi enak 50000', expect: { amount: 50000 } },
  { input: 'bayar parkir 2000', expect: { amount: 2000 } },
  { input: 'kopi 100', expect: { amount: 100, description: 'Kopi' } },
  { input: 'kopi 99', expect: { nullResult: true } },
  { input: 'Kopi 50 di lantai 2', expect: { nullResult: true } },
  { input: 'bayar Rp 50', expect: { nullResult: true } },
  { input: 'permen 500', expect: { amount: 500 } },
  { input: 'kopi 0', expect: { nullResult: true } },
  { input: 'kopi 007', expect: { nullResult: true } },
];

// ── 2. Nominal: pemisah ribuan/desimal (ID + EN) ─────────────────────────────
export const AMOUNT_SEPARATORS: ChatCase[] = [
  { input: 'belanja 50.000', expect: { amount: 50000 } },
  { input: 'kopi 50,000', expect: { amount: 50000 } },
  { input: 'belanja 1.500.000', expect: { amount: 1500000 } },
  { input: 'belanja 1,500,000', expect: { amount: 1500000 } },
  { input: 'belanja 1.500.000,50', expect: { amount: 1500000.5 } },
  { input: 'belanja 1,500,000.50', expect: { amount: 1500000.5 } },
  // angka polos < 100 tanpa satuan selalu ditolak (acceptance floor)
  { input: 'kopi 15,50', expect: { nullResult: true } },
  { input: 'kopi 15.50', expect: { nullResult: true } },
  { input: 'kopi 15.5', expect: { nullResult: true } },
  { input: 'kopi 50..000' },
  { input: 'kopi 50,,000' },
  { input: 'kopi .000' },
  { input: 'kopi 50.' },
  { input: 'kopi 50,' },
  { input: 'kopi 5 0 0 0 0' },
];

// ── 3. Nominal: suffix ───────────────────────────────────────────────────────
export const AMOUNT_SUFFIX: ChatCase[] = [
  { input: 'kopi 50rb', expect: { amount: 50000 } },
  { input: 'kopi 50 rb', expect: { amount: 50000 } },
  { input: 'kopi 50ribu', expect: { amount: 50000 } },
  { input: 'kopi 50 ribu', expect: { amount: 50000 } },
  { input: 'kopi 50k', expect: { amount: 50000 } },
  { input: 'kopi 50K', expect: { amount: 50000 } },
  { input: 'kopi 50 k', expect: { amount: 50000 } },
  { input: 'laptop 1,5jt', expect: { amount: 1500000 } },
  { input: 'laptop 1.5jt', expect: { amount: 1500000 } },
  { input: 'sewa 2 juta', expect: { amount: 2000000 } },
  { input: 'kopi 2jt', expect: { amount: 2000000 } },
  { input: 'kopi 2 Jt', expect: { amount: 2000000 } },
  { input: 'kopi 2JT', expect: { amount: 2000000 } },
  { input: 'kopi 0,5jt', expect: { amount: 500000 } },
  { input: 'kopi 0.5jt', expect: { amount: 500000 } },
  { input: 'kopi 15,5rb', expect: { amount: 15500 } },
  { input: 'kopi 15.5rb', expect: { amount: 15500 } },
  { input: 'token 500k', expect: { amount: 500000 } },
  { input: 'kopi 500jt', expect: { amount: 500000000 } },
  // suffix tidak boleh "memakan" huruf awal kata berikutnya
  { input: 'kopi 50.000', expect: { amount: 50000 } },
  { input: '50.000 kopi', expect: { amount: 50000 } },
  { input: 'kopi 10kg 100rb', expect: { amount: 100000 } },
  { input: 'kopi 5 kg 100rb', expect: { amount: 100000 } },
  { input: 'kopi 50ribuan' },
  { input: 'kopi 1M' },
  { input: 'kopi 1 m' },
  { input: 'kopi 1 miliar' },
];

// ── 4. Nominal: penanda mata uang ────────────────────────────────────────────
export const AMOUNT_CURRENCY: ChatCase[] = [
  { input: 'beli kopi Rp 25.000', expect: { amount: 25000, description: 'Kopi' } },
  { input: 'beli kopi rp 25.000', expect: { amount: 25000 } },
  { input: 'beli kopi RP 25.000', expect: { amount: 25000 } },
  { input: 'beli kopi Rp. 25.000', expect: { amount: 25000 } },
  { input: 'beli kopi Rp25.000', expect: { amount: 25000 } },
  { input: 'R P 50.000 kopi', expect: { amount: 50000, description: 'Kopi' } },
  { input: 'kopi IDR 50.000', expect: { amount: 50000 } },
  { input: 'kopi Rp 50.000,00', expect: { amount: 50000 } },
  { input: 'kopi Rp0', expect: { nullResult: true } },
  { input: 'kopi Rp', expect: { nullResult: true } },
];

// ── 5. Nominal: batas & overflow ─────────────────────────────────────────────
export const AMOUNT_BOUNDS: ChatCase[] = [
  { input: 'kopi 999999999', expect: { amount: 999999999 } },
  { input: 'kopi 1000000000', expect: { amount: 1000000000 } },
  { input: 'kopi 1000000000000', expect: { amount: 1000000000000 } },
  { input: 'kopi 1000000000001', expect: { nullResult: true } },
  { input: 'kopi 9999999999999999', expect: { nullResult: true } },
  { input: 'kopi 1e12', expect: { nullResult: true } },
  { input: 'kopi 1E12', expect: { nullResult: true } },
  { input: 'kopi -50000' },
  { input: 'kopi +50000' },
  { input: 'kopi 50rb kembali 20rb', expect: { amount: 50000 } },
  { input: 'bayar 50rb, kembali 50rb', expect: { amount: 50000 } },
];

// ── 6. Tanggal relatif ───────────────────────────────────────────────────────
export const DATES_RELATIVE: ChatCase[] = [
  { input: 'bayar kopi kemarin 25rb' },
  { input: 'bayar kopi kemaren 25rb' },
  { input: 'bayar kopi lusa 25rb' },
  { input: 'bayar kopi hari ini 25rb' },
  { input: 'bayar kopi hariini 25rb' },
  // belum didukung (deskripsi tetap memuat kata tanggal)
  { input: 'kopi 25rb besok' },
  { input: 'kopi 25rb 2 hari lalu' },
  { input: 'kopi 25rb minggu lalu' },
];

// ── 7. Tanggal eksplisit ─────────────────────────────────────────────────────
export const DATES_EXPLICIT: ChatCase[] = [
  { input: 'bayar kopi 15/08/2026 25rb', expect: { amount: 25000, date: '2026-08-15' } },
  { input: 'bayar kopi 15-08-2026 25rb', expect: { amount: 25000, date: '2026-08-15' } },
  { input: 'bayar kopi 15.08.2026 25rb', expect: { amount: 25000, date: '2026-08-15' } },
  { input: 'bayar kopi 15.8.26 25rb', expect: { amount: 25000, date: '2026-08-15' } },
  { input: 'bayar kopi 15/8/26 25rb', expect: { amount: 25000, date: '2026-08-15' } },
  { input: 'bayar kopi 15 Agustus 2026 25rb', expect: { amount: 25000, date: '2026-08-15' } },
  { input: 'bayar kopi 15 Agu 2026 25rb', expect: { amount: 25000, date: '2026-08-15' } },
  { input: 'bayar kopi 01Sep2026 25rb', expect: { amount: 25000, date: '2026-09-01' } },
  { input: 'bayar kopi 31/02/2026 25rb', expect: { amount: 25000, date: '2026-02-28' } },
  { input: 'bayar kopi 29/02/2024 25rb', expect: { amount: 25000, date: '2024-02-29' } },
  { input: 'bayar kopi 29/02/2026 25rb', expect: { amount: 25000, date: '2026-02-28' } },
  { input: 'bayar kopi 32/01/2026 25rb' },
  { input: 'bayar kopi tgl 15 25rb' },
  { input: 'bayar kopi tanggal 15 25rb' },
  { input: 'bayar kopi tgl 0 25rb' },
  { input: 'bayar kopi tgl 32 25rb' },
  // tanggal tak valid (00/00/0000) diuji di parserCorpus (jatuh ke hari ini)
  { input: 'bayar kopi 00/00/0000 25rb' },
  // bentuk lain yang mungkin diketik pengguna
  { input: 'kopi 25rb 2026-08-15', expect: { amount: 25000, description: 'Kopi', date: '2026-08-15' } },
  { input: '2026-08-15 kopi 25rb', expect: { amount: 25000, description: 'Kopi', date: '2026-08-15' } },
  { input: 'kopi 25rb 15/08', expect: { amount: 25000, description: 'Kopi', date: '2026-08-15' } },
  { input: 'kopi 25rb 15/8', expect: { amount: 25000, description: 'Kopi', date: '2026-08-15' } },
  { input: 'kopi 25rb 15 Agustus' },
  // bentuk ambigu pecahan TIDAK dianggap tanggal ("1/2 kg")
  { input: 'kopi 1/2 kg 25rb' },
];

// ── 8. Sumber dana: klausa dikenal ───────────────────────────────────────────
export const SOURCES_CLAUSE: ChatCase[] = [
  { input: 'kopi 20000 dari kas', expect: { amount: 20000, description: 'Kopi', source: 'Kas' } },
  { input: 'KPR 7500000 dari BSI', expect: { amount: 7500000, description: 'KPR', source: 'BSI' } },
  { input: 'makan siang 50rb via GoPay', expect: { amount: 50000, source: 'GoPay' } },
  { input: 'bayar listrik 200rb pakai Dana', expect: { amount: 200000, source: 'Dana' } },
  { input: 'bayar listrik 200rb pake OVO', expect: { amount: 200000, source: 'OVO' } },
  { input: 'coffee 25k from BCA', expect: { amount: 25000, source: 'BCA' } },
  { input: 'kopi 20rb dari BCA Syariah', expect: { source: 'BCA Syariah' } },
  { input: 'kopi 20rb dari BCA', expect: { source: 'BCA' } },
  { input: 'kopi 20rb dari bank mandiri taspen', expect: { source: 'Mandiri Taspen' } },
  { input: 'kopi 20rb dari bank jago', expect: { source: 'Jago' } },
  { input: 'kopi 20rb dari seabank', expect: { source: 'Sea Bank' } },
  { input: 'kopi 20rb dari ocbc niaga', expect: { source: 'OCBC' } },
  { input: 'kopi 20rb dari shopee pay', expect: { source: 'ShopeePay' } },
  { input: 'kopi 20rb dari i.saku', expect: { source: 'i.saku' } },
  { input: 'kopi 20rb dari kartu kredit', expect: { source: 'Kartu Kredit' } },
  { input: 'kopi 20rb via transfer bank', expect: { source: 'Transfer Bank' } },
  { input: 'kopi 20rb dari bni46', expect: { source: 'BNI' } },
  { input: 'kopi 20rb dari bank rakyat', expect: { source: 'BRI' } },
  { input: 'kopi 20rb dari citibank', expect: { source: 'Citibank' } },
  { input: 'kopi 20rb dari allo bank', expect: { source: 'Allo Bank' } },
  { input: 'kopi 20rb dari neo commerce', expect: { source: 'Neo Commerce' } },
  { input: 'kopi 20rb dari doku', expect: { source: 'Doku' } },
  { input: 'kopi 20rb dari linkaja', expect: { source: 'LinkAja' } },
  { input: 'kopi 20rb dari standard chartered', expect: { source: 'Standard Chartered' } },
];

// ── 9. Sumber dana: tanpa klausa / kata umum ─────────────────────────────────
export const SOURCES_BARE: ChatCase[] = [
  { input: 'bayar tunai 50rb', expect: { source: 'Tunai' } },
  { input: 'kopi 25rb tunai', expect: { source: 'Tunai' } },
  { input: 'makan tunai 50rb', expect: { source: 'Tunai' } },
  { input: 'kopi 20rb cash', expect: { source: 'Tunai' } },
  { input: 'kopi 20rb kas', expect: { source: 'Kas' } },
  { input: 'kopi 50rb', expect: { source: undefined } },
  { input: 'kopi 25rb dana' },
  { input: 'kopi 25rb Dana' },
  { input: 'kopi 25rb DANA' },
  { input: 'belanja 50rb bca' },
];

// ── 10. Sumber dana: false positive yang harus DITOLAK ───────────────────────
export const SOURCES_FALSE_POSITIVE: ChatCase[] = [
  { input: 'beli nasi goreng dari warung Pak Eko 20rb', expect: { amount: 20000 } },
  { input: 'kopi 50rb dari jagonya' },
  { input: 'kopi 50rb dari dana darurat' },
  { input: 'kopi 50rb dari briefing' },
  { input: 'kopi 50rb dari 1234567890' },
  { input: 'kopi 50rb dari bapak Budi' },
  { input: 'bayar kos 1,5 juta', expect: { amount: 1500000 } },
  { input: 'transfer ke Budi 50rb', expect: { amount: 50000 } },
  { input: 'bayar listrik 50000 rekening' },
  { input: 'beli megah 25rb' },
  { input: 'beli sinar mas 25rb' },
];

// ── 11. Catatan (note) ───────────────────────────────────────────────────────
export const NOTES: ChatCase[] = [
  { input: 'kopi 25rb note untuk rapat', expect: { amount: 25000, description: 'Kopi', note: 'untuk rapat' } },
  { input: 'kopi 25rb note: untuk rapat', expect: { note: 'untuk rapat' } },
  { input: 'kopi 25rb notes bayar 3 orang', expect: { note: 'bayar 3 orang' } },
  { input: 'kopi 25rb catatan untuk rapat', expect: { note: 'untuk rapat' } },
  { input: 'kopi 25rb keterangan rutin', expect: { note: 'rutin' } },
  { input: 'kopi 25rb catatan' },
  { input: 'buku catatan 25rb', expect: { description: 'Buku Catatan' } },
  { input: 'sticky note 10rb', expect: { description: 'Sticky Note' } },
  { input: 'kopi 25rb nota makan', expect: { description: 'Kopi Nota Makan' } },
  { input: 'note untuk rapat 25rb' },
];

// ── 12. Deskripsi: verba & preposisi ─────────────────────────────────────────
export const DESCRIPTION_FORMAT: ChatCase[] = [
  { input: 'beli kopi 50rb', expect: { description: 'Kopi' } },
  { input: 'bayar listrik 200rb', expect: { description: 'Listrik' } },
  { input: 'jajan 12rb', expect: { description: 'Jajan' } },
  { input: 'belanja 50rb', expect: { description: 'Belanja' } },
  { input: 'order grabfood 48rb', expect: { description: 'Grabfood' } },
  { input: 'pesan gojek 35rb', expect: { description: 'Gojek' } },
  { input: 'isi OVO 50rb', expect: { description: 'OVO' } },
  { input: 'top up OVO 100rb', expect: { description: 'OVO' } },
  { input: 'topup 50rb' },
  { input: 'top-up 50rb' },
  { input: 'tf 50rb', expect: { description: 'Tf' } },
  { input: 'tf kopi 50rb', expect: { description: 'Kopi' } },
  { input: 'beliin baju 100rb', expect: { description: 'Baju' } },
  { input: 'buy coffee 25rb' },
  { input: 'pay bill 200rb' },
  { input: 'beli kopi di Indomaret 50000', expect: { description: 'Kopi di Indomaret' } },
  { input: 'jajan di kantin 12rb', expect: { description: 'Kantin' } },
  { input: 'bayar parkir 5000 di lantai 2', expect: { description: 'Parkir' } },
  { input: 'makan 25000 di lantai 3', expect: { description: 'Makan' } },
  { input: 'beli ayam geprek level 5 25rb', expect: { description: 'Ayam Geprek Level 5' } },
  { input: 'kopi dan roti 30rb', expect: { description: 'Kopi dan Roti' } },
  { input: 'nasi goreng dari warung Pak Eko 20rb', expect: { description: undefined } },
  { input: 'bayar kos kosong 25rb' },
  { input: '50000', expect: { description: 'Pengeluaran' } },
  { input: '<script>alert(1)</script> kopi 25rb' },
  { input: '=1+1 kopi 25rb' },
  { input: 'kopi ☕ 25rb' },
];

// ── 13. Akronim & kapitalisasi ───────────────────────────────────────────────
export const ACRONYMS: ChatCase[] = [
  { input: 'transfer BCA 100rb', expect: { description: 'BCA' } },
  { input: 'bayar PLN listrik 200rb', expect: { description: 'PLN Listrik' } },
  { input: 'beli QRIS 50rb', expect: { description: 'QRIS' } },
  { input: 'bayar KPR 5jt', expect: { description: 'KPR' } },
  { input: 'bayar BPJS 150rb', expect: { description: 'BPJS' } },
  { input: 'isi ATM 25rb' },
  { input: 'kopi susu 25rb', expect: { description: 'Kopi Susu' } },
  { input: 'kopi di starbucks 45rb', expect: { description: 'Kopi di Starbucks' } },
];

// ── 14. Banyak angka / ambiguitas ────────────────────────────────────────────
export const MULTI_NUMBERS: ChatCase[] = [
  { input: 'beli 2 dus kopi 50rb', expect: { amount: 50000 } },
  { input: 'bayar 150000 tagihan 50000', expect: { amount: 150000 } },
  { input: 'bayar 50rb kembali 20rb', expect: { amount: 50000 } },
  { input: '3 porsi nasi 45rb', expect: { amount: 45000 } },
  { input: '2 orang 100rb', expect: { amount: 100000 } },
  { input: 'kopi 25rb untuk 3 orang' },
  { input: 'beli baju 2026', expect: { nullResult: true } },
  { input: 'bayar parkir 2000', expect: { amount: 2000 } },
  { input: 'bayar 1900', expect: { amount: 1900 } },
  // 2099 bukan kelipatan 100 -> dianggap tahun, bukan nominal
  { input: 'bayar 2099', expect: { nullResult: true } },
  { input: 'bayar 2000', expect: { amount: 2000 } },
];

// ── 15. Nomor referensi / resi ───────────────────────────────────────────────
export const REF_NUMBERS: ChatCase[] = [
  { input: 'bayar 50rb ref 1234567890', expect: { amount: 50000 } },
  { input: 'transfer 50rb ref 1234567890', expect: { amount: 50000 } },
  { input: 'Nomor Referensi Pembayaran: 12345678', expect: { nullResult: true } },
  { input: 'transfer 50rb Nomor Referensi Pembayaran: 12345678', expect: { amount: 50000 } },
  { input: 'kopi 25rb no. 12345' },
  { input: 'kopi 25rb ID 998877' },
  { input: 'bayar listrik 50000 rekening 123456' },
  { input: 'kopi 25rb resi 123456789' },
  { input: 'kopi 25rb trace 123456789' },
];

// ── 16. Input bahasa Inggris ─────────────────────────────────────────────────
export const ENGLISH: ChatCase[] = [
  { input: 'coffee 25k from BCA', expect: { amount: 25000, source: 'BCA' } },
  { input: 'lunch 50,000' },
  { input: 'dinner with friends 150000' },
  { input: 'payment 1.5jt via GoPay', expect: { amount: 1500000, source: 'GoPay' } },
  { input: 'transfer to John 100k from BCA' },
  { input: 'groceries 75k' },
  { input: 'taxi 35k yesterday' },
];

// ── 17. Adversarial / keras (hanya invariant: tidak throw & batas nilai) ─────
export const ADVERSARIAL: string[] = [
  '',
  ' ',
  '\t',
  '\n',
  'kopi',
  'a',
  '0',
  'Rp',
  'dari',
  'note',
  'catatan',
  '(((((((((((',
  ')))))))))))',
  '\\\\\\\\',
  '\u0000kopi 25rb',
  '\u200bkopi 25rb',
  'kopi\u200b 25rb',
  'kopi ２５ｒｂ',
  'kopi ５００００',
  'kopi 50\u00a0000',
  'kopi\u00a025rb',
  'kopi 25rb '.repeat(60),
  'dari '.repeat(200),
  '1'.repeat(500),
  '9'.repeat(500),
  '0'.repeat(500),
  'Rp'.repeat(250),
  'note '.repeat(100),
  '.'.repeat(200),
  ','.repeat(200),
  '(((((('.repeat(80),
  'a'.repeat(500),
  'kopi 25rb ' + '<'.repeat(200),
  'kopi 25rb ' + '>'.repeat(200),
  '=${1+1} kopi 25rb',
  '=CMD|/c calc kopi 25rb',
  '+62 812 3456 7890 kopi 25rb',
  '@user kopi 25rb',
  "'; DROP TABLE transactions;-- kopi 25rb",
  'kopi 25rb \u202eover',
  'kopi 25rb \u0301\u0301\u0301',
  'kopi 9999999999999999999999999999999999',
  'kopi 1'.repeat(100),
  'kemarin '.repeat(60) + 'kopi 25rb',
  'tgl '.repeat(100) + '15',
  '15/08/2026 '.repeat(50),
];

// ── 18. Teks struk / OCR (parseReceiptText) ──────────────────────────────────
export const RECEIPT_TEXTS: string[] = [
  'BCA\nTransfer\nTotal Rp 55.000\nTunai Rp 100.000\nKembalian Rp 45.000',
  'DANA\nPengiriman\nRp 250.000\nSaldo Rp 1.000.000',
  'OVO\nTransfer Berhasil\nNominal Rp 100.000\nSaldo Akhir: Rp 2.000.000',
  'QRIS\nTYA BUAH 2\nNama Acquirer\nTotal Rp 55.000',
  'ShopeePay\nBeneficiary Name LUKY DIAN SUSANTI\nAmount Rp 150.000',
  'LinkAja\nPenerima: SITI AMINAH\nTotal Rp 75.000\nTanggal 02 Sep 2026',
  'GoPay\nTransfer ke Budi\nRp 50.000\nBerhasil',
  'Mandiri\nPENERIMA ANGGIE\njumlah transfer 1.500.000\ntanggal 31/08/2026\nNo. Ref: 982341234',
  'SeaBank\nHalo, aku sudah kirim Rp50.000 ke Budi lewat BCA',
  'Total Rp 55.000',
  'Saldo\nAkhir: Rp 2.000.000\nTotal Rp 55.000',
  'Pulang 25000\nGojek',
  'Produk: Kopi Susu\nJumlah 2\nTotal Rp 50.000',
  'Nama Ac r\nFINPAY\nTotal Rp 25.000',
  '( .. eo\nTotal Rp 55.000',
  'by mandiri\nTotal Rp 100.000',
  'Beneficiary PAN 9360 1234 5678\nTotal Rp 25.000',
  'Total Rp 55.000\nTunai Rp 100.000\nKembali Rp 45.000',
  'Sub Total Rp 50.000\nPajak Rp 5.000\nTotal Rp 55.000',
  'Jumlah Transfer 100000',
  'Jumlah Transfer Rp 100.000',
  'ID 1234567890123\nTotal 55000',
  '01Sep2026\nTotal 55000',
  'Tanggal & waktu trar i\nBayar\nMeta',
];

// ── 19. Perilaku diduga belum ideal (dokumentasi, tidak di-assert) ───────────
// Tanggal mustahil harus jatuh ke hari ini, bukan ISO rusak seperti "0-00-01"
// (diuji khusus di parserCorpus karena nilainya bergantung hari berjalan).
export const INVALID_DATES: string[] = [
  'bayar kopi 00/00/0000 25rb',
  'bayar kopi 99/99/9999 25rb',
  'bayar kopi 00/00/00 25rb',
];

// Perilaku diduga belum ideal (dokumentasi, tidak di-assert).
// Sudah diperbaiki & di-assert: tanggal ISO ("2026-08-15"), tanggal tanpa
// tahun ("15/08"/"15/8"), dan tanggal mustahil ("00/00/0000").
export const KNOWN_ISSUES: { input: string; actual: string; expected: string }[] = [
  {
    input: 'kopi 50rb dari 1234567890',
    actual: 'desc "Kopi dari" (preposisi menggantung)',
    expected: 'desc "Kopi"',
  },
  { input: 'kopi 25rb besok', actual: 'desc memuat "Besok"', expected: 'tanggal besok (relatif)' },
  { input: 'kopi 25rb 2 hari lalu', actual: 'desc memuat "2 Hari Lalu"', expected: 'tanggal H-2' },
  { input: 'kopi 1M', actual: 'null', expected: 'Rp 1.000.000.000 (miliar) bila didukung' },
  { input: 'kopi 50\u00a0000', actual: 'null', expected: 'nbsp diperlakukan seperti spasi' },
  { input: 'kopi ２５ｒｂ', actual: 'null', expected: 'digit/lebar penuh dinormalisasi (opsional)' },
  { input: 'kopi -50000', actual: 'desc "Kopi -"', expected: 'tanda diabaikan dari deskripsi' },
  { input: 'kopi 25rb Dana', actual: 'tidak ada source', expected: 'source "Dana" (kapital = e-wallet)' },
  { input: 'tf 50rb', actual: 'desc "Tf"', expected: 'verba tanpa objek → "Pengeluaran"' },
];
