export const ACRONYMS = new Set([
  'BCA', 'BRI', 'BNI', 'BTN', 'BSI', 'KPR', 'CIMB', 'OCBC', 'UOB', 'HSBC', 'ANZ', 'DBS', 'ICBC',
  'ATM', 'QRIS', 'EDC', 'API', 'URL', 'SMS', 'OTP', 'PIN', 'NOMOR',
  'PLN', 'PDAM', 'BPJS', 'NPWP', 'KTP', 'SIM',
  'GOPAY', 'OVO', 'DANA', 'SHOPEEPAY', 'LINKAJA',
  'KAI', 'FINPAY', 'SHOPEEFOOD',
]);

/**
 * Kata depan/penghubung yang tetap lowercase di tengah kalimat.
 * "kopi di Indomaret" → "Kopi di Indomaret" (bukan "Kopi Di Indomaret").
 */
export const LOWERCASE_WORDS = new Set([
  'di', 'ke', 'dari', 'untuk', 'dengan', 'dan', 'atau', 'yang',
]);

/**
 * Title-case a string while preserving known acronyms and ALL-CAPS words.
 * "kopi di BCA" → "Kopi di BCA"
 */
export function titleCasePreserveAcronyms(s: string): string {
  return s
    .split(/\s+/)
    .map((w, i) => {
      if (!w) return w;
      const upper = w.toUpperCase();
      // Preserve known acronyms (case-insensitive match)
      if (ACRONYMS.has(upper)) {
        // Return canonical form from set if ALL-CAPS, else preserve original casing
        if (w === upper) return w;
        // Mixed-case known brand (e.g. ShopeeFood) — preserve as-is
        return w;
      }
      // Lowercase conjunctions/prepositions mid-sentence (first word stays capitalized)
      if (i > 0 && LOWERCASE_WORDS.has(w.toLowerCase())) return w.toLowerCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}
