import { sanitizeAmountInput, parseAmountToNumber } from '../utils/amountUtils';

const AMOUNT_RE = /(?:Rp\.?\s?)?([\d.,]+)/i;

/** First amount-like token in a line, or null. */
export function parseAmountToken(text: string): number | null {
  const m = AMOUNT_RE.exec(text);
  if (!m) return null;
  return parseAmountToNumber(sanitizeAmountInput(m[1]!));
}

/** Best-effort single-entry parse: amount + rest of the first line as description. */
export function parseRecordingText(text: string): { description: string; amount: string } {
  const line = text.trim().split('\n')[0] ?? '';
  const m = AMOUNT_RE.exec(line);
  if (!m) return { description: line, amount: '' };
  const amountNum = parseAmountToken(m[1]!);
  const description = line
    .replace(m[0], '')
    .replace(/(?:^|\s)Rp\.?\s?/i, '')
    .trim();
  const amount = amountNum && amountNum > 0 ? sanitizeAmountInput(String(amountNum).replace('.', ',')) : '';
  return { description, amount };
}

/** Line-by-line batch parse: only lines that carry an amount become entries. */
export function parseBatchLines(text: string): { description: string; amount: string }[] {
  const out: { description: string; amount: string }[] = [];
  for (const raw of text.split('\n')) {
    const entry = parseRecordingText(raw);
    if (entry.amount) out.push(entry);
  }
  return out;
}