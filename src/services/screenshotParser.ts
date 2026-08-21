import { sanitizeAmountInput } from '../utils/amountUtils';
import { parseAmountToken } from './naturalTextParser';

const DATE_RE = /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/;

export function parseScreenshotText(text: string): { description: string; amount: string; date: string | null } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let amount = '';
  // Amount: line right after a total/jumlah keyword, else largest amount in the last 5 lines.
  const totalIdx = lines.findIndex(l => /total|jumlah/i.test(l));
  if (totalIdx !== -1) {
    for (let i = totalIdx + 1; i < lines.length; i++) {
      const n = parseAmountToken(lines[i]!);
      if (n != null && n > 0) {
        amount = sanitizeAmountInput(lines[i]!.replace(/Rp\.?\s?/i, ''));
        break;
      }
    }
  }
  if (!amount) {
    const candidates = lines.slice(-5)
      .map(l => parseAmountToken(l))
      .filter((n): n is number => n !== null && n > 0);
    if (candidates.length > 0) amount = sanitizeAmountInput(String(Math.max(...candidates)).replace('.', ','));
  }

  // Description: the line just before the total block, else first short non-amount line.
  let description = '';
  if (totalIdx > 0) description = lines[totalIdx - 1]!;
  else {
    for (const l of lines) {
      if (l.length <= 40 && parseAmountToken(l) === null && !/^(total|jumlah|rp)/i.test(l)) {
        description = l;
        break;
      }
    }
  }
  if (!description) description = text.trim().slice(0, 60);

  // Date (dd/mm/yyyy or dd-mm-yyyy; Indonesian receipts).
  let date: string | null = null;
  const dm = text.match(DATE_RE);
  if (dm) {
    const d = dm[1]!;
    const m = dm[2]!;
    const yRaw = dm[3]!;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return { description, amount, date };
}