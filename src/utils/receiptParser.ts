import { detectSource } from './sources';
import { parseAmountWithSuffix, parseDMYDate } from './chatParser';
import { todayLocalISO } from './date';
import { titleCasePreserveAcronyms, ACRONYMS } from './textFormat';
import { pickBestAmount, type RankedAmount } from './amountRank';

/**
 * Jendela teks yang dipindai. Dulu 500 char untuk nominal/deskripsi tapi
 * TANPA batas untuk tanggal - artinya satu resi diparse dari dua panjang
 * berbeda (dan nominal di ekor resi panjang hilang). Sekarang satu jendela
 * dipakai seragam oleh nominal, deskripsi, catatan, tanggal, dan sumber.
 * Anti-ReDoS tetap terjaga: 50.000 char diparse <100ms
 * (tests/unit/receiptCorpus.test.ts).
 */
const MAX_SCAN = 4000;

/** Batas nominal, selaras dengan chatParser (MAX_AMOUNT di korpus). */
const MAX_AMOUNT = 1_000_000_000_000;

const PRODUCT_RE = /^(?:product|produk)\s*[:-]?\s*(.+)/i; // NOSONAR - anchored, bounded
const RECIPIENT_RE = /penerima|kepada|tujuan|ditransfer\s*ke|^\s*ke\b|transfer\s*ke\b|dikirim\s*ke/i;
// Catatan: deteksi "a.n." di sini WAJIB diakhiri spasi (`a\.?\s*n\.?\s`) agar
// kata biasa yang diawali "An/AN" (Transfer, BANDUNG, ANGGIE) tak tertangkap
// sebagai label penerima.
const NOTE_RE = /berita|keterangan|beneficiary|atas\s+nama|\bnama\b|\bname\b|\ba\.?\s*n\.?\s|a\/n/i;
// Label merchant eksplisit ("Merchant: PLN") - nilainya deskripsi, bukan label.
const MERCHANT_LABEL_RE = /\bmerchant\b\s*[:-]\s*\S/i; // NOSONAR - anchored, bounded
// Baris yang menyebut "saldo" adalah informasi saldo, bukan nominal transaksi
// (resi DANA/OVO: "Rp 250.000 ... Saldo Rp 1.000.000" → nominal = 250.000).
// Word-boundary agar "Saldo Gift" / "Saldo Cashback" tidak salah skip.
const SALDO_RE = /\bsaldo\b/i;
// Label saldo yang berdiri sendiri di barisnya ("Saldo" / "Saldo Akhir" diikuti
// angkanya di baris bawah). Sengaja NOUN-phrase saja: "Isi Saldo"/"Tambah Saldo"
// adalah baris aksi, dan angka di bawahnya justru transaksi top up.
const SALDO_LABEL_RE = /^(?:saldo(?:\s+(?:akhir|awal|tersedia|saat\s+ini|sekarang))?|sisa\s+saldo)\s*[:.-]?$/i; // NOSONAR - anchored
// Resi isi-saldo/top up: nominalnya SALDO itu sendiri (pengeluaran nyata), bukan
// baris lain - dulu seluruh resi seperti ini dibuang (null).
const TOPUP_RE = /\btop\s*up\b|\btopup\b|isi\s*(?:ulang|saldo)|tambah\s*saldo|saldo\s*(?:bertambah|masuk)/i;
// Uang kembali, bukan pengeluaran.
const CHANGE_RE = /\bkembali(?:an)?\b/i;
// Uang yang diserahkan (kas) - hanya dipakai bila tidak ada baris Total.
const CASH_RE = /\btunai\b|\bcash\b|uang\s*pas/i;
// Label komponen struk: bagian dari perhitungan, BUKAN nominal akhir. Dipakai
// agar "Total Rp 90.000" menang atas "Subtotal Rp 100.000" saat ada diskon.
const COMPONENT_RE = /sub\s*total|subtotal|harga|diskon|discount|voucher|promo|cashback|ppn|pajak|\btax\b|ongkir|ongkos|biaya|admin|service|\bdpp\b|\btip\b|gratis/i;
// Label nominal akhir (longgar: OCR sering menulis "TotaI").
const TOTAL_LABEL_RE = /tota|juml|nomi|amount|dibayar|bayar|tagihan|transf/i;
// Sinyal keyword nominal (dipakai kolektor & klasifikasi).
const KW_RE = TOTAL_LABEL_RE;
// Baris travel ("Pulang 25000") - nominalnya harga tiket, bukan nomor referensi.
const TRAVEL_RE = /^(?:pulang|pergi)\b/i;
// Mata uang selain rupiah: lebih baik ditolak konsisten daripada diam-diam
// dicatat sebagai rupiah (dulu "$1,234.56" jadi 1234.56 tapi "$50.00" null).
const FOREIGN_RE = /[$€£¥₹]|\b(?:usd|sgd|myr|eur|gbp|jpy|cny|aud)\b/i;
// Huruf yang sering muncul menggantikan digit saat OCR salah baca.
const CONFUSABLE_RE = /[OoIlSsBbZzGgDq]/;
// Baris catatan manual pengguna ("Catatan: bensin") → note, bukan deskripsi.
const NOTE_FIELD_RE = /^(?:catatan|note|notes)\s*[:=-]\s*(.+)$/i; // NOSONAR - anchored, bounded

/** Baris yang menyebut saldo DAN memuat angka (nominal saldo). */
function isSaldoAmtLine(line: string): boolean {
  return SALDO_RE.test(line) && /\d/.test(line);
}

// Amount parsing — shared with chatParser (suffix + ID thousand/decimal rules).
function parseAmt(s: string): number | null {
  return parseAmountWithSuffix(s);
}

// Line analysis
function isRefLine(line: string): boolean {
  return /ref|resi|trace|\bID\b|account|rekening|akun|no\.?\s*transaksi|referensi|nomor/i.test(line);
}

function isDateFragment(line: string, raw: string): boolean {
  if (!/\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(line)) return false;
  if (!/^\d{1,4}$/.test(raw.replaceAll(/[.,]/g, ''))) return false;
  const datePart = /(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/.exec(line)?.[0] ?? '';
  return datePart.replaceAll(/\s/g, '').includes(raw.replaceAll(/\s/g, ''));
}

// 4.1: dulu nomor pada baris ref lolos bila barisnya memuat "Rp" (mis. OCR
// menggabungkan "No. Ref: Rp 982341234"). Angka ≥5 digit tanpa desimal pada
// baris ref adalah nomor referensi - skip walau ada Rp di baris yang sama.
function isRefLineNumber(digitsOnly: string, raw: string, line: string, hasRp: boolean): boolean {
  if (!isRefLine(line)) return false;
  if (/^\d{5,}$/.test(digitsOnly) && !/[,.]/.test(raw)) return true;
  return !hasRp;
}

/**
 * P0: token yang rusak karena OCR tidak boleh ditebak ("1O.000" bukan 10000).
 * Token dianggap rusak bila langsung bersinggungan dengan huruf confusable DAN
 * setelah huruf itu masih ada digit - pola khas `1O.000` / `5O0` / `l0`.
 * Akibatnya token dibuang; bila tak ada kandidat lain, parse menghasilkan null
 * sehingga pengguna mengetik manual daripada menyimpan nominal palsu.
 */
function isOcrBrokenToken(line: string, start: number, end: number): boolean {
  const before = line.slice(Math.max(0, start - 1), start);
  const after = line.charAt(end);
  if (!CONFUSABLE_RE.test(after) && !CONFUSABLE_RE.test(before)) return false;
  return /\d/.test(line.slice(end + 1, end + 3));
}

interface LineClass {
  totalish: boolean;
  component: boolean;
}
const NEUTRAL: LineClass = { totalish: false, component: false };

function classifyLine(t: string): LineClass {
  if (!t) return NEUTRAL;
  if (COMPONENT_RE.test(t)) return { totalish: false, component: true };
  if (TOTAL_LABEL_RE.test(t)) return { totalish: true, component: false };
  return NEUTRAL;
}

/**
 * Baris label nominal bisa berada di atas angkanya ("Total\nRp\n50.000").
 * Dua baris ke atas hanya dilihat bila baris di antaranya TIDAK memuat angka
 * (mis. "Rp" sendirian) - tanpa syarat ini "Transfer Successful" dua baris di
 * atas baris nomor rekening membuat nomor rekening ikut diklasifikasi nominal.
 */
function classifyAt(line: string, prev: string[]): LineClass {
  const own = classifyLine(line);
  if (own !== NEUTRAL) return own;
  const above1 = prev[0] ?? '';
  const cls1 = classifyLine(above1);
  if (cls1 !== NEUTRAL) return cls1;
  return /\d/.test(above1) ? NEUTRAL : classifyLine(prev[1] ?? '');
}

interface ReceiptHit extends RankedAmount {
  idx: number;
  /** Nominal saldo (bukan transaksi) - hanya dipakai untuk resi top up. */
  saldo: boolean;
  /** Uang kembali (Kembalian) - tidak pernah jadi pengeluaran. */
  change: boolean;
  /** Kas yang diserahkan (Tunai/Uang Pas) - kalah dari baris Total. */
  cash: boolean;
  /** Label nominal akhir (Total/Jumlah/Nominal). */
  totalish: boolean;
  /** Label komponen (Subtotal/Harga/Diskon/PPN/Biaya Admin/Ongkir). */
  component: boolean;
}

function shouldSkip(
  val: number,
  raw: string,
  ctx: { line: string; prevLine: string; rpSameLine: boolean; rpAny: boolean; hasRp: boolean },
): boolean {
  const { line, prevLine, rpSameLine, rpAny, hasRp } = ctx;
  const digitsOnly = raw.replaceAll(/\D/g, '');
  // P0: batas atas selaras chat (dulu "Rp 9999999999999999" lolos jadi 1e16).
  if (val > MAX_AMOUNT) return true;
  // Nomor pada baris ref tetap di-skip (Rp di baris yang sama tidak menolong).
  if (isRefLineNumber(digitsOnly, raw, line, rpSameLine)) return true;
  // Skip 4-digit years (1900-2099) when not on Rp line
  if (/^(19|20)\d{2}$/.test(digitsOnly) && !rpSameLine) return true;
  // Skip reference numbers: 5+ digits without Rp/keyword. Keyword (Total/
  // Jumlah/Transfer) menandakan baris itu nominal - "Jumlah Transfer 100000"
  // tanpa Rp tetap amount, bukan nomor referensi.
  // P0: `rpAny` HANYA mencakup "Rp" yang berdiri sendiri di baris berdampingan
  // ("Total\nRp\n50000"), bukan baris nominal lain - jika tidak, nomor rekening
  // di bawah "Rp 1.000.000,00" ("Dari 1234567890 a.n. ...") ikut lolos.
  if (/^\d{5,}$/.test(digitsOnly) && !rpAny && !KW_RE.test(line) && !KW_RE.test(prevLine) && !TRAVEL_RE.test(line) && !/[,.]/.test(raw)) return true;
  if (isDateFragment(line, raw)) return true;
  // P0: lantai penerimaan diselaraskan dengan chat (≥100 tanpa satuan Rupiah).
  // Sebelumnya 1000 sehingga "Total 900" (parkir/minuman) hilang.
  if (val < 100 && !/rb|ribu|k|jt|juta/i.test(raw) && !hasRp && !TRAVEL_RE.test(line)) return true;
  if (val > 999_999_999 && !rpSameLine) return true;
  return false;
}

function amountSuffixAt(line: string, end: number): string {
  return /^\s*(jt|juta|rb|ribu|k)\b/i.exec(line.slice(end, end + 8))?.[0] ?? '';
}

function collectHits(text: string): ReceiptHit[] { // NOSONAR
  const lines = text.split('\n');
  const hits: ReceiptHit[] = [];
  const rpLineRe = /\bRp\.?|\bIDR/i;
  // "Rp"/"IDR" yang berdiri sendiri di barisnya (OCR memotong simbol dari digit).
  const rpAloneRe = /^(?:rp\.?|idr)\.?$/i;
  const re = /\d[\d.,]*/g; // NOSONAR
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]!;
    const prevLine = idx > 0 ? lines[idx - 1]! : '';
    const prev2 = idx > 1 ? lines[idx - 2]! : '';
    const nextLine = lines[idx + 1] ?? '';
    // P2: mata uang selain rupiah tidak diparse sebagai rupiah.
    if (FOREIGN_RE.test(line) && !rpLineRe.test(line)) continue;
    // Rp pada baris yang sama = sinyal kuat (dipakai aturan nomor referensi).
    const rpSameLine = rpLineRe.test(line);
    // "Rp"/"IDR" sendirian di baris berdampingan = OCR memotong simbol dari
    // digit ("Total\nRp\n50000") - hanya bentuk telanjang ini yang dianggap
    // sinyal, bukan baris nominal lain ("Rp 1.000.000,00").
    const rpAloneNear = rpAloneRe.test(prevLine.trim()) || rpAloneRe.test(nextLine.trim());
    const rpAny = rpSameLine || rpAloneNear;
    // Sinyal Rp untuk skor & lantai nominal: baris sendiri, "Rp" telanjang di
    // sebelah, atau baris di atas yang hanya memuat penanda mata uang.
    const hasRp = rpSameLine || rpAloneNear || (rpLineRe.test(prevLine) && !/\d/.test(prevLine));
    const cls = classifyAt(line, [prevLine, prev2]);
    const kwNearby = KW_RE.test(line) || KW_RE.test(prevLine) || TRAVEL_RE.test(line);
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      // 4.2: normalizeAmountRaw dihapus - token berasal dari /\d[\d.,]*/ yang
      // sudah hanya digit/titik/koma, jadi penggantian O→0 / l→1 tak pernah
      // aktif. OCR "1O00" tetap terpotong di "1", bukan jadi "1000".
      // P0: token semacam itu sekarang DITOLAK (bukan ditebak).
      const start = m.index ?? 0;
      const end = start + m[0]!.length;
      if (isOcrBrokenToken(line, start, end)) continue;
      let raw = m[0]!.trim();
      const suf = amountSuffixAt(line, end);
      raw = raw + suf;
      const v = parseAmt(raw);
      if (!v || v <= 0) continue;
      const ctx = { line, prevLine, rpSameLine, rpAny, hasRp };
      if (shouldSkip(v, raw, ctx)) continue;
      // A3: baris "Saldo" murni yang diikuti angkanya ("Saldo\nAkhir: Rp 2 jt")
      // adalah informasi saldo, bukan transaksi.
      const saldo = isSaldoAmtLine(line) || SALDO_LABEL_RE.test(prevLine.trim());
      hits.push({
        value: v,
        index: start,
        idx,
        signals: {
          hasSuffix: /jt|juta|rb|ribu|k/i.test(suf),
          hasRp: hasRp,
          hasKeyword: kwNearby,
        },
        saldo,
        change: CHANGE_RE.test(line),
        cash: CASH_RE.test(line),
        totalish: cls.totalish && !saldo,
        component: cls.component,
      });
    }
  }
  return hits;
}

/**
 * Nominal transaksi.
 * P0: bila ada baris berlabel Total/Jumlah/Nominal, hanya baris itu yang
 * dipertimbangkan - sehingga "Subtotal Rp 100.000 / Diskon Rp 10.000 /
 * Total Rp 90.000" menghasilkan 90.000, bukan 100.000.
 */
function extractAmount(hits: ReceiptHit[], text: string): number | null {
  if (!hits.length) return null;
  const totalHits = hits.filter((h) => h.totalish);
  const hasTotal = totalHits.length > 0;
  const pool = (hasTotal ? totalHits : hits).filter(
    (h) => !h.saldo && !h.change && !(hasTotal && h.cash),
  );
  if (pool.length) return pickBestAmount(pool)!.value;
  // Sisa kandidat hanya saldo → resi isi-saldo/top up: nominalnya = saldo.
  if (TOPUP_RE.test(text)) {
    const saldoHits = hits.filter((h) => h.saldo);
    if (saldoHits.length) return pickBestAmount(saldoHits)!.value;
  }
  // Struk yang hanya memuat Kembalian bukan pengeluaran.
  return null;
}

// Date extraction — shared dmy/mmm parsing with chatParser.
function extractDate(text: string): string {
  return parseDMYDate(text) ?? todayLocalISO();
}

// Description extraction
// Share message markers (conversational: "halo aku sudah kirim Rpxxx...")
const SHARE_MARKERS: readonly RegExp[] = [
  /halo|hai/i,
  /aku\s+sudah/i,
  /sudah\s+(?:kirim|transfer)/i,
  /jangan\s+lupa/i,
  /tolong/i,
  /terima\s+kasih/i,
  /coba\s+cek/i,
  /sudah\s+diterima/i,
];
const KIRIM_TRANSFER_RE = /kirim|transfer/i;
const KE_RECIPIENT_RE = /(?:ke|kepada)\s+(.+)/i; // NOSONAR
const SOURCE_BOUNDARY_RE = /\s+(?:lewat|via|pakai|pake|dari)\s/i; // NOSONAR
const PRONOUN_RE = /^(?:akun|aku|kamu|saya|dia|itu|sini|situ|mana)$/i;
const TRAILING_PUNCT_RE = /[.,!]+$/g; // NOSONAR

// Detect conversational share messages
function isShareMessage(text: string): boolean {
  const lines = text.split('\n');
  return lines.length <= 3 && SHARE_MARKERS.some((re) => re.test(text));
}

// Extract recipient from "kirim/transfer RpXXX ke/kepada YYY (lewat/via ZZZ)"
function extractShareRecipient(text: string): string | undefined {
  const kirimIdx = text.search(KIRIM_TRANSFER_RE);
  if (kirimIdx === -1) return undefined;
  const afterKirim = text.slice(kirimIdx);
  const keMatch = KE_RECIPIENT_RE.exec(afterKirim);
  if (!keMatch?.[1]) return undefined;
  let name = keMatch[1].split(SOURCE_BOUNDARY_RE)[0]!.trim();
  name = name.replace(TRAILING_PUNCT_RE, '').trim();
  if (name.length < 2) return undefined;
  if (PRONOUN_RE.test(name)) return undefined;
  return name;
}

// Label metadata acquirer/payment-network pada resi QRIS merchant - bukan
// penerima ("Nama Acquirer", "PAN Merchant", "Merchant ID", "Sumber
// Transaksi"). Baris berlabel ini wajib ditolak sebagai kandidat deskripsi.
const ACQUIRER_LABEL_RE = /\bacquirer?\b|\bmerchant\s+id\b|\bmerchant\s+name\b|\bpan\s+merchant\b|\bpan\s+pelanggan\b|\bpan\s+customer\b|\bsumber\s+transaksi\b|\bsumber\s+dana\b|\bacquiring\s+bank\b|\bissuing\s+bank\b|\bsettlement\b|\bprocessor\b/i; // NOSONAR - anchored word-boundaries, bounded input

// Baris penerima berbasis nama - label Inggris ("Beneficiary/Account/Recipient
// Name", "Name:") maupun Indonesia ("Nama:", "Atas Nama", "Penerima:",
// "a.n."). Diprioritaskan di atas baris "Ke <no HP>" agar LinkAja/ShopeePay /
// transfer internasional dapat nama.
// Bentuk "a.n." menuntut separator titik/spasi di antara a-n-nama
// (`a[.\s]n[.\s]`) - tanpa itu kata biasa yang diawali "An/AN" (ANGGIE,
// Antoni, DIAN) akan salah tangkap sebagai label a.n.
const NAME_CAPTURE_RE =
  /(?:^|[\s(])(?:a[.\s]n[.\s]|(?:beneficiary|account|recipient)?\s*(?:atas\s+nama|name|nama)|penerima)\s*[:=]?\s*([A-Z][A-Za-z .'-]{1,})/i; // NOSONAR - bounded

function findHitLine(lines: string[]): string | undefined {
  const notAcquirer = (l: string) => !ACQUIRER_LABEL_RE.test(l);
  let hit = lines.find((l) => PRODUCT_RE.test(l));
  if (!hit) hit = lines.find((l) => notAcquirer(l) && NAME_CAPTURE_RE.test(l) && /[A-Za-z]{2,}/.test(l)); // Nama eksplisit lebih kaya drpd "Ke <hp>"
  // Label merchant eksplisit ("Merchant: PLN") - nilainya deskripsi, bukan label.
  if (!hit) hit = lines.find((l) => notAcquirer(l) && MERCHANT_LABEL_RE.test(l));
  if (!hit) hit = lines.find((l) => notAcquirer(l) && RECIPIENT_RE.test(l) && /(?:penerima|kepada|tujuan|ke)\s*[:-]?\s*[^\n]{2,}/i.test(l)); // NOSONAR
  if (!hit) hit = lines.find((l) => notAcquirer(l) && RECIPIENT_RE.test(l));
  if (!hit) hit = lines.find((l) => notAcquirer(l) && NOTE_RE.test(l));
  return hit;
}

// Baris merchant khas resi QRIS: ALL-CAPS tanpa label di awal resi ("TYA BUAH
// 2", "WARUNG KOPI SUDIANG"). Dicari sebelum baris nominal: 2-40 karakter,
// tanpa digit panjang, tanpa tanda baca (alamat/kota selalu bertanda),
// bukan baris berlabel penerima, bukan label tanggal/biaya/acquirer,
// bukan nama bank, dan minimal 40% huruf kapital (longgar untuk mixed-case,
// ketat untuk kalimat).
function findMerchantLine(lines: string[], amountIdx: number): string | undefined { // NOSONAR
  // `jam` HANYA dianggap label bila diikuti angka jam ("Jam 08:26") - tanpa ini
  // merchant bernama "TOKO 24 JAM" tertolak. Dipecah tiga agar tiap regex
  // di bawah ambang S5843 (≤20).
  const dateTimeSkipRe = /tanggal|waktu|\bwib\b|\bjam\s*\d/i;
  const statusSkipRe = /biaya|gratis|referen|\bstatus\b|metode|rincian|detail|berhasil|failed/i;
  const sourceBalanceSkipRe = /sumber\s+transaksi|sumber\s+dana|saldo|kembali|tunai|cash/i;
  const isSkippedLabel = (t: string): boolean =>
    dateTimeSkipRe.test(t) || statusSkipRe.test(t) || sourceBalanceSkipRe.test(t);
  const recipientLabelRe = new RegExp(`${PRODUCT_RE.source}|${NAME_CAPTURE_RE.source}|${RECIPIENT_RE.source}|${NOTE_RE.source}`, 'i');
  for (let i = 0; i < amountIdx && i < lines.length; i++) {
    const t = lines[i]!.trim();
    if (!t || t.length < 2 || t.length > 40) continue;
    if (isSkippedLabel(t) || ACQUIRER_LABEL_RE.test(t)) continue;
    // Baris berlabel penerima ("Beneficiary Name X", "Penerima: Y") bukan
    // merchant - biar jalur hit-line yang menanganinya (nama tepat, bukan
    // label + nama).
    if (recipientLabelRe.test(t)) continue;
    if (/\d{4,}/.test(t)) continue; // skip baris dg angka panjang
    // Baris merchant murni nama (huruf/spasi/digit pendek). Baris alamat/kota
    // ("JL. RAYA ...", "SURABAYA - JAWA TIMUR", "Sidoarjo (Kab)") selalu
    // bertanda baca - tolak agar tak menang atas nama toko di baris atas.
    if (/[./\-():,]/.test(t)) continue;
    if (detectSource(t)) continue; // skip baris nama bank
    // Minimal 40% huruf kapital (ciri merchant ALL-CAPS). Bukan 60%:
    // "Access By KAI Oo" hanya ~46% kapital tapi merchant valid, sementara
    // kalimat biasa ("Bukti Transaksi", "Dari Rina Wulandari") <30%.
    const letters = t.match(/[A-Za-z]/g) ?? [];
    const uppers = t.match(/[A-Z]/g) ?? [];
    if (letters.length >= 3 && uppers.length / letters.length >= 0.4) {
      return t;
    }
  }
  return undefined;
}

// Debris label OCR ikut ke-capture ("Nama Ac r" dari "Nama Akun").
// Bila hasil diawali fragmen label + mengandung token 1 huruf, dan baris
// berikut mirip nama (huruf, tanpa digit), pakai baris berikut ("FINPAY").
function preferNextLineName(desc: string, hitLine: string, lines: string[]): string {
  if (!/^(?:nama?|akun?|ac{1,2}|name?|rek(?:ening)?|no(?:mor)?|tgl|tanggal)\b/i.test(desc)) return desc;
  if (!/\b[a-zA-Z]\b/.test(desc)) return desc;
  const idx = lines.indexOf(hitLine);
  const next = idx >= 0 && idx + 1 < lines.length ? lines[idx + 1]!.trim() : '';
  if (next.length < 2 || next.length > 40 || !/[A-Za-z]{2,}/.test(next) || /\d/.test(next)) return desc;
  return next;
}

function nextLineIsName(lines: string[], hitLine: string): string {
  const idx = lines.indexOf(hitLine);
  if (idx < 0 || idx + 1 >= lines.length) return hitLine.trim();
  const next = lines[idx + 1]!.trim();
  // Baris berikutnya valid sebagai nama bila ≥2 huruf, ada huruf, tanpa digit
  return (next.length >= 2 && /[A-Za-z]{2,}/.test(next) && !/\d/.test(next))
    ? next
    : hitLine.trim();
}

function parseHitLine(hitLine: string, lines: string[]): string {
  // "Beneficiary Name LUKY DIAN SUSANTI" / "Dikirim ke 0812... a.n. SITI AMINAH"
  // → ambil nama setelah label, bukan nomor HP / label itu sendiri.
  let m: RegExpExecArray | null = NAME_CAPTURE_RE.exec(hitLine) ?? PRODUCT_RE.exec(hitLine);
  if (!m) m = /(?:penerima|kepada|beneficiary|berita|keterangan|tujuan|nama|atas\s*nama|merchant|ditransfer\s*ke|transfer\s*ke|ke)\s*[:-]?\s*(.+)/i.exec(hitLine); // NOSONAR
  let desc = m?.[1]?.trim() ?? '';
  if (desc.length < 2) {
    const after = hitLine.split(/:/).slice(1).join(':').trim();
    desc = after || nextLineIsName(lines, hitLine);
  }
  desc = desc.split(/[-–—]/)[0]!.trim();
  desc = desc.replace(/\s*\([^)]*\)\s*/g, ' ').trim(); // NOSONAR - bounded
  desc = desc.replace(/\s*\d{4,}[^\n]*$/, '').trim(); // NOSONAR - anchored, bounded
  desc = desc.replace(/\s{2,}/g, ' ').trim();
  desc = desc.replace(/^(?:penerima|kepada|ke|name)\s+/i, '').trim();
  return preferNextLineName(desc, hitLine, lines);
}

// Baris yang memang tidak layak jadi deskripsi.
const DESCRIPTION_BLOCK_RE = /tanggal|waktu|\bwib\b|\bjam\s*\d|biaya|gratis|referen|\bstatus\b|metode\s+pembayaran|sumber\s+dana|sumber\s+transaksi|rincian|detail\s+transaksi|transfer\s+berhasil|berhasil|transfer\s+successful|transfer\s+failed|pembayaran\s+berhasil|transaksi\s+berhasil/i; // NOSONAR
// Tanggal juga menangkap bulan+tahun tanpa hari ("Sep 2026") - tanpa ini baris
// tanggal bisa tersimpan sebagai deskripsi transaksi.
const DATE_LINE_RE = /(?:\d{1,2}\s*)?(?:jan|feb|mar|apr|mei|jun|jul|agu|aug|sep|okt|oct|nov|des|dec)\w*\s*\d{2,4}|\d{1,2}:\d{2}/i; // NOSONAR
const NAME_LABEL_RE = /^(?:nama?|akun?|ac{1,2}|name?|rek(?:ening)?|nomor|no\.?|tgl)\b/i;

// Deskripsi yang hanya label atau hanya label+nominal - bukan nama merchant.
const LABEL_ONLY_RE = /^(?:total|sub\s*total|subtotal|jumlah|nominal|amount|merchant|tunai|cash|kembalian|kembali|saldo|tanggal|waktu|biaya|gratis|penerima|pengirim|berita|keterangan|catatan|note|product|produk|transfer|pembayaran|bayar|transaksi|bukti\s+transaksi|qris|struk|invoice)\b[\s:=-]*$/i; // NOSONAR

/**
 * Buang deskripsi yang sebenarnya label/nominal/nomor, bukan nama.
 * P0/P1: dulu "Total Rp 1.234.567,89" atau "Nama Acquirer" bisa tersimpan
 * sebagai deskripsi transaksi sehingga pengguna harus mengedit manual.
 */
function sanitizeDesc(raw: string): string {
  const s = raw.replaceAll(/\s+/g, ' ').trim();
  if (!s) return '';
  if (LABEL_ONLY_RE.test(s)) return '';
  if (/\b(?:rp|idr)\b/i.test(s)) return '';
  if (ACQUIRER_LABEL_RE.test(s)) return '';
  if (SALDO_RE.test(s) || CHANGE_RE.test(s) || CASH_RE.test(s)) return '';
  if (NOTE_FIELD_RE.test(s)) return ''; // label catatan ("Catatan: bensin")
  if (/\d[.,]\d{3}/.test(s)) return ''; // nominal bertitik ribuan
  if (!/\s/.test(s) && s.length > 40) return ''; // derau OCR satu token panjang
  if ((s.match(/\d/g) ?? []).length >= 7) return ''; // nomor rekening/ref
  if ((s.match(/[A-Za-z]/g) ?? []).length < 3) return ''; // debris OCR ("( .. eo")
  if (/\.{3,}/.test(s)) return ''; // derau titik ("......7056")
  return s;
}

function findFallbackDesc(lines: string[], amountIdxs: Set<number>, src: string | undefined): string {
  const srcLower = src?.toLowerCase();
  const srcNorm = srcLower?.replaceAll(/[^a-z]/g, '');
  const usable = (l: string, i: number): boolean => {
    const t = l.trim();
    if (amountIdxs.has(i) || t.length <= 3 || /biaya admin/i.test(t)) return false;
    if (srcLower && (t.toLowerCase() === srcLower || t.toLowerCase() === 'bank ' + srcLower)) return false;
    // "by mandiri" adalah header sumber, bukan merchant
    if (srcNorm && t.toLowerCase().replaceAll(/[^a-z]/g, '') === 'by' + srcNorm) return false;
    if (DESCRIPTION_BLOCK_RE.test(t) || DATE_LINE_RE.test(t) || NAME_LABEL_RE.test(t)) return false;
    if (ACQUIRER_LABEL_RE.test(t)) return false;
    if (/\bpan\b/i.test(t) && /\d/.test(t)) return false;
    // (dulu) jalur terakhir tanpa filter ini membocorkan "( .. eo" /
    // "Nama Acquirer" / "Saldo Awal" sebagai deskripsi.
    return sanitizeDesc(t) !== '';
  };
  return lines.find((l, i) => usable(l, i))?.trim() ?? '';
}

function finalizeDesc(raw: string): string {
  let d = raw.replaceAll(/\s+/g, ' ').trim();
  d = d.replace(/\s+Oo\s*$/i, '').trim(); // NOSONAR - anchored, bounded
  d = sanitizeDesc(d);
  if (!d) return 'Transfer';
  d = titleCasePreserveAcronyms(d).slice(0, 80);
  // "TOKO A.B.C" → title-case merusaknya jadi "Toko A.b.c": kembalikan
  // segmen akronim bertitik ke huruf kapital.
  d = d.replace(/\b(?:[A-Za-z]\.)+[A-Za-z]\b/g, (m) => m.toUpperCase()); // NOSONAR - anchored, bounded
  // 4.4: dulu pemotongan di "dari/pakai/via" terjadi buta sehingga nama seperti
  // "Nasi Goreng Dari Abang" atau "Toko Via" ikut terpotong. Sekarang potong
  // HANYA bila sisa teks setelah kata kunci adalah sumber dana yang dikenal
  // ("... dari BCA"), yaitu klausa sumber sungguhan pada deskripsi.
  const kws = [' dari ', ' pakai ', ' pake ', ' via '];
  let cut = -1;
  for (const k of kws) {
    let idx = d.toLowerCase().indexOf(k);
    while (idx !== -1) {
      const tail = d.slice(idx + k.length).trim();
      if (detectSource(tail)) {
        if (cut === -1 || idx < cut) cut = idx;
        break;
      }
      idx = d.toLowerCase().indexOf(k, idx + 1);
    }
  }
  return ((cut === -1 ? d : d.slice(0, cut)).trim() || 'Transfer');
}

function extractDescription(text: string, hits: ReceiptHit[]): { desc: string; source?: string } {
  // Check for conversational share message first
  if (isShareMessage(text)) {
    const recipient = extractShareRecipient(text);
    if (recipient) return { desc: finalizeDesc(recipient) };
    // No recipient found - use "Transfer" as generic description
    return { desc: 'Transfer' };
  }
  const lines = text.split('\n');
  // Prioritas QRIS merchant: baris nama toko ALL-CAPS tanpa label sebelum
  // nominal ("TYA BUAH 2"). Wajib di depan findHitLine - bila sesudahnya,
  // "Nama Acquirer" selalu menang dan merchant terabaikan.
  // amountIdx = baris nominal pertama ≥1000 (bukan hits[0] mentah: angka kecil
  // seperti "2" di "TYA BUAH 2" juga menjadi hit dan memotong scan ke 0).
  const firstAmt = hits.find((h) => h.value >= 1000);
  const amountIdx = firstAmt ? firstAmt.idx : lines.length;
  const merchantLine = findMerchantLine(lines, amountIdx);
  if (merchantLine) {
    const merchantDesc = titleCasePreserveAcronyms(merchantLine).slice(0, 80);
    if (!isDebrisDesc(merchantDesc, merchantLine)) {
      return { desc: finalizeDesc(merchantDesc) };
    }
  }
  const hitLine = findHitLine(lines);
  let desc = '';
  if (hitLine) {
    const hitDesc = parseHitLine(hitLine, lines);
    // Debris OCR di hit-line → buang, fallback merchant yang dipakai
    if (!isDebrisDesc(hitDesc, hitLine)) desc = hitDesc;
  }
  if (!desc) {
    // Resi isi-saldo/top up: deskripsi generiknya "Top Up", bukan "Transfer".
    if (TOPUP_RE.test(text)) return { desc: 'Top Up' };
    const src = detectSource(text);
    desc = findFallbackDesc(lines, new Set(hits.map((h) => h.idx)), src);
  }
  return { desc: finalizeDesc(desc) };
}

// Debris OCR di desc hasil hit-line: capture pendek dari baris berlabel-rusak
// ("Nama Ac r" → "Ac R", "Beneficiary PAN …" → "Pan"). Kembalikan '' agar
// fallback (baris merchant) yang dipakai. Akronim dikenal (KPR/OVO) lolos.
function isDebrisDesc(desc: string, hitLine: string): boolean {
  const s = desc.trim();
  if (!s) return true;
  const hasSingleCharToken = /\b[a-zA-Z]\b/.test(hitLine);
  if (s.length < 5 && hasSingleCharToken) return true;
  // Short non-acronym token is debris only when the hit line itself looks
  // broken (digit runs like "Beneficiary PAN 9360…" or single-char tokens).
  // Plain "Ke: Ani" keeps "Ani" - a valid short name.
  if (/^[A-Za-z]{1,3}$/.test(s) && !ACRONYMS.has(s.toUpperCase())
    && (hasSingleCharToken || /\d{2,}/.test(hitLine))) return true;
  if (/^[A-Z]{4,}$/.test(s) && hasSingleCharToken && /^[A-Za-z ]+$/.test(s)) return true;
  return false;
}

// Note extraction
function extractNote(text: string): string | undefined {
  const lines = text.split('\n');
  for (const l of lines) {
    const t = l.trim();
    // Catatan manual pengguna ("Catatan: bensin") - dulu tidak pernah diambil
    // sehingga hilang dari transaksi.
    const field = NOTE_FIELD_RE.exec(t);
    if (field?.[1] && field[1].trim().length >= 2) {
      const v = field[1].replaceAll(/\s+/g, ' ').trim();
      if (!/\b(?:rp|idr)\b/i.test(v) && !/\d{4,}/.test(v)) {
        return titleCasePreserveAcronyms(v).slice(0, 80);
      }
    }
    // Match "Pulang X" or "Pergi X" (travel/ride receipt notes)
    const travelRe = /^(pulang|pergi)\s+(.+)$/i; // NOSONAR - anchored, bounded
    const m = travelRe.exec(t);
    if (m?.[2] && m[2].trim().length >= 2) {
      return titleCasePreserveAcronyms(t).slice(0, 80);
    }
  }
  return undefined;
}

/** Prioritas sumber: bank pengirim (baris non-acquirer) menang atas acquirer. */
function extractSource(text: string): string | undefined {
  const withoutAcquirerOnly = text
    .split('\n')
    .filter((l) => !ACQUIRER_LABEL_RE.test(l) || /sumber\s+transaksi/i.test(l))
    .join('\n');
  if (withoutAcquirerOnly !== text) {
    const sender = detectSource(withoutAcquirerOnly);
    if (sender) return sender;
  }
  return detectSource(text);
}

// Main export
export function parseReceiptText(text: string): { description: string; amount: number; date: string; rawText: string; note?: string; source?: string } | null {
  // A2: Batasi panjang input untuk cegah ReDoS - regex kompleks
  // pada text panjang (amount candidate, source detect, label chain).
  const bounded = text.slice(0, MAX_SCAN);
  const rawText = bounded;
  // Satu kali scan baris untuk semua kebutuhan (nominal, deskripsi, sumber):
  // dulu collectHits dipanggil dua kali dengan filter berbeda.
  const hits = collectHits(bounded);
  const amount = extractAmount(hits, bounded);
  if (amount == null) return null;

  const { desc: description } = extractDescription(bounded, hits);
  const source = extractSource(bounded);
  const note = extractNote(bounded);

  return {
    description,
    amount,
    date: extractDate(bounded),
    rawText,
    note,
    source,
  };
}
