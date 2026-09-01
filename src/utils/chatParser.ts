export interface ParsedExpense {
  description: string;
  amount: number;
}

function parseAmount(raw: string): number | null {
  const s = raw.toLowerCase().replaceAll(/\s/g, '');
  let m: RegExpExecArray | null;
  m = /^([\d.,]+)\s*(jt|juta)$/.exec(s);
  if (m) return toNum(m[1]!) * 1_000_000;
  m = /^([\d.,]+)\s*(rb|ribu|k)$/.exec(s);
  if (m) return toNum(m[1]!) * 1_000;
  m = /^[\d.,]+$/.exec(s);
  if (m) return toNum(m[0]!);
  return null;
}
function toNum(s: string): number {
  const clean = s.replaceAll('.', '').replace(',', '.');
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
}

const AMOUNT_RE = /(\d[\d.,]*\s*(?:jt|juta|rb|ribu|k)?)/gi; // NOSONAR - small input, intentional

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
  desc = desc.replaceAll(/\s+/g, ' ').trim();
  desc = desc.replace(/^(beli|bayar|jajan|belanja|order|pesan)\s+/i, '').trim();
  desc = desc.replace(/\s+(?:dari|pakai|pake|via)\s+.*$/i, '').trim();
  if (!desc) desc = 'Pengeluaran';
  else desc = desc.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').slice(0, 80);
  return { description: desc, amount };
}
