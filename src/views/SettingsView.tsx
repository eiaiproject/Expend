import { ChevronRight, Lock, Cloud, CloudCross, Information, Setting } from 'reicon-react';

export default function SettingsView() {
  const version: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[22px] md:text-[26px] font-bold tracking-tight">Pengaturan</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Tentang aplikasi dan preferensi</p>
      </header>

      <section aria-labelledby="about" className="space-y-2">
        <p id="about" className="text-xs font-bold tracking-wide uppercase text-[var(--text-secondary)] px-1">Tentang Aplikasi</p>
        <div className="rounded-[var(--radius-lg)] bg-[var(--card)] border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--accent-soft)] grid place-items-center shrink-0">
              <Information size={18} className="text-[var(--accent)]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Expend</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">Chat pencatatan pengeluaran</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)] px-2.5 py-1 text-xs font-mono font-bold">v{version}</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--accent-soft)] grid place-items-center shrink-0">
              <Lock size={18} className="text-[var(--accent)]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Offline-first</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">Data tersimpan lokal di perangkat</p>
            </div>
            <ChevronRight size={18} className="text-[var(--text-muted)] shrink-0" aria-hidden />
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--bg)] border border-[var(--border)] grid place-items-center shrink-0">
              <CloudCross size={18} className="text-[var(--text-muted)]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--text-secondary)]">Tanpa cloud tracking</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Privasi adalah prioritas</p>
            </div>
            <ChevronRight size={18} className="text-[var(--text-muted)] shrink-0" aria-hidden />
          </div>
        </div>
      </section>

      <p className="text-xs text-[var(--text-muted)] px-1">Versi otomatis terupdate saat bump di <span className="font-mono">package.json</span>. Tidak perlu edit manual.</p>
      <div className="text-center pt-2">
        <Setting size={14} className="inline text-[var(--text-muted)] mr-1" aria-hidden />
        <span className="text-[10px] text-[var(--text-muted)] font-mono">expend.pages.dev</span>
      </div>
    </div>
  );
}
