import { getStoredLang } from '../i18n/shared';
import { isValidISODate } from './date';

export type AppLang = 'id' | 'en';

const IDR = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
export const fmtIDR = (n: number) => IDR.format(n);

const DATE_ID = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
const DATE_EN = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * Format YYYY-MM-DD untuk locale aktif. Tanggal tidak valid dikembalikan apa
 * adanya (atau "-") supaya satu baris rusak tidak menjatuhkan seluruh render.
 */
export function fmtDate(iso: string, lang: AppLang = getStoredLang()): string {
  if (!iso) return '-';
  // `new Date('2026-02-31')` silently rolls over to 3 March. Validate the
  // calendar date first so bad rows stay visible as their original value.
  if (!isValidISODate(iso)) return iso;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return (lang === 'en' ? DATE_EN : DATE_ID).format(d);
  } catch {
    return iso;
  }
}

/** Jam lokal sesuai locale aktif; string rusak menghasilkan string kosong. */
export function fmtTime(iso: string, lang: AppLang = getStoredLang()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleTimeString(lang === 'en' ? 'en-US' : 'id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function monthLabelFor(key: string, lang: AppLang): string {
  if (!/^\d{4}-\d{2}$/.test(key)) return key;
  const [y, m] = key.split('-').map(Number);
  if (m! < 1 || m! > 12) return key;
  const d = new Date(y!, m! - 1, 1);
  if (Number.isNaN(d.getTime())) return key;
  try {
    return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'id-ID', { month: 'long', year: 'numeric' });
  } catch {
    return key;
  }
}
