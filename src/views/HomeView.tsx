import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { fmtIDR, fmtDate } from '../utils/format';
import { Receipt, Trash2, ChatRoundDots, Gallery } from 'reicon-react';
import { Link } from 'react-router-dom';

export default function HomeView() {
  const txs = useLiveQuery(() => db.transactions.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const total = useMemo(() => txs.reduce((a, t) => a + t.amount, 0), [txs]);

  if (!txs.length) {
    return (
      <div className="py-8">
        <header className="mb-6">
          <h1 className="text-[28px] md:text-[34px] font-bold tracking-tight text-wrap-balance">Expend</h1>
          <p className="text-sm text-[var(--text-secondary)]">Ringkasan pengeluaran</p>
        </header>
        <div className="py-8 text-center rounded-[16px] bg-[var(--card)] border border-[var(--border)]">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-[var(--bg)] border border-dashed border-[var(--border)] flex items-center justify-center mb-4">
            <Receipt size={28} className="text-[var(--text-secondary)]" aria-hidden />
          </div>
          <h2 className="text-[15px] font-bold text-wrap-balance">Belum ada transaksi</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1 text-wrap-pretty max-w-[32ch] mx-auto">Catat pengeluaran lewat Chat atau upload bukti transfer - offline 100%.</p>
          <div className="flex gap-2 justify-center mt-5">
            <Link to="/chat" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold min-h-12">
              <ChatRoundDots size={16} /> Tulis Chat
            </Link>
            <Link to="/chat" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm font-semibold min-h-12">
              <Gallery size={16} /> Upload Bukti
            </Link>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-3">Contoh: "beli kopi di Indomaret 50000"</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="sticky top-0 z-10 -mx-4 md:mx-0 px-4 py-3 -mt-5 md:mt-0 bg-[var(--bg)]/80 backdrop-blur-md border-b border-[var(--border)]/0">
        <h1 className="text-[22px] md:text-2xl font-bold tracking-tight text-wrap-balance">Ringkasan</h1>
        <p className="text-xs text-[var(--text-secondary)]">{txs.length} transaksi • {fmtIDR(total)}</p>
      </header>

      <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--bg)] border border-[var(--border)] grid place-items-center shrink-0">
          <Receipt size={18} className="text-[var(--text-secondary)]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[var(--text-secondary)]">Total pengeluaran</p>
          <p className="text-xl font-bold tracking-tight tabular-nums mt-0.5 text-wrap-balance">{fmtIDR(total)}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{txs.length} transaksi</p>
        </div>
      </div>

      <section aria-label="Daftar transaksi">
        <h2 className="sr-only">Daftar transaksi</h2>
        <ul className="space-y-2">
          {txs.map((t) => (
            <li key={t.id} className="list-item flex items-center gap-3 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate text-wrap-pretty">{t.description}</p>
                <p className="text-xs text-[var(--text-secondary)] tabular-nums">{fmtDate(t.date)}</p>
              </div>
              <p className="text-sm font-bold whitespace-nowrap tabular-nums">{fmtIDR(t.amount)}</p>
              <button
                type="button"
                aria-label="hapus"
                onClick={() => {
                  if (t.id) void db.transactions.delete(t.id);
                }}
                className="w-12 h-12 grid place-items-center rounded-xl hover:bg-[var(--bg)] active:scale-95 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <Trash2 size={18} />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
