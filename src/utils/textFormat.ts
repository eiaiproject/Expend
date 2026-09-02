export const ACRONYMS = new Set([
  'BCA', 'BRI', 'BNI', 'BTN', 'BSI', 'KPR', 'CIMB', 'OCBC', 'UOB', 'HSBC', 'ANZ', 'DBS', 'ICBC',
  'ATM', 'QRIS', 'EDC', 'API', 'URL', 'SMS', 'OTP', 'PIN', 'NOMOR',
  'PLN', 'PDAM', 'BPJS', 'NPWP', 'KTP', 'SIM',
  'GOPAY', 'OVO', 'DANA', 'SHOPEEPAY', 'LINKAJA',
]);

/**
 * Title-case a string while preserving known acronyms and ALL-CAPS words.
 * "kopi di BCA" → "Kopi Di BCA"
 */
export function titleCasePreserveAcronyms(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => {
      if (!w) return w;
      if (w === w.toUpperCase() && w.length >= 2 && ACRONYMS.has(w.toUpperCase())) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}
