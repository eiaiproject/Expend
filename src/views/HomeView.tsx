import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { fmtIDR, fmtDate } from '../utils/format';
import { Receipt, Trash2 } from 'reicon-react';
import { Link } from 'react-router-dom';

export default function HomeView() {
  const txs = useLiveQuery(() => db.transactions.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const total = txs.reduce((a, t) => a + t.amount, 0);

  if (!txs.length) {
    return (
      <div className="py-10 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-[var(--border)] flex items-center justify-center mb-3"><Receipt size={24} className="text-[var(--text-secondary)]" /></div>
        <p className="font-semibold">Belum ada transaksi</p>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Catat lewat Chat — contoh: &quot;beli kopi di Indomaret 50000&quot;</p>
        <Link to="/chat" className="inline-flex mt-4 px-5 py-2.5 rounded-xl bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold">Buka Chat</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[var(--accent)] text-white p-5">
        <p className="text-xs opacity-80">Total pengeluaran</p>
        <p className="text-2xl font-bold mt-1">{fmtIDR(total)}</p>
        <p className="text-xs opacity-70 mt-1">{txs.length} transaksi</p>
      </div>

      <div className="space-y-2">
        {txs.map((t) => (
          <div key={t.id} className="flex items-center gap-3 p-3.5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{t.description}</p>
              <p className="text-xs text-[var(--text-secondary)]">{fmtDate(t.date)}</p>
            </div>
            <p className="text-sm font-bold whitespace-nowrap">{fmtIDR(t.amount)}</p>
            <button type="button" aria-label="hapus" onClick={() => { if (t.id) void db.transactions.delete(t.id); }} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-[var(--bg)] text-[var(--text-secondary)]">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
