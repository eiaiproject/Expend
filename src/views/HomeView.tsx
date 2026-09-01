import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { fmtIDR, fmtDate } from '../utils/format';
import { Receipt, Trash2, ChatRoundDots, Gallery } from 'reicon-react';
import { Link } from 'react-router-dom';

export default function HomeView() {
  const txs = useLiveQuery(() => db.transactions.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const total = txs.reduce((a, t) => a + t.amount, 0);

  if (!txs.length) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[var(--card)] border border-dashed border-[var(--border)] flex items-center justify-center mb-4">
          <Receipt size={28} className="text-[var(--text-secondary)]" />
        </div>
        <h2 className="text-[15px] font-bold text-wrap-balance">Belum ada transaksi</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1 text-wrap-pretty max-w-[32ch] mx-auto">Catat pengeluaran lewat Chat atau upload bukti transfer - offline 100%.</p>
        <div className="flex gap-2 justify-center mt-5">
          <Link to="/chat" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold">
            <ChatRoundDots size={16} /> Tulis Chat
          </Link>
          <Link to="/chat" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm font-semibold">
            <Gallery size={16} /> Upload Bukti
          </Link>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-3">Contoh: "beli kopi di Indomaret 50000"</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--bg)] border border-[var(--border)] grid place-items-center shrink-0">
          <Receipt size={18} className="text-[var(--text-secondary)]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[var(--text-secondary)]">Total pengeluaran</p>
          <p className="text-xl font-bold tracking-tight tabular-nums mt-0.5 text-wrap-balance">{fmtIDR(total)}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{txs.length} transaksi</p>
        </div>
      </div>

      <div className="space-y-2">
        {txs.map((t) => (
          <div key={t.id} className="flex items-center gap-3 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate text-wrap-pretty">{t.description}</p>
              <p className="text-xs text-[var(--text-secondary)]">{fmtDate(t.date)}</p>
            </div>
            <p className="text-sm font-bold whitespace-nowrap tabular-nums">{fmtIDR(t.amount)}</p>
            <button
              type="button"
              aria-label="hapus"
              onClick={() => {
                if (t.id) void db.transactions.delete(t.id);
              }}
              className="w-11 h-11 grid place-items-center rounded-xl hover:bg-[var(--bg)] active:scale-95 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
