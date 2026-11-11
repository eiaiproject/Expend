import { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, Download, Calendar } from 'reicon-react';
import { db, type Transaction } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageHeader } from '../components/PageHeader';
import { SectionCard } from '../components/SectionCard';
import { Toast, useToast } from '../components/Toast';
import { ExportWizard, type ExportKind } from '../components/ExportWizard';
import { FormatCheatSheet } from '../components/FormatCheatSheet';
import { csvBlob, jsonBlob, parseImportJSON, IMPORT_MAX_BYTES, filterByDate, exportFilename, downloadBlob, validateDateRange } from '../utils/export';
import { fmtDate } from '../utils/format';
import { parseSheetsCSV, SHEETS_IMPORT_MAX_BYTES } from '../utils/sheetsImport';
import { parseSheetsXLSX } from '../utils/xlsxImport';
import { persistFreshTransactions, type StorableTransaction } from '../utils/importStore';
import { isBackupDueWithInterval, readLastBackup, recordBackup, getBackupInterval, setBackupInterval as persistBackupInterval, BACKUP_KEY, BACKUP_INTERVAL_KEY, type BackupInterval } from '../utils/backup';
import { getFontSize, setFontSize as persistFontSize, isHighContrast, setHighContrast as persistHighContrast, type FontSize } from '../utils/a11yPrefs';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DbErrorNotice } from '../components/DbErrorNotice';
import { SettingsSection, Toggle } from '../components/SettingsPrimitives';
import { SettingsInfoSections } from './settings/SettingsInfoSections';
import { AiSettingsSection } from './settings/AiSettingsSection';
import { clearAllData } from '../utils/transactionMutations';
import { getStorageStatus, type StorageStatus } from '../utils/storage';
import { APP_VERSION } from '../config/version';

const EXPORT_ERROR_KEY = {
  csv: 'settings.exportCSVError',
  json: 'settings.exportJSONError',
} as const;
import { useTranslation } from '../i18n';
import type { Lang } from '../i18n';
import type { TranslationKey } from '../i18n/id';
import { useTheme, type Theme } from '../utils/theme';

/** Array stabil untuk state "wizard tertutup" - hindari alokasi baru tiap render. */
const WIZARD_TXS_EMPTY: Transaction[] = [];

type ImportParseResult = { ok: boolean; transactions: StorableTransaction[]; skipped: number; errors: string[] };

const FONT_SIZE_LABEL_KEY: Record<FontSize, TranslationKey> = {
  s: 'settings.fontSizeS',
  m: 'settings.fontSizeM',
  l: 'settings.fontSizeL',
};

export default function SettingsView() {
  const { t, lang, setLang } = useTranslation();
  const version = APP_VERSION;
  // Halaman ini cuma butuh jumlah baris; tabel penuh dimuat hanya saat wizard
  // ekspor dibuka (sebelumnya seluruh transaksi dibaca setiap kali Settings dibuka).
  const [dbRetry, setDbRetry] = useState(0);
  const txCountResult = useLiveQuery(() => db.transactions.filter((tx) => !tx.deletedAt).count().catch(() => null), [dbRetry]);
  const txCount = txCountResult ?? 0;
  const countLoading = txCountResult === undefined;
  const countFailed = txCountResult === null;
  // Tiga keadaan saling eksklusif; fungsi kecil menjaga JSX bebas ternary bersarang.
  const deleteAllDescription = () => {
    if (countLoading) return t('common.loadingData');
    if (countFailed) return t('settings.countError');
    return t('settings.deleteAllDesc', { count: txCount });
  };
  const retryDb = async () => {
    try {
      await db.open();
    } catch {
      // Query berikutnya menampilkan notice yang sama bila DB masih gagal.
    }
    setDbRetry((n) => n + 1);
  };
  const { theme, setTheme } = useTheme();
  const { toast, showToast, dismissToast } = useToast();
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [lastBackup, setLastBackup] = useState<string | null>(readLastBackup);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // wizard ekspor, cheat sheet, preferensi a11y, interval backup.
  const [showWizard, setShowWizard] = useState(false);
  // Wizard butuh seluruh baris (untuk preview + rentang tanggal), jadi tabel
  // penuh baru dibaca saat wizard terbuka - bukan setiap Settings dibuka.
  const wizardTxs = useLiveQuery(
    () => (showWizard
      ? db.transactions.orderBy('date').reverse().toArray().then((rows) => rows.filter((tx) => !tx.deletedAt))
      : Promise.resolve(WIZARD_TXS_EMPTY)),
    [showWizard],
  ) ?? WIZARD_TXS_EMPTY;
  const [showSheet, setShowSheet] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>(getFontSize);
  const [highContrast, setHighContrast] = useState(isHighContrast);
  const [backupInterval, setBackupInterval] = useState<BackupInterval>(getBackupInterval);
  const [storageStatus, setStorageStatus] = useState<StorageStatus>('unsupported');
  // Harus mengikuti interval yang dipilih user (sama seperti banner di Summary).
  // Sebelumnya di sini selalu 30 hari, sehingga status "backup jatuh tempo" di
  // halaman tempat interval diatur justru tidak sinkron dengan pengaturannya.
  const backupDue = isBackupDueWithInterval(txCount, lastBackup, backupInterval);
  const importRef = useRef<HTMLInputElement>(null);
  const importInFlight = useRef(false);

  useEffect(() => {
    void getStorageStatus().then(setStorageStatus);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === BACKUP_KEY || e.key === BACKUP_INTERVAL_KEY) {
        setLastBackup(readLastBackup());
        setBackupInterval(getBackupInterval());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Satu jalur ekspor untuk csv/json: validasi range + filter + empty
  // check hanya sekali agar tidak terduplikasi per format. Wizard memanggil
  // dengan override rentang sendiri; tombol cepat memakai state exportFrom/To.
  const handleExport = useCallback(async (kind: 'csv' | 'json', fromOverride?: string, toOverride?: string) => {
    const from = fromOverride ?? exportFrom;
    const to = toOverride ?? exportTo;
    const rangeErr = validateDateRange(from || undefined, to || undefined);
    if (rangeErr === 'from-after-to') {
      showToast(t('settings.fromAfterTo'), 'error');
      return;
    }
    if (rangeErr === 'invalid-date') {
      showToast(t('settings.invalidDate'), 'error');
      return;
    }
    try {
      const all = (await db.transactions.toArray()).filter((tx) => !tx.deletedAt);
      const filtered = filterByDate(all, from || undefined, to || undefined);
      if (!filtered.length) {
        showToast(t('settings.noExport'), 'error');
        return;
      }
      if (kind === 'csv') {
        const ok = downloadBlob(csvBlob(filtered), exportFilename('csv', from || undefined, to || undefined));
        if (!ok) {
          showToast(t('settings.exportCSVError'), 'error');
          return;
        }
        setLastBackup(recordBackup());
        showToast(t('settings.exportCSVSukses', { count: filtered.length }));
      } else {
        const ok = downloadBlob(jsonBlob(filtered), exportFilename('json', from || undefined, to || undefined));
        if (!ok) {
          showToast(t('settings.exportJSONError'), 'error');
          return;
        }
        setLastBackup(recordBackup());
        showToast(t('settings.exportJSONSukses', { count: filtered.length }));
      }
    } catch {
      showToast(t(EXPORT_ERROR_KEY[kind]), 'error');
    }
  }, [exportFrom, exportTo, showToast, t]);

  const handleWizardExport = useCallback((kind: ExportKind, from: string, to: string) => {
    void handleExport(kind, from, to);
  }, [handleExport]);

  // Impor CSV hasil download Google Sheets: hanya 5 kolom yang dipakai
  // (Tanggal, Penerima, Nominal, Sumber Dana, Catatan); ID/Input/Status/
  // Dicatat Pada dibuang di parser. Append-only + dedupe eksak vs DB.
  // Jalur persist bersama impor JSON dan CSV Sheets: parse → dedupe vs DB
  // → bulkAdd atomik → toast. Satu tempat agar pesan dan kebijakan identik.
  const persistParsedImport = useCallback(async (
    parse: () => Promise<ImportParseResult>,
    msg: { ok: TranslationKey; skipped: TranslationKey; fail: TranslationKey },
  ) => {
    let res: ImportParseResult;
    try {
      res = await parse();
    } catch {
      showToast(t(msg.fail), 'error');
      return;
    }
    if (!res.ok || res.transactions.length === 0) {
      showToast(t(msg.fail), 'error');
      return;
    }
    let outcome;
    try {
      outcome = await persistFreshTransactions(res.transactions);
    } catch {
      showToast(t(msg.fail), 'error');
      return;
    }
    if (outcome.status === 'quota') {
      showToast(t(msg.fail), 'error');
      return;
    }
    const skippedTotal = res.skipped + outcome.skippedInDb;
    showToast(skippedTotal > 0
      ? `${t(msg.ok, { count: outcome.fresh })} ${t(msg.skipped, { count: skippedTotal })}`
      : t(msg.ok, { count: outcome.fresh }));
  }, [showToast, t]);

  const handleImportSheetsCSV = useCallback(async (file: File) => {
    if (file.size > SHEETS_IMPORT_MAX_BYTES || file.size === 0) {
      showToast(t('settings.importSheetsError'), 'error');
      return;
    }
    await persistParsedImport(
      async () => parseSheetsCSV(await file.text()),
      { ok: 'settings.importSheetsSukses', skipped: 'settings.importSheetsSkipped', fail: 'settings.importSheetsError' },
    );
  }, [showToast, t, persistParsedImport]);

  const handleImportSheetsXLSX = useCallback(async (file: File) => {
    if (file.size > SHEETS_IMPORT_MAX_BYTES || file.size === 0) {
      showToast(t('settings.importSheetsError'), 'error');
      return;
    }
    await persistParsedImport(
      () => parseSheetsXLSX(file),
      { ok: 'settings.importSheetsSukses', skipped: 'settings.importSheetsSkipped', fail: 'settings.importSheetsError' },
    );
  }, [showToast, t, persistParsedImport]);

  const handleImportFile = useCallback(async (file: File) => {
    if (importInFlight.current) {
      showToast(t('settings.importBusy'), 'error');
      if (importRef.current) importRef.current.value = '';
      return;
    }
    importInFlight.current = true;
    try {
      const lower = file.name.toLowerCase();
      const isCsv = lower.endsWith('.csv');
      const isJson = lower.endsWith('.json');
      const isXlsx = lower.endsWith('.xlsx');
      if (!isCsv && !isJson && !isXlsx) {
        showToast(t('settings.importUnsupported'), 'error');
        return;
      }
      if (isCsv) {
        await handleImportSheetsCSV(file);
        return;
      }
      if (isXlsx) {
        await handleImportSheetsXLSX(file);
        return;
      }
      if (file.size > IMPORT_MAX_BYTES || file.size === 0) {
        showToast(t('settings.importJSONError'), 'error');
        return;
      }
      await persistParsedImport(
        async () => parseImportJSON(await file.text()),
        { ok: 'settings.importJSONSukses', skipped: 'settings.importJSONSkipped', fail: 'settings.importJSONError' },
      );
    } finally {
      importInFlight.current = false;
      if (importRef.current) importRef.current.value = '';
    }
  }, [showToast, t, handleImportSheetsCSV, handleImportSheetsXLSX, persistParsedImport]);

  const handleDeleteAll = useCallback(async () => {
    try {
      await clearAllData();
      showToast(t('settings.deleteSuccess'));
    } catch {
      showToast(t('settings.deleteError'), 'error');
    } finally {
      setConfirmDelete(false);
    }
  }, [showToast, t]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 md:px-6 pt-4 md:pt-0 pb-[calc(60px+env(safe-area-inset-bottom))] space-y-6">
      <PageHeader
        title={t('settings.title')}
        description={t('settings.subtitle')}
      />

      {countFailed && (
        <DbErrorNotice
          message={t('settings.countError')}
          retryLabel={t('common.retry')}
          onRetry={() => void retryDb()}
        />
      )}

      {/* Preferences */}
      <SettingsSection title={t('settings.preferences')}>
        <SectionCard padding="sm">
          <div className="divide-y divide-[var(--border)]">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{t('settings.theme')}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('settings.themeDesc')}</p>
              </div>
              <div className="relative">
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as Theme)}
                  aria-label={t('settings.theme')}
                  className="h-12 pl-3 pr-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm font-medium outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] appearance-none"
                >
                  <option value="light">{t('settings.themeLight')}</option>
                  <option value="dark">{t('settings.themeDark')}</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]" size={16} aria-hidden />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{t('settings.numberFormat')}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('settings.numberFormatDesc')}</p>
              </div>
              <span className="text-sm font-medium text-[var(--text-muted)]">Rp</span>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{t('settings.fontSize')}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('settings.fontSizeDesc')}</p>
              </div>
              <fieldset className="grid grid-cols-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-1 gap-1 m-0 shrink-0">
                <legend className="sr-only">{t('settings.fontSize')}</legend>
                {(['s', 'm', 'l'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={fontSize === s}
                    onClick={() => { persistFontSize(s); setFontSize(s); }}
                    className={`min-h-12 px-2 rounded-[var(--radius-sm)] text-xs font-bold text-center truncate transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 ${fontSize === s ? 'bg-[var(--accent-fill)] text-[var(--accent-ink)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bone)]'}`}
                  >
                    {t(FONT_SIZE_LABEL_KEY[s])}
                  </button>
                ))}
              </fieldset>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{t('settings.contrast')}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('settings.contrastDesc')}</p>
              </div>
              <Toggle checked={highContrast} onChange={(v) => { persistHighContrast(v); setHighContrast(v); }} label={t('settings.contrast')} />
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{t('settings.tutorial')}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('settings.tutorialDesc')}</p>
              </div>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event('expend:replay-onboarding'))}
                className="shrink-0 min-h-12 px-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-xs font-bold hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
              >
                {t('onboarding.replay')}
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{t('chat.formatHelp')}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('chat.sheetDesc')}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSheet(true)}
                aria-label={t('chat.formatHelp')}
                className="shrink-0 w-12 h-12 grid place-items-center rounded-full border border-[var(--border)] bg-[var(--bg)] text-sm font-bold hover:bg-[var(--bone)] active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
              >
                <span aria-hidden>?</span>
              </button>
            </div>
          </div>
        </SectionCard>
      </SettingsSection>

      <AiSettingsSection />

      {/* Data */}
      {/* Language */}
      <SettingsSection title={t('settings.language')}>
        <SectionCard padding="sm">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{t('settings.language')}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('settings.languageDesc')}</p>
              </div>
              <div className="relative">
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value as Lang)}
                  aria-label={t('settings.language')}
                  className="h-12 pl-3 pr-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm font-medium outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] appearance-none"
                >
                  <option value="id">Bahasa Indonesia</option>
                  <option value="en">English</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]" size={16} aria-hidden />
              </div>
            </div>
          </div>
        </SectionCard>
      </SettingsSection>

      <SettingsSection title={t('settings.data')}>
        <SectionCard>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold">{t('settings.exportDateRange')}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('settings.exportDateRangeDesc')}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-[var(--text-secondary)]">{t('settings.from')}</span>
                <div className="relative mt-1">
                  <input id="export-from" type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} className="w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]" />
                  <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" aria-hidden />
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-[var(--text-secondary)]">{t('settings.to')}</span>
                <div className="relative mt-1">
                  <input id="export-to" type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} className="w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]" />
                  <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" aria-hidden />
                </div>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" aria-label={t('settings.exportCSV')} onClick={() => void handleExport('csv')} disabled={txCount === 0} aria-disabled={txCount === 0} className="min-h-12 rounded-[var(--radius-md)] bg-[var(--card)] border border-[var(--border)] text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 disabled:opacity-40 disabled:active:scale-100">
                <Download size={16} aria-hidden /> {t('settings.exportCSV')}
              </button>
              <button type="button" aria-label={t('settings.exportJSON')} onClick={() => void handleExport('json')} disabled={txCount === 0} aria-disabled={txCount === 0} className="min-h-12 rounded-[var(--radius-md)] bg-[var(--card)] border border-[var(--border)] text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 disabled:opacity-40 disabled:active:scale-100">
                <Download size={16} aria-hidden /> {t('settings.exportJSON')}
              </button>
              <button type="button" aria-label={t('settings.importFile')} onClick={() => importRef.current?.click()} className="min-h-12 rounded-[var(--radius-md)] bg-[var(--card)] border border-[var(--border)] text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 disabled:opacity-40 disabled:active:scale-100">
                <Download size={16} aria-hidden /> {t('settings.importFile')}
              </button>
              <button type="button" onClick={() => setShowWizard(true)} disabled={txCount === 0} className="min-h-12 rounded-[var(--radius-md)] bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold inline-flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 disabled:opacity-40 disabled:active:scale-100">
                {t('export.wizardTitle')}
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1">
              <div>
                <p className="text-sm font-semibold">{t('settings.backupInterval')}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('settings.backupIntervalDesc')}</p>
              </div>
              <div className="relative">
                <select
                  value={backupInterval}
                  onChange={(e) => { const v = e.target.value as BackupInterval; persistBackupInterval(v); setBackupInterval(v); }}
                  aria-label={t('settings.backupInterval')}
                  className="h-12 pl-3 pr-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm font-medium outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] appearance-none"
                >
                  <option value="weekly">{t('settings.backupWeekly')}</option>
                  <option value="monthly">{t('settings.backupMonthly')}</option>
                  <option value="off">{t('settings.backupOff')}</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]" size={16} aria-hidden />
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleExport('json')}
              disabled={txCount === 0}
              className="w-full min-h-12 rounded-[var(--radius-md)] bg-[var(--card)] border border-[var(--border)] text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 disabled:opacity-40"
            >
              <Download size={16} aria-hidden /> {t('settings.backupNow')}
            </button>
            <p className="text-xs text-[var(--text-muted)]">{t('settings.importFileDesc')}</p>
            <input ref={importRef} type="file" accept="application/json,.json,text/csv,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx" className="hidden" aria-label={t('settings.importFile')} onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImportFile(f); }} />
            {backupDue && (
              <p className="text-xs text-[var(--text-secondary)]" role="note">
                {t('settings.backupDue')}
              </p>
            )}
            {!backupDue && lastBackup && (
              <p className="text-xs text-[var(--text-muted)]">
                {t('settings.backupLast', { date: fmtDate(lastBackup.slice(0, 10), lang) })}
              </p>
            )}
          </div>
        </SectionCard>
      </SettingsSection>

      <SettingsInfoSections
        storageStatus={storageStatus}
        txCount={txCount}
        version={version}
        deleteAllDescription={deleteAllDescription}
        onRequestDelete={() => setConfirmDelete(true)}
      />

      {/* Footer */}
      <div className="text-center pt-2 pb-4">
        <p className="text-xs text-[var(--text-muted)] font-mono">expend.pages.dev</p>
      </div>

      {/* Toast - key per pesan agar timer toast baru tidak mewarisi sisa timer lama. */}
      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onDismiss={dismissToast}
        />
      )}

      {/* Confirm Delete All */}
      <ConfirmDialog
        open={confirmDelete}
        title={t('settings.deleteAllConfirm')}
        description={t('settings.deleteAllConfirmDesc', { count: txCount })}
        confirmLabel={t('settings.deleteAllButton')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={handleDeleteAll}
        onCancel={() => setConfirmDelete(false)}
      />
      <ExportWizard open={showWizard} transactions={wizardTxs} onClose={() => setShowWizard(false)} onExport={handleWizardExport} />
      <FormatCheatSheet open={showSheet} onClose={() => setShowSheet(false)} />
    </div>
  );
}
