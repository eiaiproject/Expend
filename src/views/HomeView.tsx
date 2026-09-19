import { useEffect, useMemo, useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { fmtIDR, fmtDate } from '../utils/format';
import { filterByDate, validateDateRange, jsonBlob, exportFilename, downloadBlob } from '../utils/export';
import { todayLocalISO } from '../utils/date';
import { isBackupDueWithInterval, getBackupInterval, readLastBackup, recordBackup } from '../utils/backup';
import { useDebouncedValue } from '../utils/useDebouncedValue';
import { isEditableElement } from '../utils/keyboard';
import { groupTransactions, type GroupGranularity } from '../utils/grouping';
import { Receipt, Trash2, ChatRoundDots, Gallery, Edit, X, Calendar } from 'reicon-react';
import { Link } from 'react-router-dom';
import { SectionCard } from '../components/SectionCard';
import { EmptyState } from '../components/EmptyState';
import { InlineAlert } from '../components/InlineAlert';
import { SkeletonCard } from '../components/SkeletonCard';
import { FormatCheatSheet } from '../components/FormatCheatSheet';
import { Wordmark } from '../components/Wordmark';
import { QuickToggles } from '../components/QuickToggles';
import { Toast, useToast } from '../components/Toast';
import type { Transaction } from '../db/db';
import { useFocusTrap } from '../utils/focusTrap';
import { useTranslation } from '../i18n';
import type { TranslationKey } from '../i18n/id';

const EMPTY_TXS: Transaction[] = [];
const QUICK_EXAMPLES = ['Kopi 25rb', 'Makan siang 30rb', 'Transport 15rb'];

/** Highlight case-insensitive dengan <mark> untuk hasil search. */
export function highlightMatch(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const lq = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let k = 0;
  for (;;) {
    const idx = lower.indexOf(lq, i);
    if (idx === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(<mark key={k++} className="bg-[var(--warning-soft)] rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>);
    i = idx + q.length;
  }
  return <>{parts}</>;
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

const GRANULARITY_LABEL_KEY: Record<GroupGranularity, TranslationKey> = {
  day: 'home.groupDay',
  week: 'home.groupWeek',
  month: 'home.groupMonth',
};

type QuickRange = 'today' | 'week' | 'month' | 'all';

const QUICK_LABEL_KEY: Record<QuickRange, TranslationKey> = {
  today: 'home.quickToday',
  week: 'home.quick7d',
  month: 'home.quickMonth',
  all: 'home.quickAll',
};

export default function HomeView() {
  const { t } = useTranslation();
  const txsResult = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), []);
  const txs = txsResult ?? EMPTY_TXS;
  const isLoading = txsResult === undefined;
  const [error, setError] = useState<string | null>(null);
  const { toast, showToast, dismissToast } = useToast();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [granularity, setGranularity] = useState<GroupGranularity>('day');
  // TASK 4: pencarian deskripsi (debounce) + shortcut "/" + chip cepat.
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 200);
  const searchRef = useRef<HTMLInputElement>(null);
  // TASK 3: cheat sheet dari empty state.
  const [showSheet, setShowSheet] = useState(false);
  // TASK 9: banner backup sesuai interval (default mingguan).
  const [lastBackup, setLastBackup] = useState<string | null>(readLastBackup);
  const backupDue = isBackupDueWithInterval(txs.length, lastBackup, getBackupInterval());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableElement(document.activeElement)) return;
      const ae = document.activeElement as HTMLElement | null;
      if (ae?.tagName === 'DIALOG' || ae?.closest?.('dialog')) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const applyQuick = (kind: 'today' | 'week' | 'month' | 'all') => {
    const today = todayLocalISO();
    if (kind === 'all') {
      setFilterFrom('');
      setFilterTo('');
    } else if (kind === 'today') {
      setFilterFrom(today);
      setFilterTo(today);
    } else if (kind === 'week') {
      setFilterFrom(addDaysISO(today, -6));
      setFilterTo(today);
    } else {
      setFilterFrom(`${today.slice(0, 7)}-01`);
      setFilterTo(today);
    }
  };

  const backupNow = async () => {
    try {
      const all = await db.transactions.toArray();
      if (!all.length) return;
      downloadBlob(jsonBlob(all), exportFilename('json'));
      setLastBackup(recordBackup());
      showToast(t('settings.exportJSONSukses', { count: all.length }));
    } catch {
      showToast(t('settings.exportJSONError'), 'error');
    }
  };
  const rangeErr = validateDateRange(filterFrom || undefined, filterTo || undefined);
  const hasFilter = filterFrom !== '' || filterTo !== '';
  const dateFiltered = useMemo(
    () => (rangeErr ? txs : filterByDate(txs, filterFrom || undefined, filterTo || undefined)),
    [txs, filterFrom, filterTo, rangeErr],
  );
  const q = debouncedQuery.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? dateFiltered.filter((tx) => tx.description.toLowerCase().includes(q)) : dateFiltered),
    [dateFiltered, q],
  );
  const total = useMemo(() => filtered.reduce((a, tx) => a + tx.amount, 0), [filtered]);
  const groups = useMemo(() => groupTransactions(filtered, granularity), [filtered, granularity]);
  const groupLabel = (key: string) => {
    if (granularity === 'month') return monthLabel(key);
    if (granularity === 'week') return `${fmtDate(key)} - ${fmtDate(addDaysISO(key, 6))}`;
    return fmtDate(key);
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 md:px-6 pt-4 md:pt-0 pb-[calc(60px+env(safe-area-inset-bottom))] space-y-6">
      <header className="flex items-start gap-3">
        <h1 className="sr-only">Expend</h1>
        <div className="min-w-0 flex-1">
        <Wordmark className="h-5 md:h-6 w-auto" />
        <p className="text-sm text-[var(--text-secondary)] mt-1">{t('home.subtitle')}</p>
        </div>
        <QuickToggles />
      </header>

      {isLoading && <SkeletonCard lines={3} />}

      {error && (
        <div role="alert" className="text-xs px-3 py-2.5 rounded-[var(--radius-md)] bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)] flex items-start gap-2">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="min-w-11 min-h-11 grid place-items-center rounded-[var(--radius-md)] text-[var(--danger-deep)] hover:opacity-70 focus-visible:ring-2 focus-visible:ring-[var(--accent)]" aria-label={t('common.close')}><span aria-hidden className="text-lg leading-none">&times;</span></button>
        </div>
      )}

      {!isLoading && txs.length > 0 && backupDue && (
        <div role="note" className="text-xs px-3 py-2.5 rounded-[var(--radius-md)] bg-[var(--warning-soft)] border border-[var(--border)] text-[var(--text-secondary)] flex items-center gap-2">
          <span className="flex-1">{t('home.backupRemind')}</span>
          <button
            type="button"
            onClick={() => void backupNow()}
            className="shrink-0 min-h-11 px-3 rounded-[var(--radius-md)] bg-[var(--accent-fill)] text-[var(--accent-ink)] text-xs font-bold hover:opacity-90 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
          >
            {t('home.backupNow')}
          </button>
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
            <p className="text-xs font-bold text-[var(--text-secondary)] mt-2">{t('home.tryExamples')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {QUICK_EXAMPLES.map((ex) => (
                <Link
                  key={ex}
                  to={`/chat?input=${encodeURIComponent(ex)}`}
                  aria-label={t('chat.useExample', { example: ex })}
                  className="min-h-11 inline-flex items-center px-3.5 rounded-full border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                >
                  {ex}
                </Link>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowSheet(true)}
              className="text-xs font-semibold text-[var(--accent)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 rounded px-1 min-h-8"
            >
              {t('home.learnFormat')}
            </button>
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
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{filtered.length} {t('home.transactions')}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <div className="space-y-3">
              <div>
                <label htmlFor="home-search" className="sr-only">{t('home.searchLabel')}</label>
                <input
                  id="home-search"
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`${t('home.searchPlaceholder')} ( / )`}
                  aria-label={t('home.searchLabel')}
                  autoComplete="off"
                  className="w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]"
                />
              </div>
              <fieldset className="flex flex-wrap gap-2 m-0 p-0 border-0 min-w-0">
                <legend className="sr-only">{t('home.filterDate')}</legend>
                {(['today', 'week', 'month', 'all'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => applyQuick(k)}
                    className="min-h-11 px-3.5 rounded-full border border-[var(--border)] bg-[var(--bg)] text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                  >
                    {t(QUICK_LABEL_KEY[k])}
                  </button>
                ))}
              </fieldset>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">{t('settings.from')}</span>
                  <div className="relative mt-1">
                    <input id="home-filter-from" type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} aria-label={t('settings.from')} className="w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]" />
                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" aria-hidden />
                  </div>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">{t('settings.to')}</span>
                  <div className="relative mt-1">
                    <input id="home-filter-to" type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} aria-label={t('settings.to')} className="w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]" />
                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" aria-hidden />
                  </div>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <fieldset className="flex flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-1 gap-1 m-0 min-w-0">
                  <legend className="sr-only">{t('home.filterDate')}</legend>
                  {(['day', 'week', 'month'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={granularity === g}
                      onClick={() => setGranularity(g)}
                      className={`flex-1 min-h-11 rounded-[var(--radius-sm)] text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 ${granularity === g ? 'bg-[var(--accent-fill)] text-[var(--accent-ink)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bone)]'}`}
                    >
                      {t(GRANULARITY_LABEL_KEY[g])}
                    </button>
                  ))}
                </fieldset>
                {hasFilter && (
                  <button
                    type="button"
                    onClick={() => { setFilterFrom(''); setFilterTo(''); }}
                    className="shrink-0 min-h-12 px-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                  >
                    {t('home.resetFilter')}
                  </button>
                )}
              </div>
            </div>
          </SectionCard>

          {rangeErr === 'from-after-to' && <InlineAlert>{t('settings.fromAfterTo')}</InlineAlert>}
          {rangeErr === 'invalid-date' && <InlineAlert>{t('settings.invalidDate')}</InlineAlert>}

          {filtered.length === 0 ? (
            <SectionCard>
              <p className="text-sm text-[var(--text-secondary)] text-center py-2">{t('home.noMatch')}</p>
            </SectionCard>
          ) : (
          <section aria-label="Transaksi terbaru">
            <h2 className="sr-only">Transaksi terbaru</h2>
            <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.key}>
                <div className="flex items-baseline gap-2 px-1 mb-2">
                  <h3 className="text-xs font-bold tracking-wide uppercase text-[var(--text-secondary)]">{groupLabel(g.key)}</h3>
                  <span className="text-xs text-[var(--text-muted)] tabular-nums">{g.count} &middot; {fmtIDR(g.total)}</span>
                </div>
            <ul className="space-y-2">
              {g.txs.map((tx) => (
                <li
                  key={tx.id}
                  className="list-item flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{highlightMatch(tx.description, debouncedQuery)}</p>
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
                    className="min-w-12 min-h-12 grid place-items-center rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)] active:scale-95 transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
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
                          showToast(t('home.transactionDeleted')); 
                        }
                      } catch {
                        setError(t('home.deleteFailed'));
                      }
                    }}
                    className="min-w-12 min-h-12 -mr-2 grid place-items-center rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)] active:scale-95 transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                  >
                    <Trash2 size={18} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
              </div>
            ))}
            </div>
          </section>
          )}

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
        // key per pesan: tanpa ini instance Toast tidak remount saat pesan baru
        // muncul, sehingga timer pesan lama tetap jalan dan toast baru hilang
        // terlalu cepat.
        <Toast
          key={toast.message}
          message={toast.message}
          type={toast.type}
          onDismiss={dismissToast}
        />
      )}
      <FormatCheatSheet open={showSheet} onClose={() => setShowSheet(false)} />

      {editing && (
        <EditSheet
          tx={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            showToast(t('home.transactionUpdated'));
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
  const sheetRef = useRef<HTMLFormElement>(null);

  useFocusTrap(sheetRef, { onClose, initialFocusRef: firstFieldRef });

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

  // `absolute` (bukan `fixed`) agar modal mengikuti Shell yang sudah dipotong
  // ke visualViewport.height. Di Android keyboard hanya mengecilkan visual
  // viewport (interactive-widget=resizes-visual), jadi modal `fixed` tetap
  // menempel ke viewport layout dan berakhir di balik keyboard. Shell
  // (relative di App.tsx) menjadi containing block-nya, sehingga tak perlu
  // kompensasi inset ganda.
  return (
    <dialog
      open
      aria-modal="true"
      aria-label={t('home.editTransaction', { name: tx.description })}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      className="absolute inset-0 z-50 m-0 max-w-none max-h-none w-full h-full bg-transparent text-[var(--text-primary)] overflow-y-auto overflow-x-hidden p-0 md:p-4 motion-safe:animate-[in_0.2s_ease-out]"
    >
      {/* min-h-full + scroll: form di dasar layar saat muat, tetapi tetap bisa
          di-scroll penuh ketika keyboard menyisakan ruang sedikit. */}
      <div className="min-h-full flex items-end md:items-center justify-center">
      <form
        ref={sheetRef}
        onSubmit={handleSave}
        className="w-full md:max-w-md bg-[var(--card)] border border-[var(--border)] rounded-t-[var(--radius-xl)] md:rounded-[var(--radius-xl)] p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">{t('home.editTransaction', { name: tx.description })}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('home.cancel')}
            className="min-w-11 min-h-11 grid place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
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
            className="mt-1 w-full min-h-12 px-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]"
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
            className="mt-1 w-full min-h-12 px-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-[var(--text-secondary)]">{t('home.editDate')}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="mt-1 w-full min-h-12 px-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-[var(--text-secondary)]">{t('home.editSource')}</span>
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="BCA, GoPay, Tunai"
            className="mt-1 w-full min-h-12 px-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-[var(--text-secondary)]">{t('home.editNote')}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1 w-full min-h-12 px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)] resize-none"
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
      </div>
    </dialog>
  );
}
