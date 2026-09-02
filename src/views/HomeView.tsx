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
import { useTranslation } from '../i18n';

const EMPTY_TXS: Transaction[] = [];

export default function HomeView() {
  const { t } = useTranslation();
  const txsResult = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), []);
  const txs = txsResult ?? EMPTY_TXS;
  const isLoading = txsResult === undefined;
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const total = useMemo(() => txs.reduce((a, tx) => a + tx.amount, 0), [txs]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 md:px-6 pt-4 md:pt-0 pb-[calc(60px+env(safe-area-inset-bottom))] space-y-6">
      <header>
        <h1 className="sr-only">Expend</h1>
        <img src="/Expend-word.svg" alt="Expend" className="h-5 md:h-6 w-auto" />
        <p className="text-sm text-[var(--text-secondary)] mt-1">{t('home.subtitle')}</p>
      </header>

      {isLoading && <SkeletonCard lines={3} />}

      {error && (
        <div role="alert" className="text-xs px-3 py-2.5 rounded-[var(--radius-md)] bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)] flex items-start gap-2">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-[var(--danger)] hover:opacity-70" aria-label={t('common.close')}>&times;</button>
        </div>
      )}

      {!isLoading && txs.length === 0 ? (
        <EmptyState
          title={t('home.emptyTitle')}
          description={t('home.emptyDesc')}
        >
          <div className="flex flex-col gap-2.5 items-center">
            <Link
              to="/chat"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-12 px-5 rounded-[var(--radius-md)] bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
            >
              <ChatRoundDots size={16} aria-hidden />
              {t('home.recordExpense')}
            </Link>
            <Link
              to="/chat?mode=upload"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-12 px-5 rounded-[var(--radius-md)] bg-[var(--card)] border border-[var(--border)] text-sm font-semibold hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
            >
              <Gallery size={16} aria-hidden />
              {t('home.uploadReceipt')}
            </Link>
          </div>
        </EmptyState>
      ) : (
        <>
          <SectionCard>
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--accent-soft)] grid place-items-center shrink-0">
                <Receipt size={18} className="text-[var(--accent)]" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[var(--text-secondary)]">{t('home.totalExpenses')}</p>
                <p className="text-xl font-bold tracking-tight tabular-nums mt-0.5">{fmtIDR(total)}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{txs.length} {t('home.transactions')}</p>
              </div>
            </div>
          </SectionCard>

          <section aria-label="Transaksi terbaru">
            <h2 className="sr-only">Transaksi terbaru</h2>
            <ul className="space-y-2">
              {txs.map((tx) => (
                <li
                  key={tx.id}
                  className="list-item flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{tx.description}</p>
                    <p className="text-xs text-[var(--text-secondary)] tabular-nums mt-0.5">
                      {fmtDate(tx.date)}
                      {tx.source && <>{' '}&middot;{' '}<span className="text-[var(--text-muted)]">{tx.source}</span></>}
                    </p>
                    {tx.note && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate" title={tx.note}>
                        {tx.note}
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-bold whitespace-nowrap tabular-nums shrink-0">{fmtIDR(tx.amount)}</p>
                  <button
                    type="button"
                    aria-label={t('home.deleteTransaction', { name: tx.description })}
                    onClick={async () => {
                      try {
                        if (tx.id) {
                          await db.transactions.delete(tx.id);
                          setToast({ message: t('home.transactionDeleted'), type: 'success' });
                        }
                      } catch {
                        setError(t('home.deleteFailed'));
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
            {t('home.recordNew')}
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
