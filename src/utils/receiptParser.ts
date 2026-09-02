import { detectSource } from './sources';
import { normalizeNumber } from './chatParser';
import { titleCasePreserveAcronyms } from './textFormat';

// ─── Shared constants ────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', mei: '05', jun: '06',
  jul: '07', agu: '08', aug: '08', sep: '09', okt: '10', oct: '10',
  nov: '11', des: '12', dec: '12',
};

const PRODUCT_RE = /^(?:product|produk)\s*[:-]?\s*(.+)/i; // NOSONAR - anchored, bounded
const RECIPIENT_RE = /penerima|kepada|tujuan|ditransfer\s*ke|^\s*ke\b|transfer\s*ke\b/i;
const NOTE_RE = /berita|keterangan|beneficiary/i;

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

function normalizeAmountRaw(raw: string): string {
  return raw.replaceAll('O', '0').replaceAll('o', '0').replaceAll(/[lI]/g, '1').trim();
}

// ─── Line analysis ────────────────────────────────────────────────────────────

function isRefLine(line: string): boolean {
  return /ref|resi|trace|\bID\b|account|rekening|akun|no\.?\s*transaksi/i.test(line);
}

function isDateFragment(line: string, raw: string): boolean {
  if (!/\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(line)) return false;
  if (!/^\d{1,4}$/.test(raw.replaceAll(/[.,]/g, ''))) return false;
  const datePart = /(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/.exec(line)?.[0] ?? '';
  return datePart.replaceAll(/\s/g, '').includes(raw.replaceAll(/\s/g, ''));
}

function shouldSkip(val: number, raw: string, line: string, prevLine: string, rpRe: RegExp): boolean {
  // Skip any number on a ref/account/ID line
  if (isRefLine(line) && !rpRe.test(line)) return true;
  const digitsOnly = raw.replaceAll(/\D/g, '');
  // Skip 4-digit years (1900-2099) when not on Rp line
  if (/^(19|20)\d{2}$/.test(digitsOnly) && !rpRe.test(line)) return true;
  // Skip reference numbers: 5+ digits without Rp/keyword
  if (/^\d{5,}$/.test(digitsOnly) && !rpRe.test(line) && !/[,.]/.test(raw)) return true;
  if (isDateFragment(line, raw)) return true;
  if (val < 1000 && !/rb|ribu|k|jt|juta/i.test(raw) && !rpRe.test(line) && !rpRe.test(prevLine)) return true;
  if (val > 999_999_999 && !rpRe.test(line)) return true;
  return false;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreHit(val: number, hasRp: boolean, hasKeyword: boolean): number {
  return val * (hasRp ? 1.9 : 1) * (hasKeyword ? 2.2 : 1);
}

function pickBest(hits: { val: number; hasRp: boolean; hasKeyword: boolean }[]): { val: number; hasRp: boolean; hasKeyword: boolean } {
  let best = hits[0]!;
  let bestScore = scoreHit(best.val, best.hasRp, best.hasKeyword);
  for (let i = 1; i < hits.length; i++) {
    const h = hits[i]!;
    const s = scoreHit(h.val, h.hasRp, h.hasKeyword);
    if (s > bestScore || (s === bestScore && h.val > best.val)) {
      best = h;
      bestScore = s;
    }
  }
  return best;
}

function collectHits(text: string): { val: number; hasRp: boolean; hasKeyword: boolean }[] { // NOSONAR
  const lines = text.split('\n');
  const hits: { val: number; hasRp: boolean; hasKeyword: boolean }[] = [];
  const kw = /tota|juml|nomi|transf|bayar|jumlah/i;
  const rpLineRe = /\bRp\.?|\bIDR/i;
  const re = /\d[\d.,]*/g; // NOSONAR
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]!;
    const prevLine = idx > 0 ? lines[idx - 1]! : '';
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      let raw0 = m[0]!.trim();
      const suf = /^\s*(jt|juta|rb|ribu|k)\b/i.exec(line.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 8))?.[0] ?? '';
      raw0 = raw0 + suf;
      const raw = normalizeAmountRaw(raw0);
      const v = parseAmt(raw);
      if (!v || v <= 0) continue;
      if (shouldSkip(v, raw, line, prevLine, rpLineRe)) continue;
      const hasRp = rpLineRe.test(line) || rpLineRe.test(prevLine);
      const hasKeyword = kw.test(line) || kw.test(prevLine);
      hits.push({ val: v, hasRp, hasKeyword });
    }
  }
  return hits;
}

function extractAmount(text: string): number | null {
  const hits = collectHits(text);
  if (!hits.length) return null;
  const best = pickBest(hits);
  const rpHits = hits.filter((h) => h.hasRp);
  if (!best.hasRp && !best.hasKeyword && rpHits.length) {
    let bestRp = rpHits[0]!;
    for (let i = 1; i < rpHits.length; i++) if (rpHits[i]!.val > bestRp.val) bestRp = rpHits[i]!;
    if (bestRp.val >= best.val * 0.8) return bestRp.val;
  }
  return best.val;
}

// ─── Date extraction ──────────────────────────────────────────────────────────

function extractDate(text: string): string {
  // "31/08/2026"
  const ddmmyyyy = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(text); // NOSONAR
  if (ddmmyyyy) {
    const d = ddmmyyyy[1]!.padStart(2, '0');
    const m = ddmmyyyy[2]!.padStart(2, '0');
    let y = ddmmyyyy[3]!;
    if (y.length === 2) y = '20' + y;
    return `${y}-${m}-${d}`;
  }
  // "31 Agustus 2026" or "01Sep 2026" (OCR without space)
  const mmm = /(\d{1,2})\s*(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Aug|Sep|Okt|Oct|Nov|Des|Dec)\w*\s+(\d{4})/i.exec(text); // NOSONAR
  if (mmm) {
    const mon = MONTH_MAP[mmm[2]!.toLowerCase().slice(0, 3)];
    if (mon) return `${mmm[3]}-${mon}-${mmm[1]!.padStart(2, '0')}`;
  }
  return new Date().toISOString().slice(0, 10);
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

function findHitLine(lines: string[]): string | undefined {
  let hit = lines.find((l) => PRODUCT_RE.test(l));
  if (!hit) hit = lines.find((l) => RECIPIENT_RE.test(l) && /(?:penerima|kepada|tujuan|ke)\s*[:-]?\s*[^\n]{2,}/i.test(l)); // NOSONAR
  if (!hit) hit = lines.find((l) => RECIPIENT_RE.test(l));
  if (!hit) hit = lines.find((l) => NOTE_RE.test(l));
  return hit;
}

function parseHitLine(hitLine: string, lines: string[]): string {
  let m = PRODUCT_RE.exec(hitLine);
  if (!m) m = /(?:penerima|kepada|beneficiary|berita|keterangan|tujuan|ditransfer\s*ke|transfer\s*ke|ke)\s*[:-]?\s*(.+)/i.exec(hitLine); // NOSONAR
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
  return desc;
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
  d = d.replace(/\b(?:di|ke|untuk|dengan)\b/gi, '').replace(/\s{2,}/g, ' ').trim() || 'Transfer';
  d = d.replace(/\s+Oo\s*$/i, '').trim() || 'Transfer'; // NOSONAR - anchored, bounded
  d = titleCasePreserveAcronyms(d).slice(0, 80);
  const kws = [' dari ', ' pakai ', ' pake ', ' via '];
  let cut = -1;
  for (const k of kws) {
    const idx = d.toLowerCase().indexOf(k);
    if (idx !== -1 && (cut === -1 || idx < cut)) cut = idx;
  }
  return (cut === -1 ? d : d.slice(0, cut)).trim();
}

function extractDescription(text: string, hits: { idx: number }[]): { desc: string; source?: string } {
  // Check for conversational share message first
  if (isShareMessage(text)) {
    const recipient = extractShareRecipient(text);
    if (recipient) return { desc: finalizeDesc(recipient) };
    // No recipient found — use "Transfer" as generic description
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
      let raw0 = m[0]!.trim();
      const suf = /^\s*(jt|juta|rb|ribu|k)\b/i.exec(line.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 8))?.[0] ?? '';
      raw0 = raw0 + suf;
      const v = parseAmt(normalizeAmountRaw(raw0));
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
