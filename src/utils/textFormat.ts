export const ACRONYMS = new Set([
  'BCA', 'BRI', 'BNI', 'BTN', 'BSI', 'KPR', 'CIMB', 'OCBC', 'UOB', 'HSBC', 'ANZ', 'DBS', 'ICBC',
  'ATM', 'QRIS', 'EDC', 'API', 'URL', 'SMS', 'OTP', 'PIN', 'NOMOR',
  'PLN', 'PDAM', 'BPJS', 'NPWP', 'KTP', 'SIM',
  'GOPAY', 'OVO', 'DANA', 'SHOPEEPAY', 'LINKAJA',
  'KAI', 'FINPAY', 'SHOPEEFOOD',
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
      const upper = w.toUpperCase();
      // Preserve known acronyms (case-insensitive match)
      if (ACRONYMS.has(upper)) {
        // Return canonical form from set if ALL-CAPS, else preserve original casing
        if (w === upper) return w;
        // Mixed-case known brand (e.g. ShopeeFood) — preserve as-is
        return w;
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}
