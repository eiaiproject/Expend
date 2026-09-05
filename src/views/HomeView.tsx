import { useMemo, useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { fmtIDR, fmtDate } from '../utils/format';
import { Receipt, Trash2, ChatRoundDots, Gallery, Edit, X } from 'reicon-react';
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
  const [editing, setEditing] = useState<Transaction | null>(null);
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
                    aria-label={t('home.editTransaction', { name: tx.description })}
                    onClick={() => setEditing(tx)}
                    className="w-11 h-11 grid place-items-center rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)] active:scale-95 transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                  >
                    <Edit size={18} aria-hidden />
                  </button>
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

      {editing && (
        <EditSheet
          tx={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setToast({ message: t('home.transactionUpdated'), type: 'success' });
          }}
          onError={() => {
            setError(t('home.updateFailed'));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

interface EditSheetProps {
  readonly tx: Transaction;
  readonly onClose: () => void;
  readonly onSaved: () => void;
  readonly onError: () => void;
}

function EditSheet({ tx, onClose, onSaved, onError }: EditSheetProps) {
  const { t } = useTranslation();
  const [description, setDescription] = useState(tx.description);
  const [amount, setAmount] = useState(String(tx.amount));
  const [date, setDate] = useState(tx.date);
  const [source, setSource] = useState(tx.source ?? '');
  const [note, setNote] = useState(tx.note ?? '');
  const [saving, setSaving] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    firstFieldRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prevFocusRef.current?.focus?.();
    };
  }, [onClose]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !tx.id) return;
    const parsedAmount = Number(amount.replaceAll(/\D/g, ''));
    if (!parsedAmount || parsedAmount <= 0) return;
    setSaving(true);
    try {
      await db.transactions.update(tx.id, {
        description: description.trim() || tx.description,
        amount: parsedAmount,
        date,
        source: source.trim() || undefined,
        note: note.trim() || undefined,
      });
      onSaved();
    } catch {
      onError();
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      open
      aria-modal="true"
      aria-label={t('home.editTransaction', { name: tx.description })}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      className="fixed inset-0 z-50 m-0 max-w-none max-h-none w-full h-full bg-transparent backdrop:bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4 motion-safe:animate-[in_0.2s_ease-out]"
    >
      <form
        onSubmit={handleSave}
        className="w-full md:max-w-md bg-[var(--card)] border border-[var(--border)] rounded-t-[var(--radius-xl)] md:rounded-[var(--radius-xl)] p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">{t('home.editTransaction', { name: tx.description })}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('home.cancel')}
            className="w-9 h-9 grid place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-[var(--text-secondary)]">{t('home.editDescription')}</span>
          <input
            ref={firstFieldRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            className="mt-1 w-full min-h-12 px-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 focus-visible:border-[var(--accent)]"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-[var(--text-secondary)]">{t('home.editAmount')}</span>
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="mt-1 w-full min-h-12 px-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 focus-visible:border-[var(--accent)]"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-[var(--text-secondary)]">{t('home.editDate')}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="mt-1 w-full min-h-12 px-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 focus-visible:border-[var(--accent)]"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-[var(--text-secondary)]">{t('home.editSource')}</span>
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="BCA, GoPay, Tunai"
            className="mt-1 w-full min-h-12 px-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 focus-visible:border-[var(--accent)]"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-[var(--text-secondary)]">{t('home.editNote')}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1 w-full min-h-12 px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 focus-visible:border-[var(--accent)] resize-none"
          />
        </label>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm font-semibold hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
          >
            {t('home.cancel')}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 min-h-12 rounded-[var(--radius-md)] bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
          >
            {t('home.saveChanges')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
