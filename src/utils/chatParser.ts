export interface ParsedExpense {
  description: string;
  amount: number;
}

function parseAmount(raw: string): number | null {
  const s = raw.toLowerCase().replace(/\s/g, '');
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^([\d.,]+)\s*(jt|juta)$/))) return toNum(m[1]!) * 1_000_000;
  if ((m = s.match(/^([\d.,]+)\s*(rb|ribu|k)$/))) return toNum(m[1]!) * 1_000;
  if ((m = s.match(/^[\d.,]+$/))) return toNum(m[0]!);
  return null;
}
function toNum(s: string): number {
  const clean = s.replace(/\./g, '').replace(',', '.');
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
}

const AMOUNT_RE = /([\d][\d.,]*\s*(?:jt|juta|rb|ribu|k)?)/gi;

export function parseChatInput(input: string): ParsedExpense | null {
  const text = input.trim();
  if (!text) return null;
  let last: { raw: string; index: number } | null = null;
  let match: RegExpExecArray | null;
  AMOUNT_RE.lastIndex = 0;
  while ((match = AMOUNT_RE.exec(text))) {
    const raw = match[1]!.trim();
    if (parseAmount(raw)) last = { raw, index: match.index! };
  }
  if (!last) return null;
  const amount = parseAmount(last.raw)!;
  if (amount <= 0) return null;
  let desc = text.slice(0, last.index) + text.slice(last.index + last.raw.length);
  desc = desc.replace(/\s+/g, ' ').trim();
  desc = desc.replace(/^(beli|bayar|jajan|belanja|order|pesan)\s+/i, '').trim();
  desc = desc.replace(/\s+(?:dari|pakai|pake|via)\s+.*$/i, '').trim();
  if (!desc) desc = 'Pengeluaran';
  else desc = desc.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').slice(0, 80);
  return { description: desc, amount };
}
