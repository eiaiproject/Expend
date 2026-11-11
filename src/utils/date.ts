/**
 * Tanggal transaksi: YYYY-MM-DD dalam zona waktu lokal perangkat.
 * Alasan: `toISOString().slice(0,10)` adalah tanggal UTC - di WIB (UTC+7)
 * pukul 00:00-06:59 WIB masih terbaca sebagai "kemarin" (UTC).
 * Seluruh default tanggal (parser, receipt, filename ekspor,
 * fallback UI) memakai fungsi ini agar deterministik. `createdAt` tetap
 * ISO timestamp UTC penuh (dengan jam) dan tidak diubah.
 */
export function todayLocalISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}$/; // NOSONAR - anchored date check

/** True hanya untuk YYYY-MM-DD yang benar-benar ada di kalender. */
export function isValidISODate(d: string): boolean {
  if (!DATE_ISO_RE.test(d)) return false;
  const [ys, ms, ds] = d.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const dd = Number(ds);
  if (!Number.isInteger(y) || m < 1 || m > 12 || dd < 1 || dd > 31) return false;
  return dd <= new Date(y, m, 0).getDate();
}
