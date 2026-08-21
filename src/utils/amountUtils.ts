/** Keep digits + separators, then normalize: the LAST separator with 1–2
 *  trailing digits is the decimal comma; every other separator is grouping
 *  (dropped). "25,000,50" / "25.000,50" → "25000,50". */
export function sanitizeAmountInput(value: string): string {
  let compact = '';
  for (const ch of value) {
    if ((ch >= '0' && ch <= '9') || ch === ',' || ch === '.') compact += ch;
  }
  let lastSepIndex = -1;
  for (let i = 0; i < compact.length; i++) {
    if (compact[i] === ',' || compact[i] === '.') lastSepIndex = i;
  }
  const trailingDigits = compact.length - lastSepIndex - 1;
  if (lastSepIndex > 0 && trailingDigits >= 1 && trailingDigits <= 2) {
    const intPart = compact.slice(0, lastSepIndex).replace(/[.,]/g, '');
    let dec = compact.slice(lastSepIndex + 1);
    if (dec.length > 2) dec = dec.slice(0, 2); // defensive cap
    return `${intPart},${dec}`;
  }
  return compact.replace(/[.,]/g, '');
}

/** Group the integer part with dots (id-ID display). */
export function formatAmountDisplay(value: string): string {
  if (!value) return '';
  const [intPart = '', dec] = value.split(',');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return dec ? `${grouped},${dec}` : grouped;
}

/** "25.000,50" | "25000" → 25000.5 ; invalid/empty → 0 */
export function parseAmountToNumber(value: string): number {
  const cleaned = value.replace(/\./g, '').replace(',', '.');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** number → sanitized input string ("25000.5" → "25000,5"). */
export function numberToAmountInput(n: number): string {
  return String(n).replace('.', ',');
}

// Legacy integer-only API — kept VERBATIM (semantics unchanged) so
// ScheduleFormSheet/DebtFormSheet/DebtPaymentSheet (integer fields) keep
// working; migrate to decimal fns only when those flows need decimals.
export function parseAmount(value: string): number {
  return Number.parseInt(value.replace(/\D/g, ''), 10) || 0;
}
export function formatAmountInput(value: string): string {
  const raw = value.replace(/\D/g, '');
  return raw ? Number.parseInt(raw, 10).toLocaleString('id-ID') : '';
}