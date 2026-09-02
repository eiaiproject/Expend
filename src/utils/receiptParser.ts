import { detectSource } from './sources';
import { normalizeNumber } from './chatParser';
import { titleCasePreserveAcronyms } from './textFormat';

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
  return /ref|resi|trace|\bID\b/i.test(line);
}

function isDateFragment(line: string, raw: string): boolean {
  if (!/\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(line)) return false;
  if (!/^\d{1,4}$/.test(raw.replaceAll(/[.,]/g, ''))) return false;
  const datePart = /(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/.exec(line)?.[0] ?? '';
  return datePart.replaceAll(/\s/g, '').includes(raw.replaceAll(/\s/g, ''));
}

function shouldSkip(val: number, raw: string, line: string, prevLine: string, rpRe: RegExp): boolean {
  const digitsOnly = raw.replaceAll(/\D/g, '');
  if (/^\d{6,}$/.test(digitsOnly) && !rpRe.test(line) && (isRefLine(line) || !/[,.]/.test(raw))) return true;
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
  const rpLineRe = /R\s*P\s*\.?:?|IDR/i;
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

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', mei: '05', jun: '06',
  jul: '07', agu: '08', aug: '08', sep: '09', okt: '10', oct: '10',
  nov: '11', des: '12', dec: '12',
};

function extractDate(text: string): string {
  // "31/08/2026"
  let ddmmyyyy = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(text); // NOSONAR
  if (ddmmyyyy) {
    let d = ddmmyyyy[1]!.padStart(2, '0');
    let m = ddmmyyyy[2]!.padStart(2, '0');
    let y = ddmmyyyy[3]!;
    if (y.length === 2) y = '20' + y;
    return `${y}-${m}-${d}`;
  }
  // "31 Agustus 2026"
  const mmm = /(\d{1,2})\s+(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Aug|Sep|Okt|Oct|Nov|Des|Dec)\w*\s+(\d{4})/i.exec(text); // NOSONAR
  if (mmm) {
    const mon = MONTH_MAP[mmm[2]!.toLowerCase().slice(0, 3)];
    if (mon) return `${mmm[3]}-${mon}-${mmm[1]!.padStart(2, '0')}`;
  }
  return new Date().toISOString().slice(0, 10);
}

// ─── Description extraction ───────────────────────────────────────────────────

function extractDescription(text: string, hits: { idx: number }[]): { desc: string; source?: string } {
  const lines = text.split('\n');
  const recipientRe = /penerima|kepada|tujuan|^\s*ke\b/i;
  const noteRe = /berita|keterangan|beneficiary/i;
  let hitLine: string | undefined;
  hitLine = lines.find((l) => recipientRe.test(l) && /(?:penerima|kepada|tujuan|ke)\s*[:-]?\s*[^\n]{2,}/i.test(l)); // NOSONAR
  if (!hitLine) hitLine = lines.find((l) => recipientRe.test(l));
  if (!hitLine) hitLine = lines.find((l) => noteRe.test(l));
  let desc = '';
  if (hitLine) {
    const m = /(?:penerima|kepada|beneficiary|berita|keterangan|tujuan|ke)\s*[:-]?\s*(.+)/i.exec(hitLine); // NOSONAR
    if (m?.[1]?.trim().length !== undefined && m[1].trim().length >= 2) {
      desc = m[1].trim();
    } else {
      const after = hitLine.split(/:/).slice(1).join(':').trim();
      desc = after || hitLine.trim();
    }
    desc = desc.split(/[-–—]/)[0]!.trim();
    desc = desc.replace(/\s*\([^)]*\)\s*/g, ' ').trim(); // NOSONAR
    desc = desc.replace(/\s*\d{4,}[^\n]*$/, '').trim(); // NOSONAR
    desc = desc.replace(/\s{2,}/g, ' ').trim();
    desc = desc.replace(/^(?:penerima|kepada|ke)\s+/i, '').trim();
  }
  if (!desc) {
    const amountIdxs = new Set(hits.map((h) => h.idx));
    desc =
      lines.find((l, i) => !amountIdxs.has(i) && l.trim().length > 3 && !/biaya admin/i.test(l))?.trim() ??
      lines.find((l) => l.trim().length > 3 && !/biaya admin/i.test(l))?.trim() ??
      '';
  }
  desc = desc.replaceAll(/\s+/g, ' ').trim() || 'Transfer';
  // Strip standalone prepositions
  desc = desc.replace(/\b(?:di|ke|untuk|dengan)\b/gi, '').replace(/\s{2,}/g, ' ').trim() || 'Transfer';
  // Title-case with acronym preservation
  desc = titleCasePreserveAcronyms(desc).slice(0, 80);
  // Cut source keywords from description
  const kws = [' dari ', ' pakai ', ' pake ', ' via '];
  let cut = -1;
  for (const k of kws) {
    const idx = desc.toLowerCase().indexOf(k);
    if (idx !== -1 && (cut === -1 || idx < cut)) cut = idx;
  }
  const cutDesc = (cut === -1 ? desc : desc.slice(0, cut)).trim();

  return { desc: cutDesc };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function parseReceiptText(text: string): { description: string; amount: number; date: string; rawText: string; source?: string } | null {
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

  return {
    description,
    amount,
    date: extractDate(text),
    rawText,
    source,
  };
}
