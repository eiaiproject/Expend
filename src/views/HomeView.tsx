import { useEffect, useMemo, useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { fmtIDR, fmtDate, monthLabelFor } from '../utils/format';
import { filterByDate, validateDateRange, jsonBlob, exportFilename, downloadBlob } from '../utils/export';
import { summarizeActiveTransactions } from '../utils/transactionSummary';
import { addDaysISO, todayLocalISO } from '../utils/date';
import { isBackupDueWithInterval, getBackupInterval, readLastBackup, recordBackup, BACKUP_KEY, BACKUP_INTERVAL_KEY } from '../utils/backup';
import { restoreTransaction, softDeleteTransaction } from '../utils/transactionMutations';
import { useDebouncedValue } from '../utils/useDebouncedValue';
import { isEditableElement } from '../utils/keyboard';
import { groupTransactions, type GroupGranularity } from '../utils/grouping';
import { GRANULARITY_LABEL_KEY, QUICK_LABEL_KEY, highlightMatch } from './home/homeUtils';
import { Receipt, Trash2, ChatRoundDots, Gallery, Edit, Calendar } from 'reicon-react';
import { Link } from 'react-router-dom';
import { SectionCard } from '../components/SectionCard';
import { EmptyState } from '../components/EmptyState';
import { InlineAlert } from '../components/InlineAlert';
import { SkeletonCard } from '../components/SkeletonCard';
import { DbErrorNotice } from '../components/DbErrorNotice';
import { FormatCheatSheet } from '../components/FormatCheatSheet';
import { Wordmark } from '../components/Wordmark';
import { QuickToggles } from '../components/QuickToggles';
import { Toast, useToast } from '../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { Transaction } from '../db/db';
import { useTranslation } from '../i18n';
import { EditSheet } from './home/EditSheet';

const EMPTY_TXS: Transaction[] = [];
/** Jumlah grup (hari/minggu/bulan) yang dirender sekaligus. */
const GROUP_PAGE = 30;
const QUICK_EXAMPLE_KEYS = ['home.example1', 'home.example2', 'home.example3'] as const;

export default function HomeView() {
  const { t, lang } = useTranslation();
  const [dbRetry, setDbRetry] = useState(0);
  const [txLimit, setTxLimit] = useState(1000);
  const txsResult = useLiveQuery(
    () => db.transactions.orderBy('date').reverse().limit(txLimit).toArray().then((rows) => rows.filter((tx) => !tx.deletedAt)).catch(() => null),
    [dbRetry, txLimit],
  );
  const txs = txsResult ?? EMPTY_TXS;
  const isLoading = txsResult === undefined;
  const loadFailed = txsResult === null;
  const retryDb = async () => {
    try {
      await db.open();
    } catch {
      // Query berikutnya tetap menampilkan notice yang sama bila DB masih gagal.
    }
    setDbRetry((n) => n + 1);
  };
  const [error, setError] = useState<string | null>(null);
  const { toast, showToast, dismissToast } = useToast();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [confirmDeleteTx, setConfirmDeleteTx] = useState<Transaction | null>(null);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [granularity, setGranularity] = useState<GroupGranularity>('day');
  // pencarian deskripsi (debounce) + shortcut "/" + chip cepat.
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 200);
  const searchRef = useRef<HTMLInputElement>(null);
  // cheat sheet dari empty state.
  const [showSheet, setShowSheet] = useState(false);
  // Paging daftar disimpan bersama "sidik jari" filternya: begitu filter atau
  // granularitas berubah, sidik jari tidak cocok dan daftar otomatis mulai lagi
  // dari grup terbaru - tanpa setState di dalam effect (react-hooks/set-state-in-effect).
  const [paging, setPaging] = useState({ key: '', count: GROUP_PAGE });
  // banner backup sesuai interval (default mingguan).
  const [lastBackup, setLastBackup] = useState<string | null>(readLastBackup);
  const backupDue = isBackupDueWithInterval(txs.length, lastBackup, getBackupInterval());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === BACKUP_KEY || e.key === BACKUP_INTERVAL_KEY) {
        setLastBackup(readLastBackup());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

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
      const all = (await db.transactions.toArray()).filter((tx) => !tx.deletedAt);
      if (!all.length) return;
      const ok = downloadBlob(jsonBlob(all), exportFilename('json'));
      if (!ok) {
        showToast(t('settings.exportJSONError'), 'error');
        return;
      }
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
  const fallbackTotal = useMemo(() => filtered.reduce((a, tx) => a + tx.amount, 0), [filtered]);
  const summary = useLiveQuery(
    () => summarizeActiveTransactions({
      from: filterFrom || undefined,
      to: filterTo || undefined,
      query: debouncedQuery,
    }).catch(() => null),
    [filterFrom, filterTo, debouncedQuery, dbRetry],
  );
  const total = summary?.total ?? fallbackTotal;
  const visibleCount = summary?.count ?? filtered.length;
  const hasMoreRows = summary !== null && summary !== undefined && summary.count > filtered.length;
  const groups = useMemo(() => groupTransactions(filtered, granularity), [filtered, granularity]);
  // Daftar dibatasi per grup: 1.000 transaksi dengan rentang tanggal lebar
  // sebelumnya merender ribuan baris sekaligus. Grup yang tersembunyi dibuka
  // lewat tombol, jadi header grup yang tampil tetap melaporkan total aslinya.
  const filterKey = `${filterFrom}|${filterTo}|${q}|${granularity}`;
  const visibleGroups = paging.key === filterKey ? paging.count : GROUP_PAGE;
  const shownGroups = useMemo(() => groups.slice(0, visibleGroups), [groups, visibleGroups]);
  const hiddenGroups = groups.length - shownGroups.length;
  const groupLabel = (key: string) => {
    if (granularity === 'month') return monthLabelFor(key, lang);
    if (granularity === 'week') return `${fmtDate(key, lang)} - ${fmtDate(addDaysISO(key, 6), lang)}`;
    return fmtDate(key, lang);
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

      {loadFailed && (
        <DbErrorNotice
          message={t('home.loadError')}
          retryLabel={t('common.retry')}
          onRetry={() => void retryDb()}
        />
      )}

      {error && (
        <div role="alert" className="text-xs px-3 py-2.5 rounded-[var(--radius-md)] bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)] flex items-start gap-2">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="min-w-12 min-h-12 grid place-items-center rounded-[var(--radius-md)] text-[var(--danger-deep)] hover:opacity-70 focus-visible:ring-2 focus-visible:ring-[var(--accent)]" aria-label={t('common.close')}><span aria-hidden className="text-lg leading-none">&times;</span></button>
        </div>
      )}

      {!isLoading && txs.length > 0 && backupDue && (
        <div role="note" className="text-xs px-3 py-2.5 rounded-[var(--radius-md)] bg-[var(--warning-soft)] border border-[var(--border)] text-[var(--text-secondary)] flex items-center gap-2">
          <span className="flex-1">{t('home.backupRemind')}</span>
          <button
            type="button"
            onClick={() => void backupNow()}
            className="shrink-0 min-h-12 px-3 rounded-[var(--radius-md)] bg-[var(--accent-fill)] text-[var(--accent-ink)] text-xs font-bold hover:opacity-90 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
          >
            {t('home.backupNow')}
          </button>
        </div>
      )}

      {!isLoading && !loadFailed && (txs.length === 0 ? (
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
              {QUICK_EXAMPLE_KEYS.map((key) => {
                const ex = t(key);
                return (
                  <Link
                    key={key}
                    to={`/chat?input=${encodeURIComponent(ex)}`}
                    aria-label={t('chat.useExample', { example: ex })}
                    className="min-h-12 inline-flex items-center px-3.5 rounded-full border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                  >
                    {ex}
                  </Link>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setShowSheet(true)}
              className="text-xs font-semibold text-[var(--accent)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 rounded px-1 min-h-12 inline-flex items-center"
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
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{visibleCount} {t('home.transactions')}</p>
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
                    className="min-h-12 px-3.5 rounded-full border border-[var(--border)] bg-[var(--bg)] text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
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
                      className={`flex-1 min-h-12 rounded-[var(--radius-sm)] text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 ${granularity === g ? 'bg-[var(--accent-fill)] text-[var(--accent-ink)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bone)]'}`}
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
            {shownGroups.map((g) => (
              <div key={g.key}>
                <div className="flex items-baseline gap-2 px-1 mb-2">
                  <h3 className="text-xs font-bold tracking-wide uppercase text-[var(--text-secondary)]">{groupLabel(g.key)}</h3>
                  <span className="text-xs text-[var(--text-muted)] tabular-nums">{g.count} &middot; {fmtIDR(g.total)}</span>
                </div>
            <ul className="space-y-2">
              {g.txs.map((tx) => (
                <li
                  key={tx.id}
                  // content-visibility: baris di luar viewport dilewati saat layout/paint.
                  style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 76px' } as React.CSSProperties}
                  className="list-item flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{highlightMatch(tx.description, debouncedQuery)}</p>
                    <p className="text-xs text-[var(--text-secondary)] tabular-nums mt-0.5">
                      {fmtDate(tx.date, lang)}
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
                    onClick={() => setConfirmDeleteTx(tx)}
                    className="min-w-12 min-h-12 -mr-2 grid place-items-center rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)] active:scale-95 transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                  >
                    <Trash2 size={18} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
              </div>
            ))}
            {hiddenGroups > 0 && (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={() => setPaging({ key: filterKey, count: visibleGroups + GROUP_PAGE })}
                  className="min-h-12 px-4 rounded-full bg-[var(--card)] border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                >
                  {t('home.showMore', { count: hiddenGroups })}
                </button>
              </div>
            )}
            </div>
          </section>
          )}

          {hasMoreRows && (
            <button
              type="button"
              onClick={() => setTxLimit((v) => v + 1000)}
              className="w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
            >
              {t('home.loadMoreTransactions')}
            </button>
          )}

          <Link
            to="/chat"
            className="flex items-center justify-center gap-2 w-full min-h-12 px-5 rounded-[var(--radius-md)] bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
          >
            <ChatRoundDots size={16} aria-hidden />
            {t('home.recordNew')}
          </Link>
        </>
      ))}

      {toast && (
        // key per pesan: tanpa ini instance Toast tidak remount saat pesan baru
        // muncul, sehingga timer pesan lama tetap jalan dan toast baru hilang
        // terlalu cepat.
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onDismiss={dismissToast}
        />
      )}
      <FormatCheatSheet open={showSheet} onClose={() => setShowSheet(false)} />

      <ConfirmDialog
        open={confirmDeleteTx !== null}
        title={t('home.deleteConfirmTitle')}
        description={confirmDeleteTx ? t('home.deleteConfirmDesc', { name: confirmDeleteTx.description, amount: fmtIDR(confirmDeleteTx.amount) }) : ''}
        confirmLabel={t('common.delete')}
        cancelLabel={t('home.cancel')}
        destructive
        onCancel={() => setConfirmDeleteTx(null)}
        onConfirm={() => {
          const tx = confirmDeleteTx;
          setConfirmDeleteTx(null);
          if (!tx?.id) return;
          void (async () => {
            try {
              await softDeleteTransaction(tx.id!);
              showToast(t('home.transactionDeleted'), 'success', {
                label: t('common.undo'),
                onClick: () => {
                  void (async () => {
                    try {
                      await restoreTransaction(tx.id!);
                      showToast(t('home.transactionRestored'));
                    } catch {
                      setError(t('home.restoreFailed'));
                    }
                  })();
                },
              });
            } catch {
              setError(t('home.deleteFailed'));
            }
          })();
        }}
      />

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

