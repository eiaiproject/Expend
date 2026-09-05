/**
 * Tanggal transaksi: YYYY-MM-DD dalam zona waktu lokal perangkat.
 * Alasan: `toISOString().slice(0,10)` adalah tanggal UTC — di WIB (UTC+7)
 * pukul 00:00–06:59 WIB masih terbaca sebagai "kemarin" (UTC).
 * Seluruh default tanggal (parser, receipt, LLM prompt, filename ekspor,
 * fallback UI) memakai fungsi ini agar deterministik. `createdAt` tetap
 * ISO timestamp UTC penuh (dengan jam) dan tidak diubah.
 */
export function todayLocalISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
