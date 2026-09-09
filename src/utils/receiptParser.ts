import { detectSource } from './sources';
import { normalizeNumber, MONTH_MAP, clampDayISO } from './chatParser';
import { todayLocalISO } from './date';
import { titleCasePreserveAcronyms } from './textFormat';
import { pickBestAmount, type RankedAmount } from './amountRank';

const PRODUCT_RE = /^(?:product|produk)\s*[:-]?\s*(.+)/i; // NOSONAR - anchored, bounded
const RECIPIENT_RE = /penerima|kepada|tujuan|ditransfer\s*ke|^\s*ke\b|transfer\s*ke\b|dikirim\s*ke/i;
// Catatan: deteksi "a.n." di sini WAJIB diakhiri spasi (`a\.?\s*n\.?\s`) agar
// kata biasa yang diawali "An/AN" (Transfer, BANDUNG, ANGGIE) tak tertangkap
// sebagai label penerima.
const NOTE_RE = /berita|keterangan|beneficiary|atas\s+nama|\bnama\b|\bname\b|\ba\.?\s*n\.?\s|a\/n/i;
// Baris yang menyebut "saldo" adalah informasi saldo, bukan nominal transaksi
// (resi DANA/OVO: "Rp 250.000 ... Saldo Rp 1.000.000" → nominal = 250.000).
const SALDO_RE = /\bsaldo\b/i;

// ─── Amount parsing ───────────────────────────────────────────────────────────

function parseAmt(s: string): number | null {
  const c = s.toLowerCase().replaceAll(/\s/g, '');
  let m: RegExpExecArray | null;
  m = /^([\d.,]+)\s*(jt|juta)$/i.exec(c);
  if (m) {
    const n = normalizeNumber(m[1]!);
    return n > 0 ? n * 1_000_000 : null;
  }
  m = /^([\d.,]+)\s*(rb|ribu|k)$/i.exec(c);
  if (m) {
    const n = normalizeNumber(m[1]!);
    return n > 0 ? n * 1_000 : null;
  }
  m = /^[\d.,]+$/.exec(c);
  if (m) {
    const n = normalizeNumber(m[0]!);
    return n > 0 ? n : null;
  }
  return null;
}

// ─── Line analysis ────────────────────────────────────────────────────────────

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
function isRefLineNumber(digitsOnly: string, raw: string, line: string, rpRe: RegExp): boolean {
  if (!isRefLine(line)) return false;
  if (/^\d{5,}$/.test(digitsOnly) && !/[,.]/.test(raw)) return true;
  return !rpRe.test(line);
}

function shouldSkip(val: number, raw: string, line: string, prevLine: string, rpRe: RegExp, kwRe: RegExp): boolean {
  const digitsOnly = raw.replaceAll(/\D/g, '');
  // Saldo ≠ nominal transaksi - skip baris yang menyebut saldo (DANA/OVO).
  if (SALDO_RE.test(line) || SALDO_RE.test(prevLine)) return true;
  if (isRefLineNumber(digitsOnly, raw, line, rpRe)) return true;
  // Skip 4-digit years (1900-2099) when not on Rp line
  if (/^(19|20)\d{2}$/.test(digitsOnly) && !rpRe.test(line)) return true;
  // Skip reference numbers: 5+ digits without Rp/keyword. Keyword (Total/
  // Jumlah/Transfer) menandakan baris itu nominal - "Jumlah Transfer 100000"
  // tanpa Rp tetap amount, bukan nomor referensi.
  if (/^\d{5,}$/.test(digitsOnly) && !rpRe.test(line) && !kwRe.test(line) && !kwRe.test(prevLine) && !/[,.]/.test(raw)) return true;
  if (isDateFragment(line, raw)) return true;
  if (val < 1000 && !/rb|ribu|k|jt|juta/i.test(raw) && !rpRe.test(line) && !rpRe.test(prevLine)) return true;
  if (val > 999_999_999 && !rpRe.test(line)) return true;
  return false;
}

// ─── Scoring (shared formula, see amountRank) ──────────────────────────────────

interface ReceiptHit extends RankedAmount {
  idx: number;
}

// Keyword nominal - dipakai collectHits (sinyal) & extractAmount (deteksi Total).
const KW_RE = /tota|juml|nomi|transf|bayar|jumlah/i;

function collectHits(text: string): ReceiptHit[] { // NOSONAR
  const lines = text.split('\n');
  const hits: ReceiptHit[] = [];
  const rpLineRe = /\bRp\.?|\bIDR/i;
  const re = /\d[\d.,]*/g; // NOSONAR
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]!;
    const prevLine = idx > 0 ? lines[idx - 1]! : '';
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      // 4.2: normalizeAmountRaw dihapus - token berasal dari /\d[\d.,]*/ yang
      // sudah hanya digit/titik/koma, jadi penggantian O→0 / l→1 tak pernah
      // aktif. OCR "1O00" tetap terpotong di "1", bukan jadi "1000".
      let raw = m[0]!.trim();
      const suf = /^\s*(jt|juta|rb|ribu|k)\b/i.exec(line.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 8))?.[0] ?? '';
      raw = raw + suf;
      const v = parseAmt(raw);
      if (!v || v <= 0) continue;
      if (shouldSkip(v, raw, line, prevLine, rpLineRe, KW_RE)) continue;
      const hasRp = rpLineRe.test(line) || rpLineRe.test(prevLine);
      const hasKeyword = KW_RE.test(line) || KW_RE.test(prevLine);
      const hasSuffix = /jt|juta|rb|ribu|k/i.test(suf);
      hits.push({ value: v, index: m.index ?? 0, idx, signals: { hasSuffix, hasRp, hasKeyword } });
    }
  }
  return hits;
}

function extractAmount(text: string): number | null {
  const hits = collectHits(text);
  if (!hits.length) return null;
  const lines = text.split('\n');
  // Struk belanja: Tunai (uang diserahkan) & Kembalian (uang kembali) bukan
  // pengeluaran - yang dibayar = Total. Bila ada kandidat ber-keyword Total,
  // buang kandidat Tunai; Kembalian tidak pernah jadi nominal.
  const CASH_LINE_RE = /\btunai\b|cash|uang\s*pas/i;
  const CHANGE_LINE_RE = /kembali/i;
  const hasTotal = hits.some((h) => KW_RE.test(lines[h.idx] ?? ''));
  const use = hits.filter((h) => {
    const line = lines[h.idx] ?? '';
    if (CHANGE_LINE_RE.test(line)) return false;
    if (hasTotal && CASH_LINE_RE.test(line)) return false;
    return true;
  });
  const pool = use.length ? use : hits;
  // 4.3: guard "bestRp ≥ 80% best" lama dihapus - tier-scoring di amountRank
  // sudah menempatkan kandidat bersinyal Rp di atas angka polos, jadi cabang
  // fallback tersebut mati/tidak konsisten secara desain.
  return pickBestAmount(pool)!.value;
}

// ─── Date extraction ──────────────────────────────────────────────────────────

function extractDate(text: string): string {
  // "31/08/2026"
  const ddmmyyyy = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(text); // NOSONAR
  if (ddmmyyyy) {
    let y = Number(ddmmyyyy[3]);
    if (ddmmyyyy[3]!.length === 2) y += 2000;
    return clampDayISO(y, Number(ddmmyyyy[2]), Number(ddmmyyyy[1]));
  }
  // "31 Agustus 2026", "01Sep 2026", atau OCR menempel "01Sep2026" (5.2):
  // spasi sebelum tahun dibuat opsional (\s*) karena OCR sering menggabungkan.
  const mmm = /(\d{1,2})\s*(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Aug|Sep|Okt|Oct|Nov|Des|Dec)\w*\s*(\d{4})/i.exec(text); // NOSONAR
  if (mmm) {
    const mon = MONTH_MAP[mmm[2]!.toLowerCase().slice(0, 3)];
    if (mon) return clampDayISO(Number(mmm[3]), Number(mon), Number(mmm[1]));
  }
  return todayLocalISO();
}

// ─── Description extraction ───────────────────────────────────────────────────

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
  let hit = lines.find((l) => PRODUCT_RE.test(l));
  if (!hit) hit = lines.find((l) => NAME_CAPTURE_RE.test(l) && /[A-Za-z]{2,}/.test(l)); // Nama eksplisit lebih kaya drpd "Ke <hp>"
  if (!hit) hit = lines.find((l) => RECIPIENT_RE.test(l) && /(?:penerima|kepada|tujuan|ke)\s*[:-]?\s*[^\n]{2,}/i.test(l)); // NOSONAR
  if (!hit) hit = lines.find((l) => RECIPIENT_RE.test(l));
  if (!hit) hit = lines.find((l) => NOTE_RE.test(l));
  return hit;
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

function parseHitLine(hitLine: string, lines: string[]): string {
  // "Beneficiary Name LUKY DIAN SUSANTI" / "Dikirim ke 0812... a.n. SITI AMINAH"
  // → ambil nama setelah label, bukan nomor HP / label itu sendiri.
  let m: RegExpExecArray | null = NAME_CAPTURE_RE.exec(hitLine) ?? PRODUCT_RE.exec(hitLine);
  if (!m) m = /(?:penerima|kepada|beneficiary|berita|keterangan|tujuan|nama|atas\s*nama|ditransfer\s*ke|transfer\s*ke|ke)\s*[:-]?\s*(.+)/i.exec(hitLine); // NOSONAR
  let desc = m?.[1]?.trim() ?? '';
  if (desc.length < 2) {
    const after = hitLine.split(/:/).slice(1).join(':').trim();
    if (after) desc = after;
    else {
      const idx = lines.indexOf(hitLine);
      desc = idx >= 0 && idx + 1 < lines.length ? lines[idx + 1]!.trim() : hitLine.trim();
    }
  }
  desc = desc.split(/[-–—]/)[0]!.trim();
  desc = desc.replace(/\s*\([^)]*\)\s*/g, ' ').trim(); // NOSONAR - bounded
  desc = desc.replace(/\s*\d{4,}[^\n]*$/, '').trim(); // NOSONAR - anchored, bounded
  desc = desc.replace(/\s{2,}/g, ' ').trim();
  desc = desc.replace(/^(?:penerima|kepada|ke|name)\s+/i, '').trim();
  return preferNextLineName(desc, hitLine, lines);
}

function findFallbackDesc(lines: string[], hits: { idx: number }[], src: string | undefined): string {
  const amountIdxs = new Set(hits.map((h) => h.idx));
  const srcLower = src?.toLowerCase();
  const skipRe = /^\d{6,}$/;
  return (
    lines.find((l, i) => {
      const t = l.trim();
      if (amountIdxs.has(i) || t.length <= 3 || /biaya admin/i.test(t)) return false;
      if (skipRe.test(t.replaceAll(/\D/g, ''))) return false;
      if (srcLower && (t.toLowerCase() === srcLower || t.toLowerCase() === 'bank ' + srcLower)) return false;
      return true;
    })?.trim() ??
    lines.find((l) => l.trim().length > 3 && !/biaya admin/i.test(l))?.trim() ??
    ''
  );
}

function finalizeDesc(raw: string): string {
  let d = raw.replaceAll(/\s+/g, ' ').trim() || 'Transfer';
  d = d.replace(/\s+Oo\s*$/i, '').trim() || 'Transfer'; // NOSONAR - anchored, bounded
  d = titleCasePreserveAcronyms(d).slice(0, 80);
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
  return (cut === -1 ? d : d.slice(0, cut)).trim();
}

function extractDescription(text: string, hits: { idx: number }[]): { desc: string; source?: string } {
  // Check for conversational share message first
  if (isShareMessage(text)) {
    const recipient = extractShareRecipient(text);
    if (recipient) return { desc: finalizeDesc(recipient) };
    // No recipient found - use "Transfer" as generic description
    return { desc: 'Transfer' };
  }
  const lines = text.split('\n');
  const hitLine = findHitLine(lines);
  let desc = '';
  if (hitLine) desc = parseHitLine(hitLine, lines);
  if (!desc) {
    const src = detectSource(text);
    desc = findFallbackDesc(lines, hits, src);
  }
  return { desc: finalizeDesc(desc) };
}

// ─── Note extraction ─────────────────────────────────────────────────────────

function extractNote(text: string): string | undefined {
  const lines = text.split('\n');
  // Match "Pulang X" or "Pergi X" (travel/ride receipt notes)
  const travelRe = /^(pulang|pergi)\s+(.+)$/i; // NOSONAR - anchored, bounded
  for (const l of lines) {
    const m = travelRe.exec(l.trim());
    if (m?.[2] && m[2].trim().length >= 2) {
      return titleCasePreserveAcronyms(l.trim()).slice(0, 80);
    }
  }
  return undefined;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function parseReceiptText(text: string): { description: string; amount: number; date: string; rawText: string; note?: string; source?: string } | null {
  const rawText = text.slice(0, 500);
  const amount = extractAmount(text);
  if (amount == null) return null;

  const lines = text.split('\n');
  const hits: { idx: number }[] = [];
  const re = /\d[\d.,]*/g; // NOSONAR
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]!;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      let raw = m[0]!.trim();
      const suf = /^\s*(jt|juta|rb|ribu|k)\b/i.exec(line.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 8))?.[0] ?? '';
      raw = raw + suf;
      const v = parseAmt(raw);
      if (v && v > 0) hits.push({ idx });
    }
  }

  const { desc: description } = extractDescription(text, hits);
  const source = detectSource(text);
  const note = extractNote(text);

  return {
    description,
    amount,
    date: extractDate(text),
    rawText,
    note,
    source,
  };
}
