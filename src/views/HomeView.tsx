import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { fmtIDR, fmtDate } from '../utils/format';
import { Receipt, Trash2, ChatRoundDots, Gallery, ChevronRight } from 'reicon-react';
import { Link } from 'react-router-dom';

export default function HomeView() {
  const txs = useLiveQuery(() => db.transactions.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const total = useMemo(() => txs.reduce((a, t) => a + t.amount, 0), [txs]);

  if (!txs.length) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-[28px] md:text-[34px] font-bold tracking-tight">Expend</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Ringkasan pengeluaran</p>
        </header>
        <div className="py-10 text-center rounded-[var(--radius-lg)] bg-[var(--card)] border border-[var(--border)] px-4">
          <div className="mx-auto w-16 h-16 rounded-[var(--radius-md)] bg-[var(--bg)] border border-dashed border-[var(--border-strong)] grid place-items-center mb-4">
            <Receipt size={28} className="text-[var(--text-secondary)]" aria-hidden />
          </div>
          <h2 className="text-[15px] font-bold">Belum ada transaksi</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-[32ch] mx-auto">Catat lewat Chat atau upload bukti transfer - offline 100%.</p>
          <div className="flex gap-2 justify-center mt-5">
            <Link to="/chat" className="inline-flex items-center gap-2 px-5 py-3 rounded-[var(--radius-md)] bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold min-h-12">
              <ChatRoundDots size={16} /> Tulis Chat
            </Link>
            <Link to="/chat" className="inline-flex items-center gap-2 px-5 py-3 rounded-[var(--radius-md)] bg-[var(--card)] border border-[var(--border)] text-sm font-semibold min-h-12">
              <Gallery size={16} /> Upload Bukti
            </Link>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-3 font-mono">"beli kopi di Indomaret 50000"</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="sticky top-0 z-10 -mx-4 md:mx-0 px-4 py-3 -mt-5 md:mt-0 bg-[var(--bg)]/85 backdrop-blur-md">
        <h1 className="text-[22px] md:text-[26px] font-bold tracking-tight">Ringkasan</h1>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{txs.length} transaksi • {fmtIDR(total)}</p>
      </header>

      <div className="rounded-[var(--radius-lg)] bg-[var(--card)] border border-[var(--border)] p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-soft)] grid place-items-center shrink-0">
          <Receipt size={18} className="text-[var(--accent)]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[var(--text-secondary)]">Total pengeluaran</p>
          <p className="text-xl font-bold tracking-tight tabular-nums mt-0.5">{fmtIDR(total)}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{txs.length} transaksi</p>
        </div>
      </div>

      <section aria-label="Daftar transaksi">
        <h2 className="sr-only">Daftar transaksi</h2>
        <ul className="space-y-2">
          {txs.map((t) => (
            <li key={t.id} className="list-item flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]/40 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{t.description}</p>
                <p className="text-xs text-[var(--text-secondary)] tabular-nums mt-0.5">{fmtDate(t.date)}</p>
              </div>
              <p className="text-sm font-bold whitespace-nowrap tabular-nums shrink-0">{fmtIDR(t.amount)}</p>
              <button
                type="button"
                aria-label="hapus"
                onClick={() => {
                  if (t.id) void db.transactions.delete(t.id);
                }}
                className="w-12 h-12 -mr-2 grid place-items-center rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)] active:scale-95 transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <Trash2 size={18} aria-hidden />
              </button>
              <ChevronRight size={18} className="text-[var(--text-muted)] shrink-0" aria-hidden />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
