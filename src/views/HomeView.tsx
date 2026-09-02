import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { fmtIDR, fmtDate } from '../utils/format';
import { Receipt, Trash2, ChatRoundDots, Gallery } from 'reicon-react';
import { Link } from 'react-router-dom';
import { SectionCard } from '../components/SectionCard';
import { EmptyState } from '../components/EmptyState';
import { SkeletonCard } from '../components/SkeletonCard';
import { Toast } from '../components/Toast';
import type { Transaction } from '../db/db';

const EMPTY_TXS: Transaction[] = [];

export default function HomeView() {
  const txsResult = useLiveQuery(() => db.transactions.orderBy('createdAt').reverse().toArray(), []);
  const txs = txsResult ?? EMPTY_TXS;
  const isLoading = txsResult === undefined;
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const total = useMemo(() => txs.reduce((a, t) => a + t.amount, 0), [txs]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 md:px-6 pt-4 md:pt-0 pb-8 space-y-6">
      <header>
        <h1 className="sr-only">Expend</h1>
        <img src="/Expend-word.svg" alt="Expend" className="h-5 md:h-6 w-auto" />
        <p className="text-sm text-[var(--text-secondary)] mt-1">Pantau pengeluaran dan transaksi terbaru</p>
      </header>

      {isLoading && <SkeletonCard lines={3} />}

      {error && (
        <div role="alert" className="text-xs px-3 py-2.5 rounded-[var(--radius-md)] bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)] flex items-start gap-2">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-[var(--danger)] hover:opacity-70" aria-label="Tutup">&times;</button>
        </div>
      )}

      {!isLoading && txs.length === 0 ? (
        <EmptyState
          title="Belum ada transaksi"
          description="Catat pengeluaran lewat chat atau unggah bukti transaksi. Data diproses di perangkat Anda."
        >
          <div className="flex flex-col gap-2.5 items-center">
            <Link
              to="/chat"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-12 px-5 rounded-[var(--radius-md)] bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
            >
              <ChatRoundDots size={16} aria-hidden />
              Catat pengeluaran
            </Link>
            <Link
              to="/chat?mode=upload"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-12 px-5 rounded-[var(--radius-md)] bg-[var(--card)] border border-[var(--border)] text-sm font-semibold hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
            >
              <Gallery size={16} aria-hidden />
              Unggah bukti
            </Link>
          </div>
        </EmptyState>
      ) : (
        <>
          <SectionCard>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-soft)] grid place-items-center shrink-0">
                <Receipt size={18} className="text-[var(--accent)]" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[var(--text-secondary)]">Total pengeluaran</p>
                <p className="text-xl font-bold tracking-tight tabular-nums mt-0.5">{fmtIDR(total)}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{txs.length} transaksi</p>
              </div>
            </div>
          </SectionCard>

          <section aria-label="Transaksi terbaru">
            <h2 className="sr-only">Transaksi terbaru</h2>
            <ul className="space-y-2">
              {txs.map((t) => (
                <li
                  key={t.id}
                  className="list-item flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{t.description}</p>
                    <p className="text-xs text-[var(--text-secondary)] tabular-nums mt-0.5">
                      {fmtDate(t.date)}
                      {t.source && <>{' '}&middot;{' '}<span className="text-[var(--text-muted)]">{t.source}</span></>}
                    </p>
                    {t.note && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate" title={t.note}>
                        {t.note}
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-bold whitespace-nowrap tabular-nums shrink-0">{fmtIDR(t.amount)}</p>
                  <button
                    type="button"
                    aria-label={`Hapus transaksi ${t.description}`}
                    onClick={async () => {
                      try {
                        if (t.id) {
                          await db.transactions.delete(t.id);
                          setToast({ message: 'Transaksi dihapus.', type: 'success' });
                        }
                      } catch {
                        setError('Gagal menghapus transaksi. Coba lagi.');
                      }
                    }}
                    className="w-11 h-11 -mr-2 grid place-items-center rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)] active:scale-95 transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                  >
                    <Trash2 size={18} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <Link
            to="/chat"
            className="flex items-center justify-center gap-2 w-full min-h-12 px-5 rounded-[var(--radius-md)] bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
          >
            <ChatRoundDots size={16} aria-hidden />
            Catat pengeluaran baru
          </Link>
        </>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
