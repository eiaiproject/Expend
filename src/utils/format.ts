import { getStoredLang } from '../i18n/shared';

const IDR = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
export const fmtIDR = (n: number) => IDR.format(n);

const DATE_ID = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
const DATE_EN = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

export const fmtDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  try {
    return (getStoredLang() === 'en' ? DATE_EN : DATE_ID).format(d);
  } catch {
    return DATE_ID.format(d);
  }
};

export function monthLabelFor(key: string, lang: 'id' | 'en'): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y!, m! - 1, 1);
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'id-ID', { month: 'long', year: 'numeric' });
}
