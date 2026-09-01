import { ChevronRight } from 'reicon-react';

export default function SettingsView() {
  const version: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Pengaturan</h1>
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="text-xs font-bold tracking-wide uppercase text-[var(--text-secondary)]">Tentang Aplikasi</p>
        <p className="mt-2 font-semibold text-lg">Expend</p>
        <p className="text-sm text-[var(--text-secondary)] text-wrap-pretty">Chat pencatatan pengeluaran - offline-first, privacy-first. Data tersimpan lokal di perangkat.</p>
        <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
          <span className="inline-flex items-center rounded-full bg-[var(--card)] border border-[var(--border)] px-3 py-1 text-xs font-mono font-bold">v{version}</span>
          <span className="text-xs text-[var(--text-secondary)]">Versi terpasang</span>
          <ChevronRight size={16} className="ml-auto text-[var(--text-muted)]" aria-hidden />
        </div>
      </section>
      <p className="text-xs text-[var(--text-secondary)] px-1">Versi otomatis terupdate saat bump di <span className="font-mono">package.json</span>. Tidak perlu edit manual.</p>
    </div>
  );
}
