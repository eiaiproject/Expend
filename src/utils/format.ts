const IDR = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
export const fmtIDR = (n: number) => IDR.format(n);
const dateCache = new Map<string, string>();
export const fmtDate = (iso: string) => {
  const cached = dateCache.get(iso);
  if (cached) return cached;
  const s = new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  dateCache.set(iso, s);
  return s;
};
import { todayLocalISO } from './date';
// Tanggal lokal (lihat utils/date). Dipertahankan untuk kompatibilitas impor lama.
export const todayISO = () => todayLocalISO();
