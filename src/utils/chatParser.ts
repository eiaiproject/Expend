import { detectSource } from './sources';
import { titleCasePreserveAcronyms } from './textFormat';

export interface ParsedExpense {
  description: string;
  amount: number;
  source?: string;
  date?: string;
}

// ─── Number normalization ─────────────────────────────────────────────────────

/**
 * Normalize a number string from Indonesian format to JS number.
 *
 * Rules:
 *  - `15.000`  → 15000   (dot = thousand separator, ≥4 digits after last dot)
 *  - `15.50`   → 15.5    (dot = decimal, exactly 2 digits after last dot)
 *  - `15,50`   → 15.5    (comma = decimal)
 *  - `1.500.000` → 1500000 (dot = thousand separator)
 *  - `1.5jt`   → handled by suffix logic, not here
 */
function tryInternational(s: string): number | null {
  if (!s.includes(',') || !s.includes('.')) return null;
  const commaIdx = s.lastIndexOf(',');
  const dotIdx = s.lastIndexOf('.');
  const afterDot = s.slice(dotIdx + 1).length;
  const between = s.slice(commaIdx + 1, dotIdx).length;
  if (dotIdx > commaIdx && afterDot <= 2 && between === 3) {
    const n = Number(s.replaceAll(',', ''));
    return Number.isFinite(n) ? n : 0;
  }
  return null;
}

function parseCommaDecimal(s: string): number {
  const cleaned = s.replaceAll('.', '').replaceAll(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseDotVariant(s: string): number {
  const parts = s.split('.');
  if (parts.length === 1) {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  const lastPart = parts.at(-1)!;
  if (lastPart.length <= 2) {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  const cleaned = s.replaceAll('.', '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeNumber(s: string): number {
  const raw = s.trim();
  if (!raw) return 0;
  const intl = tryInternational(raw);
  if (intl !== null) return intl;
  if (raw.includes(',')) return parseCommaDecimal(raw);
  return parseDotVariant(raw);
}

// ─── Amount parsing with suffixes ─────────────────────────────────────────────

const SUFFIX_RE = /^([\d.,]+)\s*(jt|juta|rb|ribu|k)$/i; // NOSONAR - anchored, input bounded (<80 chars)

function parseAmountWithSuffix(raw: string): number | null {
  const trimmed = raw.trim();
  const m = SUFFIX_RE.exec(trimmed);
  if (!m) {
    // Plain number
    const n = normalizeNumber(trimmed);
    return n > 0 ? n : null;
  }
  const base = normalizeNumber(m[1]!);
  if (base <= 0) return null;
  const suffix = m[2]!.toLowerCase();
  if (suffix === 'jt' || suffix === 'juta') return base * 1_000_000;
  return base * 1_000; // rb, ribu, k
}

// ─── Date parsing ─────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', mei: '05', jun: '06',
  jul: '07', agu: '08', aug: '08', sep: '09', okt: '10', oct: '10',
  nov: '11', des: '12', dec: '12',
};

function parseRelativeDate(term: string): string | undefined {
  const now = new Date();
  const lower = term.toLowerCase();
  if (lower === 'kemarin' || lower === 'kemaren') {
    now.setDate(now.getDate() - 1);
    return now.toISOString().slice(0, 10);
  }
  if (lower === 'lusa') {
    now.setDate(now.getDate() + 2);
    return now.toISOString().slice(0, 10);
  }
  if (lower === 'hari ini' || lower === 'hariini') {
    return now.toISOString().slice(0, 10);
  }
  return undefined;
}

function parseExplicitDate(text: string): string | undefined {
  // "tgl 15" or "tanggal 15" → day this month
  const tglMatch = /(?:tgl|tanggal)\s+(\d{1,2})/i.exec(text);
  if (tglMatch) {
    const d = Number(tglMatch[1]);
    if (d >= 1 && d <= 31) {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // "15/08/2026" or "15-08-2026" or "15.08.2026"
  const dmy = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(text);
  if (dmy) {
    const d = dmy[1]!.padStart(2, '0');
    const m = dmy[2]!.padStart(2, '0');
    let y = dmy[3]!;
    if (y.length === 2) y = '20' + y;
    return `${y}-${m}-${d}`;
  }

  // "15 Aug 2026" or "15 Agustus 2026"
  const mmm = /(\d{1,2})\s+(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Aug|Sep|Okt|Oct|Nov|Des|Dec)\w*\s+(\d{4})/i.exec(text);
  if (mmm) {
    const mon = MONTH_MAP[mmm[2]!.toLowerCase().slice(0, 3)];
    if (mon) return `${mmm[3]}-${mon}-${mmm[1]!.padStart(2, '0')}`;
  }

  return undefined;
}

/**
 * Extract date from chat input. Supports:
 * - Relative: "kemarin", "lusa", "hari ini"
 * - Explicit: "tgl 15", "15/08/2026", "15 Agustus 2026"
 * - Default: today
 */
export function extractChatDate(text: string): string {
  // Check relative dates first
  const lower = text.toLowerCase();
  for (const term of ['hari ini', 'kemarin', 'lusa']) {
    if (lower.includes(term)) {
      const d = parseRelativeDate(term);
      if (d) return d;
    }
  }
  // Check explicit dates
  const explicit = parseExplicitDate(text);
  if (explicit) return explicit;
  // Default to today
  return new Date().toISOString().slice(0, 10);
}

// ─── Smart amount extraction ──────────────────────────────────────────────────

interface AmountCandidate {
  raw: string;
  value: number;
  index: number;
  hasSuffix: boolean;
}

/**
 * Extract all number candidates from text.
 * A candidate is a number optionally followed by a suffix (jt, rb, k, etc.)
 */
function extractCandidates(text: string): AmountCandidate[] {
  const candidates: AmountCandidate[] = [];
  // Match: number + optional suffix, or just a number
  const re = /(\d[\d.,]*\s*(?:jt|juta|rb|ribu|k)?)/gi; // NOSONAR
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[1]!.trim();
    const value = parseAmountWithSuffix(raw);
    if (value && value > 0) {
      const hasSuffix = /\b(jt|juta|rb|ribu|k)\b/i.test(raw);
      candidates.push({ raw, value, index: m.index!, hasSuffix });
    }
  }
  return candidates;
}

/**
 * Score a candidate for being the primary transaction amount.
 *
 * Tier 1 (highest): Has explicit suffix (rb, jt, k, etc.) — always monetary
 * Tier 2: Has "Rp" prefix nearby — strong monetary signal
 * Tier 3: Largest plain number — likely the amount
 *
 * Penalties:
 * - Very small numbers (< 100) without suffix → likely not monetary
 * - Numbers > 999,999,999 without suffix → likely ID/ref number
 */
function scoreCandidate(
  c: AmountCandidate,
  hasRpPrefix: boolean,
): number {
  let score = c.value;

  // Tier 1: Explicit suffix → strong monetary signal
  if (c.hasSuffix) score *= 3;

  // Tier 2: Rp prefix nearby
  if (hasRpPrefix) score *= 2.5;

  // Penalty: small numbers without suffix (likely quantities, floor numbers, etc.)
  if (!c.hasSuffix && !hasRpPrefix && c.value < 100) score *= 0.01;

  // Penalty: very large numbers without suffix (likely IDs, refs)
  if (!c.hasSuffix && !hasRpPrefix && c.value > 999_999_999) score *= 0.001;

  return score;
}

function pickBestAmount(candidates: AmountCandidate[], fullText: string): number | null {
  if (!candidates.length) return null;

  const rpRe = /\bRp\.?|\bIDR/i;

  let best = candidates[0]!;
  let bestScore = scoreCandidate(best, rpRe.test(fullText));

  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]!;
    const s = scoreCandidate(c, rpRe.test(fullText));
    if (s > bestScore) {
      best = c;
      bestScore = s;
    }
  }

  return best.value;
}

// ─── Description formatting ───────────────────────────────────────────────────

const VERB_RE = /^(beli|bayar|jajan|belanja|order|pesan|isi|top\s*up|transfer|tf|beliin)\s+/i;
const SOURCE_CLAUSE_RE = /\s+(?:dari|pakai|pake|via)\s+\S.*$/i; // NOSONAR - bounded description (<80 chars)
const PREPOSITION_RE = /\b(?:di|ke|untuk|dengan)\b/gi;
const GENERIC_SOURCE_RE = /\b(?:tunai|cash|kas)\b/gi;

function formatDescription(raw: string, hasGenericSource: boolean): string {
  let desc = raw.trim();
  if (!desc) return 'Pengeluaran';

  // Remove verb prefix
  desc = desc.replace(VERB_RE, '').trim();
  // Remove source clause (dari/via/pakai ...)
  desc = desc.replace(SOURCE_CLAUSE_RE, '').trim();
  // Remove standalone Rp/IDR tokens
  desc = desc.replace(/\bRp\.?\b/gi, '').replace(/\bIDR\b/gi, '').replace(/\s{2,}/g, ' ').trim(); // NOSONAR
  // Remove standalone prepositions
  desc = desc.replace(PREPOSITION_RE, '').replace(/\s{2,}/g, ' ').trim();
  // Remove generic source words (tunai/cash/kas) if detected as source
  if (hasGenericSource) desc = desc.replace(GENERIC_SOURCE_RE, '').replace(/\s{2,}/g, ' ').trim();
  // Remove mid-sentence verb before generic source (e.g. "kopi bayar kas" → "kopi")
  if (hasGenericSource) desc = desc.replace(/\s+(?:bayar|pakai|pake|dari|via)\s*$/i, '').replace(/\s{2,}/g, ' ').trim(); // NOSONAR
  // Remove trailing words + number (e.g. "lantai 2", "lantai 3", "lantai 5")
  desc = desc.replace(/\s+\w+\s+\d{1,2}\s*$/ , '').trim(); // NOSONAR
  // Remove trailing standalone numbers
  desc = desc.replace(/\s\d+\s*$/, '').trim(); // NOSONAR

  if (!desc) return 'Pengeluaran';
  return titleCasePreserveAcronyms(desc).slice(0, 80);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function parseChatInput(input: string): ParsedExpense | null {
  const text = input.trim();
  if (!text) return null;

  // 1. Extract date from text
  const date = extractChatDate(text);

  // 2. Remove date-related words before amount extraction
  let cleanText = text
    .replace(/\b(?:kemarin|lusa|hari\s*ini)\b/gi, '') // NOSONAR
    .replace(/\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/g, '') // NOSONAR
    .replace(/\d{1,2}\s+(?:Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Aug|Sep|Okt|Oct|Nov|Des|Dec)\w*\s+\d{4}/gi, '') // NOSONAR
    .replace(/\s{2,}/g, ' ')
    .trim();

  // 3. Extract candidates and pick best amount
  const candidates = extractCandidates(cleanText);
  const amount = pickBestAmount(candidates, cleanText);
  if (!amount) return null;

  // 4. Find the best candidate's position for description extraction
  const bestCandidate = candidates.find((c) => c.value === amount);
  const splitIndex = bestCandidate?.index ?? cleanText.length;

  // 5. Build description from text around the amount
  const before = cleanText.slice(0, splitIndex);
  const after = cleanText.slice(splitIndex + (bestCandidate?.raw.length ?? 0));
  const rawDesc = (before + ' ' + after).replace(/\s+/g, ' ').trim();

  // 6. Extract source
  const sourceMatch = /\s+(?:dari|pakai|pake|via)\s+(.+)$/i.exec(rawDesc); // NOSONAR - anchored, bounded
  let source: string | undefined;
  if (sourceMatch) {
    source = detectSource(sourceMatch[1]!.trim()) || sourceMatch[1]!.trim();
  } else {
    // Fallback: scan full text for generic sources (Tunai, Kas) without keyword
    const generic = detectSource(text);
    if (generic === 'Tunai' || generic === 'Kas') source = generic;
  }

  // 7. Format description
  const description = formatDescription(rawDesc, !!source && (source === 'Tunai' || source === 'Kas'));

  return { description, amount, source, date };
}
