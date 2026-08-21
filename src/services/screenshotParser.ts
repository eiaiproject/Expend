import { sanitizeAmountInput } from '../utils/amountUtils';
import { parseAmountToken } from './naturalTextParser';

const DATE_RE = /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/;

/** Find the first positive amount on lines after a total/jumlah keyword. */
function findAmountAfterTotal(lines: string[]): string {
  const totalIdx = lines.findIndex(l => /total|jumlah/i.test(l));
  if (totalIdx === -1) return '';
  for (let i = totalIdx + 1; i < lines.length; i++) {
    const n = parseAmountToken(lines[i]!);
    if (n != null && n > 0) return sanitizeAmountInput(lines[i]!.replace(/Rp\.?\s?/i, ''));
  }
  return '';
}

/** Largest positive amount in the last N lines. */
function findLargestAmount(lines: string[], window = 5): string {
  const candidates = lines.slice(-window)
    .map(l => parseAmountToken(l))
    .filter((n): n is number => n !== null && n > 0);
  if (candidates.length === 0) return '';
  return sanitizeAmountInput(String(Math.max(...candidates)).replace('.', ','));
}

/** Description: line just before the total block, else first short non-amount line. */
function findDescription(lines: string[], totalIdx: number): string {
  if (totalIdx > 0) return lines[totalIdx - 1]!;
  for (const l of lines) {
    if (l.length <= 40 && parseAmountToken(l) === null && !/^(total|jumlah|rp)/i.test(l)) return l;
  }
  return '';
}

/** Parse dd/mm/yyyy or dd-mm-yyyy → yyyy-mm-dd. */
function parseReceiptDate(text: string): string | null {
  const dm = DATE_RE.exec(text);
  if (!dm) return null;
  const [, d, m, yRaw] = dm;
  const y = yRaw!.length === 2 ? `20${yRaw}` : yRaw;
  return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
}

export function parseScreenshotText(text: string): { description: string; amount: string; date: string | null } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const totalIdx = lines.findIndex(l => /total|jumlah/i.test(l));

  const amount = findAmountAfterTotal(lines) || findLargestAmount(lines);
  const description = findDescription(lines, totalIdx) || text.trim().slice(0, 60);
  const date = parseReceiptDate(text);

  return { description, amount, date };
}
