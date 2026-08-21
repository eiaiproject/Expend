import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useSecurity } from '../contexts/SecurityContext';  import {
    Moon, Sun, Monitor, Download, Upload, Lock, Trash2, Check,
    Information, Database, HardDrive,
    Link as ExternalLinkIcon, ChevronRight, Eye, EyeOff, Mobile,
    Clock, AlertTriangle, Coffee, Heart, ShieldCheck, Bug, Wallet as WalletIcon,
    Tag
  } from 'reicon-react';
import { useTheme } from '../contexts/ThemeContext';
import { usePrivacy } from '../contexts/PrivacyContext';
import { Link } from 'react-router-dom';
import { toast } from '../components/Toaster';
import { confirm } from '../components/ConfirmDialog';
import { getConfiguredDefaultWalletId, setDefaultWallet, clearDefaultWallet } from '../services/walletPreferenceService';
import {
  generateExport,
  importData,
  validateImportData,
} from '../services/importExportService';
import {
  exportTransactionsCsv,
  exportDebtsCsv,
  exportDebtPaymentsCsv,
  parseTransactionsCsv,
  importCsvTransactions,
  detectDuplicateRows,
  downloadCsvErrorReport,
  type CsvImportReport,
} from '../services/csvService';
import { MAX_IMPORT_FILE_SIZE, STORAGE_KEYS, APP_VERSION, AUTO_LOCK_TIMEOUT_OPTIONS, BACKUP_FORMAT_VERSION } from '../utils/constants';

/** master.md 11: imports above this size snapshot the DB first. */
const CSV_SNAPSHOT_THRESHOLD = 20;
import { downloadBlob } from '../utils/downloadUtils';
import { useInstallPrompt, useIsStandalone } from '../utils/pwaUtils';
import { getTodayStr } from '../utils/dateUtils';

// Settings sub-components
import { SettingsAccordion } from '../components/settings/SettingsAccordion';
import { VerifyCurrentPinModal } from '../components/settings/VerifyCurrentPinModal';
import { PinSetupModal } from '../components/settings/PinSetupModal';
import { BackupStatusCard } from '../components/settings/BackupStatusCard';
import { SupportCard } from '../components/settings/SupportCard';
import { PageHeader } from '../components/PageHeader';
import {
  getBackupStatusInfo,
  recordSuccessfulBackup,
} from '../services/backupService';
import {
  TRAKTEER_URL,
  SOURCE_CODE_URL,
  ISSUES_URL,
  recordSupportMilestone,
} from '../services/supportService';

// ── Helper components ──────────────────────────────────────────

function SectionHeading({ children }: { readonly children: React.ReactNode }) {
  return <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider px-1 pt-2 pb-1">{children}</h2>;
}

function NavRow({ icon: Icon, label, description, to, onClick, danger, badge }: {
  readonly icon: React.ComponentType<{ size?: number; className?: string }>;
  readonly label: string;
  readonly description?: string;
  readonly to?: string;
  readonly onClick?: () => void;
  readonly danger?: boolean;
  readonly badge?: React.ReactNode;
}) {
  const content = (
    <div className={`flex items-center gap-3 p-4 min-h-[56px] transition-colors ${danger ? 'text-[var(--danger)]' : 'hover:bg-[var(--bg)]'}`}>
      <Icon size={20} className="shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium ${danger ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'}`}>{label}</span>
        {description && <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">{description}</p>}
      </div>
      {badge}
      {!danger && !onClick && <ChevronRight size={16} className="text-[var(--text-secondary)] shrink-0" aria-hidden="true" />}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block border-b border-[var(--border)] last:border-b-0 min-h-[44px]">
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left border-b border-[var(--border)] last:border-b-0 min-h-[44px]">
        {content}
      </button>
    );
  }

  return <div className="border-b border-[var(--border)] last:border-b-0">{content}</div>;
}

// ── Storage Estimate Hook ──────────────────────────────────────

function useStorageEstimate() {
  const [estimate, setEstimate] = useState<{ used: number; quota: number } | null>(null);

  useEffect(() => {
    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then(est => {
        setEstimate({ used: est.usage ?? 0, quota: est.quota ?? 0 });
      }).catch(() => {});
    }
  }, []);

  return estimate;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

// ── Backup Status Hook ────────────────────────────────────────

function useBackupStatus() {
  const [backupInfo, setBackupInfo] = useState<{
    status: import('../services/backupService').BackupStatusType;
    lastBackupAt: string | null;
    daysSinceBackup: number | null;
    changesSinceBackup: number;
    loading: boolean;
  }>({ status: 'never', lastBackupAt: null, daysSinceBackup: null, changesSinceBackup: 0, loading: true });

  const refresh = useCallback(async () => {
    const info = await getBackupStatusInfo();
    setBackupInfo({ ...info, loading: false });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createBackup = useCallback(async () => {
    const data = await generateExport();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `expend-backup-${getTodayStr()}T${new Date().toTimeString().slice(0, 8).replaceAll(':', '-')}.json`);
    await recordSuccessfulBackup(BACKUP_FORMAT_VERSION);
    await refresh();
  }, [refresh]);

  return { ...backupInfo, createBackup, refresh };
}

// ── CSV Preview ────────────────────────────────────────────────

interface CsvPreviewRow {
  readonly date: string;
  readonly wallet: string;
  readonly category: string;
  readonly recipient: string;
  readonly amount: string;
  readonly type: string;
}

function CsvPreviewModal({ isOpen, onClose, rows, errors, duplicates, skipDuplicates, onSkipDuplicatesChange, onConfirm }: {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly rows: CsvPreviewRow[];
  readonly errors: string[];
  readonly duplicates: boolean[];
  readonly skipDuplicates: boolean;
  readonly onSkipDuplicatesChange: (value: boolean) => void;
  readonly onConfirm: () => void;
}) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const previewRows = rows.slice(0, 8);
  const duplicateCount = duplicates.filter(Boolean).length;
  const importableCount = skipDuplicates ? rows.length - duplicateCount : rows.length;

  return (
    <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4">
      <dialog
        open
        aria-label={t('settings.csvPreviewTitle')}
        className="bg-[var(--card)] rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl p-0 border-0 backdrop:bg-transparent m-0"
      >
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-bold">{t('settings.csvPreviewTitle')}</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {t('settings.csvPreviewCount', { total: rows.length, preview: previewRows.length })}
          </p>
        </div>

        {errors.length > 0 && (
          <div className="p-4 bg-[var(--danger-bg)] border-b border-[var(--danger)]/20">
            <p className="text-sm font-medium text-[var(--danger)]">{t('settings.csvPreviewErrors', { count: errors.length })}</p>
            <ul className="mt-1 text-xs text-[var(--danger)] space-y-0.5">
              {errors.slice(0, 5).map((err, i) => <li key={err}>{err}</li>)}
              {errors.length > 5 && <li>...{errors.length - 5} more</li>}
            </ul>
          </div>
        )}

        {duplicateCount > 0 && (
          <div className="p-4 border-b border-[var(--border)]">
            <p className="text-sm font-medium">{t('settings.csvDuplicatesFound', { count: duplicateCount })}</p>
            <div className="mt-2 space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="duplicate-behavior"
                  checked={skipDuplicates}
                  onChange={() => onSkipDuplicatesChange(true)}
                  className="accent-[var(--accent)]"
                />
                {t('settings.csvSkipDuplicates')}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="duplicate-behavior"
                  checked={!skipDuplicates}
                  onChange={() => onSkipDuplicatesChange(false)}
                  className="accent-[var(--accent)]"
                />
                {t('settings.csvImportAnyway')}
              </label>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-4">
          <table className="w-full text-xs">
            <caption className="sr-only">{t('settings.csvPreviewTitle')}</caption>
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th scope="col" className="text-left py-2 pr-2 font-bold text-[var(--text-secondary)]">{t('settings.tableDate')}</th>
                <th scope="col" className="text-left py-2 pr-2 font-bold text-[var(--text-secondary)]">{t('settings.tableWallet')}</th>
                <th scope="col" className="text-left py-2 pr-2 font-bold text-[var(--text-secondary)]">{t('settings.tableCategory')}</th>
                <th scope="col" className="text-left py-2 pr-2 font-bold text-[var(--text-secondary)]">{t('settings.tableAmount')}</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => (
                <tr key={`${row.date}-${row.wallet}-${i}`} className="border-b border-[var(--border)]">
                  <td className="py-1.5 pr-2">{row.date}</td>
                  <td className="py-1.5 pr-2">{row.wallet}</td>
                  <td className="py-1.5 pr-2">{row.category || '—'}</td>
                  <td className="py-1.5 pr-2 font-mono">{row.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 8 && (
            <p className="text-xs text-[var(--text-secondary)] mt-2 text-center">...{rows.length - 8} more rows</p>
          )}
        </div>

        <div className="p-4 border-t border-[var(--border)] flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl border border-[var(--border)] font-medium hover:bg-[var(--bg)] transition-colors">
            {t('Cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={errors.length > 0 || rows.length === 0}
            className="flex-1 h-11 rounded-xl bg-[var(--accent-fill)] text-[var(--accent-ink)] font-medium hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importableCount === 0
              ? t('settings.csvImportAnyway')
              : t('settings.csvPreviewImport', { count: importableCount })}
          </button>
        </div>
      </dialog>
    </div>
  );
}

// ── CSV Import Report ────────────────────────────────────────

function CsvImportReportModal({ report, onClose }: {
  readonly report: CsvImportReport | null;
  readonly onClose: () => void;
}) {
  const { t } = useTranslation();
  if (!report) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4">
      <dialog
        open
        aria-label={t('settings.csvReportTitle')}
        className="bg-[var(--card)] rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl p-0 border-0 backdrop:bg-transparent m-0"
      >
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-bold">{t('settings.csvReportTitle')}</h2>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-3 text-sm">
          <p className="font-medium">{t('settings.csvReportImported', { count: report.imported })}</p>
          <p>{t('settings.csvReportSkipped', { count: report.skipped })}</p>
          <p>{t('settings.csvReportFailed', { count: report.failed })}</p>
          {report.errors.length > 0 && (
            <div className="pt-2">
              <ul className="mt-1 text-xs text-[var(--danger)] space-y-0.5 max-h-32 overflow-auto">
                {report.errors.map((err) => <li key={err}>{err}</li>)}
              </ul>
              <button
                type="button"
                onClick={() => downloadCsvErrorReport(report.errors)}
                className="mt-3 h-10 rounded-xl border border-[var(--border)] font-medium px-4 hover:bg-[var(--bg)] transition-colors"
              >
                {t('settings.csvReportDownloadErrors')}
              </button>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-[var(--border)] flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl bg-[var(--accent-fill)] text-[var(--accent-ink)] font-medium hover:opacity-90 transition-colors">
            {t('Done')}
          </button>
        </div>
      </dialog>
    </div>
  );
}

// ── Restore Preview Modal ──────────────────────────────────────

function RestorePreviewModal({ isOpen, onClose, data, onConfirm }: {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly data: { readonly wallets: readonly any[]; readonly transactions: readonly any[]; readonly categories: readonly any[]; readonly debts: readonly any[]; readonly payments: readonly any[]; readonly exportedAt: string; readonly version: string } | null;
  readonly onConfirm: () => void;
}) {
  const { t, i18n } = useTranslation();
  if (!isOpen || !data) return null;

  const walletNames = data.wallets.map((w: any) => w.name).join(', ') || '—';

  return (
    <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4">
      <dialog
        open
        aria-label={t('settings.restorePreviewTitle')}
        className="bg-[var(--card)] rounded-2xl w-full max-w-sm shadow-2xl p-0 border-0 backdrop:bg-transparent m-0"
      >
        <div className="p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={20} className="text-[var(--warning)]" aria-hidden="true" />
            <h2 className="text-lg font-bold">{t('settings.restorePreviewTitle')}</h2>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">{t('settings.restoreWarning')}</p>
        </div>

        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-[var(--text-secondary)]">{t('settings.restoreCreated')}</span>
            <span className="font-medium">{data.exportedAt ? new Date(data.exportedAt).toLocaleDateString(i18n.language) : '—'}</span>

            <span className="text-[var(--text-secondary)]">{t('settings.restoreSchema')}</span>
            <span className="font-medium">{data.version}</span>

            <span className="text-[var(--text-secondary)]">{t('settings.restoreWallets')}</span>
            <span className="font-medium">{data.wallets.length}</span>

            <span className="text-[var(--text-secondary)]">{t('settings.restoreTransactions')}</span>
            <span className="font-medium">{data.transactions.length}</span>

            <span className="text-[var(--text-secondary)]">{t('settings.restoreCategories')}</span>
            <span className="font-medium">{data.categories.length}</span>

            <span className="text-[var(--text-secondary)]">{t('settings.restoreDebts')}</span>
            <span className="font-medium">{data.debts.length}</span>

            <span className="text-[var(--text-secondary)]">{t('settings.restorePayments')}</span>
            <span className="font-medium">{data.payments.length}</span>
          </div>

          {data.wallets.length > 0 && (
            <div className="pt-2 border-t border-[var(--border)]">
              <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">{t('settings.restoreWalletNames')}</p>
              <p className="text-xs text-[var(--text-primary)]">{walletNames}</p>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-[var(--border)] flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full h-11 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors active:scale-95"
          >
            {t('settings.restoreConfirmOverwrite')}
          </button>
          <button type="button" onClick={onClose} className="w-full h-11 rounded-xl border border-[var(--border)] font-medium hover:bg-[var(--bg)] transition-colors">
            {t('Cancel')}
          </button>
        </div>
      </dialog>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────

export default function SettingsView() {
  const { t, i18n } = useTranslation();
  const csvInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);
  const [pendingAction, setPendingAction] = useState<'changePin' | 'disableSecurity' | null>(null);

  // CSV Preview state
  const [csvPreview, setCsvPreview] = useState<{ rows: CsvPreviewRow[]; errors: string[]; duplicates: boolean[] } | null>(null);
  const [csvSkipDuplicates, setCsvSkipDuplicates] = useState(true);
  const [csvResult, setCsvResult] = useState<CsvImportReport | null>(null);

  // Restore Preview state
  const [restoreData, setRestoreData] = useState<{ wallets: any[]; transactions: any[]; categories: any[]; debts: any[]; payments: any[]; exportedAt: string; version: string } | null>(null);

  const {
    securityEnabled,
    isSecurityLoaded,
    autoLockTimeout,
    setupPin,
    disableSecurity,
    updateAutoLockTimeout,
    checkSecurityAvailable
  } = useSecurity();

  const { pin: pinAvailable } = checkSecurityAvailable();
  const { theme, setTheme } = useTheme();
  const { hideAmount, toggleHideAmount } = usePrivacy();
  const { deferredPrompt, showInstallPrompt } = useInstallPrompt();
  const isStandalone = useIsStandalone();
  const storageEstimate = useStorageEstimate();
  const {
    status: backupStatus,
    lastBackupAt,
    daysSinceBackup,
    changesSinceBackup: backupChanges,
    loading: backupLoading,
    createBackup,
  } = useBackupStatus();

  // ── Default wallet preference (master.md 3.15) ────────────

  const configuredDefaultWalletId = useLiveQuery(getConfiguredDefaultWalletId, [], null);
  const allWallets = useLiveQuery(() => db.wallets.toArray(), [], undefined) ?? [];
  const activeWallets = allWallets.filter(w => !w.archivedAt);

  // ── New-category confirmation toggle (friction A4) ────────

  const confirmNewCategorySetting = useLiveQuery(
    () => db.settings.get('confirmNewCategory').then((s) => (s?.value as boolean | undefined) ?? true),
    [], true,
  );

  const toggleConfirmNewCategory = async (v: boolean) => {
    await db.settings.put({ key: 'confirmNewCategory', value: v });
  };

  const handleDefaultWalletChange = async (value: string) => {
    try {
      if (value) {
        await setDefaultWallet(Number(value));
      } else {
        await clearDefaultWallet();
      }
      toast.add(t('settings.defaultWalletSaved'));
    } catch {
      toast.add(t('Error saving category'));
    }
  };

  // ── Language ──────────────────────────────────────────────

  const handleLangChange = async (lang: string) => {
    await i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
    await db.settings.put({ key: 'language', value: lang });
  };

  // ── CSV Export ────────────────────────────────────────────

  const handleExportAllCsv = async () => {
    await Promise.all([
      exportTransactionsCsv(),
      exportDebtsCsv(),
      exportDebtPaymentsCsv(),
    ]);
  };

  // ── CSV Import with Preview ───────────────────────────────

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMPORT_FILE_SIZE) {
      toast.add(t('Import Invalid'));
      e.target.value = '';
      return;
    }

    try {
      const { rows, errors } = await parseTransactionsCsv(file);
      const duplicates = await detectDuplicateRows(rows);

      // Show preview modal
      setCsvPreview({ rows, errors, duplicates });
    } catch {
      toast.add(t('Import Error'));
    } finally {
      e.target.value = '';
    }
  };

  const handleCsvConfirmImport = async () => {
    if (!csvPreview) return;
    try {
      // master.md 11: pre-import snapshot for high-impact imports — the
      // service snapshots the DB and rolls back automatically on failure.
      const report = await importCsvTransactions(csvPreview.rows as unknown as Array<Record<string, unknown>>, {
        skipDuplicates: csvSkipDuplicates,
        preImportSnapshot: csvPreview.rows.length >= CSV_SNAPSHOT_THRESHOLD,
      });
      setCsvResult(report);
      setCsvPreview(null);
      if (report.imported === 0) return; // nothing changed
      toast.add(t('settings.importCsvSuccess', { count: report.imported }));
      // Friction audit A3: no full-page reload — Dexie live queries propagate
      // the imported rows automatically (keeps scroll/state, no flash).
    } catch {
      toast.add(t('Import Error'));
      setCsvPreview(null);
    }
  };

  // ── JSON Backup Export ────────────────────────────────────

  const handleExportJSON = async () => {
    await createBackup();
    toast.add(t('settings.backupCreated'));
  };

  // ── JSON Restore with Preview ─────────────────────────────

  const handleRestoreJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMPORT_FILE_SIZE) {
      toast.add(t('settings.restoreFileTooLarge'));
      e.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      const errors = validateImportData(json);
      if (errors.length > 0) {
        toast.add(t('settings.restoreInvalidFile'));
        e.target.value = '';
        return;
      }

      // Show restore preview modal
      setRestoreData({
        wallets: Array.isArray(json.wallets) ? json.wallets : [],
        transactions: Array.isArray(json.transactions) ? json.transactions : [],
        categories: Array.isArray(json.categories) ? json.categories : [],
        debts: Array.isArray(json.debts) ? json.debts : [],
        payments: Array.isArray(json.debtPayments || json.debt_payments) ? (json.debtPayments || json.debt_payments) : [],
        exportedAt: json.exportedAt || '',
        version: json.version || '',
      });
    } catch {
      toast.add(t('settings.restoreError'));
    } finally {
      e.target.value = '';
    }
  };

  const handleRestoreConfirm = async () => {
    if (!restoreData) return;
    try {
      await importData(restoreData as any);
      toast.add(t('settings.restoreSuccess'));
      setRestoreData(null);
      // Positive moment → contextual support prompt eligibility (9.4).
      // Record AFTER importData since restore replaces the settings store.
      await recordSupportMilestone('restore');
      // Friction audit A3: no full-page reload — Dexie live queries propagate
      // the restored data automatically (keeps scroll/state, no flash).
    } catch {
      toast.add(t('settings.restoreError'));
      setRestoreData(null);
    }
  };

  // ── Reset Data ────────────────────────────────────────────

  const handleResetLocalData = async () => {
    const exportFirst = await confirm({
      title: t('settings.resetTitle'),
      message: t('settings.resetOfferBackup'),
      confirmLabel: t('settings.resetExportFirst'),
      cancelLabel: t('settings.resetSkip'),
      variant: 'default',
    });

    if (exportFirst) {
      const data = await generateExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `expend-backup-${getTodayStr()}T${new Date().toTimeString().slice(0, 8).replaceAll(':', '-')}.json`);
    }

    const deleteLabel = i18n.language?.startsWith('id') ? 'HAPUS' : 'DELETE';
    const confirmed = await confirm({
      title: t('settings.resetConfirmTitle'),
      message: t('settings.resetConfirmMessage'),
      confirmLabel: deleteLabel,
      requireTypedConfirm: deleteLabel,
      variant: 'danger',
    });

    if (!confirmed) return;

    await db.transaction('rw', [db.transactions, db.categories, db.wallets, db.debts, db.debtPayments, db.schedules, db.settings], async () => {
      await db.transactions.clear();
      await db.categories.clear();
      await db.wallets.clear();
      await db.debts.clear();
      await db.debtPayments.clear();
      await db.schedules.clear();
      await db.settings.clear();
    });

    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));

    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    } catch { /* ignore */ }

    toast.add(t('settings.resetSuccess'));
    window.location.reload();
  };

  // ── PIN Actions ───────────────────────────────────────────

  const handleSetupPin = async (pin: string) => {
    await setupPin(pin);
    toast.add(t('settings.pinEnabled'));
  };

  const handleChangePinRequest = () => {
    if (securityEnabled) {
      setPendingAction('changePin');
    } else {
      setShowChangePin(true);
    }
  };

  const handleDisableRequest = () => {
    setPendingAction('disableSecurity');
  };

  const handleVerified = async () => {
    const action = pendingAction;
    setPendingAction(null);

    if (action === 'changePin') {
      setShowChangePin(true);
    } else if (action === 'disableSecurity') {
      const confirmed = await confirm({
        title: t('settings.disablePinTitle'),
        message: t('settings.disablePinMessage'),
        confirmLabel: t('settings.disablePinConfirm'),
        variant: 'danger',
      });
      if (confirmed) {
        await disableSecurity();
        toast.add(t('settings.pinDisabled'));
      }
    }
  };

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader title={t('Settings')} />

      {/* ── BACKUP STATUS ────────────────────────────────── */}
      <SectionHeading>{t('backup.sectionTitle')}</SectionHeading>

      {/* Backup Status Card */}
      <BackupStatusCard
        status={backupStatus}
        lastBackupAt={lastBackupAt}
        daysSinceBackup={daysSinceBackup}
        changesSinceBackup={backupChanges}
        loading={backupLoading}
        onBackupNow={handleExportJSON}
        onRestore={() => restoreInputRef.current?.click()}
        onImportExport={() => csvInputRef.current?.click()}
      />

      {/* Permanent support card — visible without excessive scrolling (9.1) */}
      <SupportCard />

      {/* ── DATA ────────────────────────────────────────── */}
      <SectionHeading>{t('settings.sectionData')}</SectionHeading>

      {/* Local Storage with Estimate */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
        <div className="flex items-start gap-2">
          <Database size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" />
          <div className="space-y-1 flex-1">
            <p className="text-xs font-semibold text-[var(--text-primary)]">{t('settings.localStorageTitle')}</p>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{t('settings.localStorageDesc')}</p>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{t('settings.localStorageTip')}</p>
            {storageEstimate && (
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {t('settings.storageUsed', { used: formatBytes(storageEstimate.used), quota: formatBytes(storageEstimate.quota) })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Backup & Restore */}
      <SettingsAccordion title={t('settings.sectionBackupRestore')}>
        <div className="flex flex-col">
          <div className="p-4 border-b border-[var(--border)]">
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('backup.jsonFormat')}</p>
          </div>
          <NavRow
            icon={Download}
            label={t('settings.exportBackup')}
            description={t('settings.exportBackupDesc')}
            onClick={handleExportJSON}
          />
          <NavRow
            icon={Upload}
            label={t('settings.restoreFromBackup')}
            description={t('settings.restoreFromBackupDesc')}
            onClick={() => restoreInputRef.current?.click()}
          />
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            ref={restoreInputRef}
            onChange={handleRestoreJSON}
          />
        </div>
      </SettingsAccordion>

      {/* Transaction Import & Export */}
      <SettingsAccordion title={t('settings.sectionTxImportExport')}>
        <div className="flex flex-col">
          <div className="p-4 border-b border-[var(--border)]">
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('backup.csvFormat')}</p>
          </div>
          <NavRow
            icon={Download}
            label={t('settings.exportTransactionsCsv')}
            description={t('settings.exportTransactionsCsvDesc')}
            onClick={handleExportAllCsv}
          />
          <NavRow
            icon={Upload}
            label={t('settings.importTransactionsCsv')}
            description={t('settings.importTransactionsCsvDesc')}
            onClick={() => csvInputRef.current?.click()}
          />
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            ref={csvInputRef}
            onChange={handleImportCSV}
          />
        </div>
      </SettingsAccordion>

      {/* ── PREFERENCES ─────────────────────────────────── */}
      <SectionHeading>{t('settings.sectionPreferences')}</SectionHeading>

      {/* Theme — native radio */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
        <fieldset>
          <legend className="text-sm font-medium text-[var(--text-primary)] mb-3">{t('settings.themeLabel')}</legend>
          <div className="space-y-1">
            {([
              { value: 'system' as const, icon: Monitor, label: t('settings.themeSystem') },
              { value: 'light' as const, icon: Sun, label: t('settings.themeLight') },
              { value: 'dark' as const, icon: Moon, label: t('settings.themeDark') },
            ]).map(({ value, icon: Icon, label }) => (
              <label
                key={value}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer min-h-[44px] transition-colors ${
                  theme === value ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'hover:bg-[var(--bg)] text-[var(--text-primary)]'
                }`}
              >
                <input
                  type="radio"
                  name="theme"
                  value={value}
                  checked={theme === value}
                  onChange={() => setTheme(value)}
                  className="sr-only"
                />
                <Icon size={18} className="shrink-0" aria-hidden="true" />
                <span className="text-sm font-medium flex-1">{label}</span>
                {theme === value && <Check size={16} className="text-[var(--accent)]" aria-hidden="true" />}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {/* Language — native radio */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
        <fieldset>
          <legend className="text-sm font-medium text-[var(--text-primary)] mb-3">{t('settings.languageLabel')}</legend>
          <div className="space-y-1">
            {([
              { value: 'id', label: t('settings.langId') },
              { value: 'en', label: t('settings.langEn') },
            ]).map(({ value, label }) => (
              <label
                key={value}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer min-h-[44px] transition-colors ${
                  i18n.language?.startsWith(value) ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'hover:bg-[var(--bg)] text-[var(--text-primary)]'
                }`}
              >
                <input
                  type="radio"
                  name="language"
                  value={value}
                  checked={i18n.language?.startsWith(value) ?? false}
                  onChange={() => handleLangChange(value)}
                  className="sr-only"
                />
                <span className="text-sm font-medium flex-1">{label}</span>
                {i18n.language?.startsWith(value) && <Check size={16} className="text-[var(--accent)]" aria-hidden="true" />}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {/* Hide Amounts — native switch */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
        <label className="flex items-center justify-between gap-4 min-h-[44px] cursor-pointer">
          <div className="flex items-center gap-3">
            {hideAmount ? <EyeOff size={20} className="text-[var(--text-secondary)]" aria-hidden="true" /> : <Eye size={20} className="text-[var(--text-secondary)]" aria-hidden="true" />}
            <div>
              <span className="text-sm font-medium text-[var(--text-primary)]">{t('settings.hideAmountsLabel')}</span>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('settings.hideAmountsDesc')}</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={hideAmount}
            onChange={toggleHideAmount}
            className="sr-only peer"
            aria-label={t('settings.hideAmountsLabel')}
          />
          <div className="w-11 h-6 rounded-full bg-[var(--border)] peer-checked:bg-[var(--accent)] transition-colors relative shrink-0" aria-hidden="true">
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${hideAmount ? 'translate-x-5' : ''}`} />
          </div>
        </label>
      </div>


      {/* Ask before new category — native switch */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
        <label className="flex items-center justify-between gap-4 min-h-[44px] cursor-pointer">
          <div className="flex items-center gap-3">
            <Tag size={20} className="text-[var(--text-secondary)]" aria-hidden="true" />
            <div>
              <span className="text-sm font-medium text-[var(--text-primary)]">{t('settings.confirmNewCategoryLabel')}</span>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('settings.confirmNewCategoryHint')}</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={confirmNewCategorySetting}
            onChange={(e) => void toggleConfirmNewCategory(e.target.checked)}
            className="sr-only peer"
            aria-label={t('settings.confirmNewCategoryLabel')}
          />
          <div className="w-11 h-6 rounded-full bg-[var(--border)] peer-checked:bg-[var(--accent)] transition-colors relative shrink-0" aria-hidden="true">
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${confirmNewCategorySetting ? 'translate-x-5' : ''}`} />
          </div>
        </label>
      </div>

      {/* Default wallet — native select (master.md 3.15) */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
        <div className="flex items-center gap-2 mb-1">
          <WalletIcon size={18} className="text-[var(--text-secondary)]" aria-hidden="true" />
          <legend className="text-sm font-medium text-[var(--text-primary)]">{t('settings.defaultWalletLabel')}</legend>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mb-3">{t('settings.defaultWalletDesc')}</p>
        <select
          id="settings-default-wallet"
          value={configuredDefaultWalletId ?? ''}
          onChange={(e) => void handleDefaultWalletChange(e.target.value)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 min-h-[44px]"
        >
          <option value="">{t('settings.defaultWalletAuto')}</option>
          {activeWallets.map(w => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>
      {/* ── SECURITY ────────────────────────────────────── */}
      <SectionHeading>{t('settings.sectionSecurity')}</SectionHeading>

      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)]">
        {/* PIN Status */}
        <div className="p-4">
          <div className="flex items-center gap-3">
            <Lock size={20} className="shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <span className="text-sm font-medium text-[var(--text-primary)]">{t('settings.pinLockLabel')}</span>
              {isSecurityLoaded && (
                <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1 mt-0.5">
                  {securityEnabled ? (
                    <><Check size={12} className="text-[var(--success)]" aria-hidden="true" /> {t('settings.pinStatusActive')}</>
                  ) : (
                    t('settings.pinStatusInactive')
                  )}
                </p>
              )}
            </div>
          </div>
        </div>

        {!isSecurityLoaded && (
          <div className="px-4 pb-4 space-y-2">
            <div className="h-4 bg-[var(--border)] rounded animate-pulse w-3/4" />
            <div className="h-3 bg-[var(--border)] rounded animate-pulse w-1/2" />
          </div>
        )}

        {isSecurityLoaded && pinAvailable && !securityEnabled && (
          <div className="px-4 pb-4 space-y-3">
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <Information size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">{t('Security Disclosure')}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">{t('Security Disclosure Tip')}</p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPinSetup(true)}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-[var(--accent-fill)] text-[var(--accent-ink)] font-medium hover:opacity-90 transition-colors min-h-[44px]"
            >
              <Lock size={18} aria-hidden="true" />
              {t('Set up PIN')}
            </button>
          </div>
        )}

        {isSecurityLoaded && securityEnabled && (
          <>
            <div className="p-4 border-t border-[var(--border)]">
              <div className="flex items-start gap-2">
                <Information size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{t('settings.pinLimitation')}</p>
              </div>
            </div>

            {/* Auto-lock timeout */}
            <div className="p-4 border-t border-[var(--border)]">
              <fieldset>
                <legend className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] mb-3">
                  <Clock size={16} className="text-[var(--text-secondary)]" aria-hidden="true" />
                  {t('settings.autoLockLabel')}
                </legend>
                <div className="space-y-1">
                  {AUTO_LOCK_TIMEOUT_OPTIONS.map(({ value, labelKey }) => (
                    <label
                      key={value}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer min-h-[44px] transition-colors ${
                        autoLockTimeout === value ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'hover:bg-[var(--bg)] text-[var(--text-primary)]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="autoLock"
                        value={value}
                        checked={autoLockTimeout === value}
                        onChange={() => updateAutoLockTimeout(value)}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium flex-1">{t(labelKey)}</span>
                      {autoLockTimeout === value && <Check size={16} className="text-[var(--accent)]" aria-hidden="true" />}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <button
              type="button"
              onClick={handleChangePinRequest}
              className="w-full flex items-center gap-3 p-4 border-t border-[var(--border)] text-left hover:bg-[var(--bg)] transition-colors min-h-[44px]"
            >
              <Lock size={20} aria-hidden="true" />
              <span className="text-sm font-medium">{t('Change PIN')}</span>
            </button>

            <button
              type="button"
              onClick={handleDisableRequest}
              className="w-full flex items-center gap-3 p-4 border-t border-[var(--border)] text-red-500 text-left hover:bg-[var(--bg)] transition-colors min-h-[44px]"
            >
              <Trash2 size={20} aria-hidden="true" />
              <span className="text-sm font-medium">{t('Disable Security')}</span>
            </button>
          </>
        )}

        {isSecurityLoaded && !securityEnabled && !pinAvailable && (
          <div className="p-4 border-t border-[var(--border)] text-center text-[var(--text-secondary)] text-sm">
            {t('Security not available on this device')}
          </div>
        )}
      </div>

      {/* ── ABOUT ───────────────────────────────────────── */}
      <SectionHeading>{t('settings.sectionAbout')}</SectionHeading>

      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)]">
        <div className="p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center shrink-0" aria-hidden="true">
            <HardDrive size={24} className="text-[var(--accent)]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Expend</h3>
            <p className="text-xs text-[var(--text-secondary)]">{t('settings.versionLabel')}: {APP_VERSION}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('settings.aboutAuthor', { author: 'Anggie Irawan' })}</p>
          </div>
        </div>

        {/* Open-source / no ads / no tracking status (9.2) */}
        <div className="px-4 pb-1 border-t border-[var(--border)] pt-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Heart size={14} className="text-[var(--accent)]" aria-hidden="true" />
            <span>{t('settings.aboutFreeOpenSource')}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <ShieldCheck size={14} className="text-[var(--accent)]" aria-hidden="true" />
            <span>{t('settings.aboutNoAdsNoTracking')}</span>
          </div>
        </div>

        <a
          href={SOURCE_CODE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-3 p-4 border-t border-[var(--border)] text-left hover:bg-[var(--bg)] transition-colors min-h-[44px]"
        >
          <ExternalLinkIcon size={18} className="text-[var(--text-secondary)]" aria-hidden="true" />
          <span className="text-sm font-medium text-[var(--text-primary)] flex-1">{t('settings.viewSourceCode')}</span>
          <ExternalLinkIcon size={12} className="text-[var(--text-secondary)]" aria-hidden="true" />
        </a>

        <a
          href={ISSUES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-3 p-4 border-t border-[var(--border)] text-left hover:bg-[var(--bg)] transition-colors min-h-[44px]"
        >
          <Bug size={18} className="text-[var(--text-secondary)]" aria-hidden="true" />
          <span className="text-sm font-medium text-[var(--text-primary)] flex-1">{t('settings.reportIssue')}</span>
          <ExternalLinkIcon size={12} className="text-[var(--text-secondary)]" aria-hidden="true" />
        </a>

        {/* Support developer — permanent secondary link (master.md 9.2) */}
        <a
          href={TRAKTEER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-3 p-4 border-t border-[var(--border)] text-left hover:bg-[var(--bg)] transition-colors min-h-[44px]"
        >
          <Coffee size={18} className="text-[var(--accent)]" aria-hidden="true" />
          <span className="text-sm font-medium text-[var(--text-primary)] flex-1">{t('settings.aboutSupport')}</span>
          <span className="sr-only">{t('settings.opensExternalSite')}</span>
          <ExternalLinkIcon size={12} className="text-[var(--text-secondary)]" aria-hidden="true" />
        </a>

        {/* PWA Install Status */}
        {(function renderPwaStatus() {
          if (isStandalone) {
            return (
              <div className="flex items-center gap-3 p-4 border-t border-[var(--border)] min-h-[44px]">
                <Check size={18} className="text-green-500" aria-hidden="true" />
                <span className="text-sm font-medium text-[var(--text-secondary)]">{t('settings.pwaInstalled')}</span>
              </div>
            );
          }
          if (deferredPrompt) {
            return (
              <button
                type="button"
                onClick={showInstallPrompt}
                className="w-full flex items-center gap-3 p-4 border-t border-[var(--border)] text-left hover:bg-[var(--bg)] transition-colors min-h-[44px]"
              >
                <Mobile size={18} className="text-[var(--accent)]" aria-hidden="true" />
                <div className="flex-1">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{t('settings.installAppLabel')}</span>
                  <p className="text-xs text-[var(--text-secondary)]">{t('settings.installAppDesc')}</p>
                </div>
              </button>
            );
          }
          return null;
        })()}

        {/* Support Developer — permanent secondary link (9.2) */}
        <a
          href={TRAKTEER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-3 p-4 border-t border-[var(--border)] text-left hover:bg-[var(--bg)] transition-colors min-h-[44px]"
        >
          <Coffee size={18} className="text-[var(--text-secondary)]" aria-hidden="true" />
          <span className="text-sm font-medium text-[var(--text-primary)] flex-1">{t('settings.supportOnTrakteer')}</span>
          <span className="sr-only">{t('settings.opensExternalSite')}</span>
          <ExternalLinkIcon size={12} className="text-[var(--text-secondary)]" aria-hidden="true" />
        </a>
      </div>


      {/* ── DANGER ZONE (master.md 3.15 — visually separated) */}
      <SectionHeading>{t('settings.dangerZone')}</SectionHeading>

      <div className="rounded-[16px] border border-red-500/30 bg-[var(--card)] p-2">
      {/* Delete All Data */}
      <NavRow
        icon={Trash2}
        label={t('settings.deleteAllLocalData')}
        description={t('settings.deleteAllDesc')}
        onClick={handleResetLocalData}
        danger
      />


      </div>

      {/* ── Modals ──────────────────────────────────────── */}
      <PinSetupModal
        isOpen={showPinSetup}
        onClose={() => setShowPinSetup(false)}
        onSuccess={handleSetupPin}
      />

      <VerifyCurrentPinModal
        isOpen={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        onVerified={handleVerified}
      />

      <PinSetupModal
        isOpen={showChangePin}
        onClose={() => setShowChangePin(false)}
        onSuccess={handleSetupPin}
      />

      {/* CSV Preview Modal */}
      <CsvPreviewModal
        isOpen={csvPreview !== null}
        onClose={() => setCsvPreview(null)}
        rows={csvPreview?.rows ?? []}
        errors={csvPreview?.errors ?? []}
        duplicates={csvPreview?.duplicates ?? []}
        skipDuplicates={csvSkipDuplicates}
        onSkipDuplicatesChange={setCsvSkipDuplicates}
        onConfirm={handleCsvConfirmImport}
      />

      {/* CSV Import Report Modal */}
      <CsvImportReportModal report={csvResult} onClose={() => setCsvResult(null)} />

      {/* Restore Preview Modal */}
      <RestorePreviewModal
        isOpen={restoreData !== null}
        onClose={() => setRestoreData(null)}
        data={restoreData}
        onConfirm={handleRestoreConfirm}
      />
    </div>
  );
}
