import type { Lang } from '../i18n/shared';

const EN_MARKERS =
  /\b(coffee|lunch|dinner|breakfast|from|with|yesterday|today|via|transfer|payment|receipt|cash|groceries|transport|taxi|coffee shop)\b/i;
const ID_MARKERS =
  /\b(kopi|makan|siang|malam|pagi|dari|pakai|pake|kemarin|hari\s*ini|lusa|tunai|kas|belanja|jajan|bayar|beli|ongkir|bensin)\b/i;

/**
 * Heuristik ringan offline untuk deteksi bahasa per-input chat.
 * Konservatif: butuh ≥1 marker EN dan nol marker ID untuk menyimpulkan 'en'
 * (input campuran seperti "kopi 25rb from BSI" tetap dianggap 'id').
 */
export function detectInputLang(text: string): Lang | null {
  const t = text.trim();
  if (t.length < 3) return null;
  const hasEn = EN_MARKERS.test(t);
  const hasId = ID_MARKERS.test(t);
  if (hasEn && !hasId) return 'en';
  if (hasId && !hasEn) return 'id';
  return null;
}
