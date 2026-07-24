import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../db/db';
import { useSecurity } from '../contexts/SecurityContext';
import {
  Moon, Sun, Monitor, Download, Upload, Lock, Trash2, Check,
  Information, Tag, ShoppingBag, Database, HardDrive,
  Link as ExternalLinkIcon, ChevronRight, Eye, EyeOff, Mobile,
  Clock, AlertTriangle
} from 'reicon-react';
import { useTheme } from '../contexts/ThemeContext';
import { usePrivacy } from '../contexts/PrivacyContext';
import { Link } from 'react-router-dom';
import { toast } from '../components/Toaster';
import { confirm } from '../components/ConfirmDialog';
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
  importCsvTransactions
} from '../services/csvService';
import { MAX_IMPORT_FILE_SIZE, STORAGE_KEYS, APP_VERSION, AUTO_LOCK_TIMEOUT_OPTIONS } from '../utils/constants';
import { downloadBlob } from '../utils/downloadUtils';
import { useInstallPrompt, useIsStandalone } from '../utils/pwaUtils';
import { getTodayStr } from '../utils/dateUtils';

// Settings sub-components
import { SettingsAccordion } from '../components/settings/SettingsAccordion';
import { VerifyCurrentPinModal } from '../components/settings/VerifyCurrentPinModal';
import { PinSetupModal } from '../components/settings/PinSetupModal';

// ── Constants ──────────────────────────────────────────────────

const SOURCE_CODE_URL = 'https://github.com/expend/expend-app';
const TRAKTEER_URL = 'https://trakteer.id/eiaiproject';

const BACKUP_REMINDER_DAYS = 7;

// ── Helper components ──────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider px-1 pt-2 pb-1">{children}</h2>;
}

function NavRow({ icon: Icon, label, description, to, onClick, danger, badge }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  description?: string;
  to?: string;
  onClick?: () => void;
  danger?: boolean;
  badge?: React.ReactNode;
}) {
  const content = (
    <div className={`flex items-center gap-3 p-4 min-h-[56px] transition-colors ${danger ? 'text-red-500' : 'hover:bg-[var(--bg)]'}`}>
      <Icon size={20} className="shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium ${danger ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>{label}</span>
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

// ── Backup Reminder Hook ───────────────────────────────────────

function useBackupReminder() {
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  useEffect(() => {
    db.settings.get('lastBackupAt').then(setting => {
      if (setting?.value && typeof setting.value === 'string') {
        setLastBackup(setting.value);
      }
    }).catch(() => {});
  }, []);

  const needsBackup = useMemo(() => {
    if (!lastBackup) return true;
    const daysSince = (Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > BACKUP_REMINDER_DAYS;
  }, [lastBackup]);

  const markBackupDone = async () => {
    await db.settings.put({ key: 'lastBackupAt', value: new Date().toISOString() });
    setLastBackup(new Date().toISOString());
  };

  return { lastBackup, needsBackup, markBackupDone };
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

function CsvPreviewModal({ isOpen, onClose, rows, errors, onConfirm }: {
  isOpen: boolean;
  onClose: () => void;
  rows: CsvPreviewRow[];
  errors: string[];
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const previewRows = rows.slice(0, 8);

  return (
    <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={t('settings.csvPreviewTitle')}>
      <div className="bg-[var(--card)] rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-bold">{t('settings.csvPreviewTitle')}</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {t('settings.csvPreviewCount', { total: rows.length, preview: previewRows.length })}
          </p>
        </div>

        {errors.length > 0 && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
            <p className="text-sm font-medium text-red-700 dark:text-red-300">{t('settings.csvPreviewErrors', { count: errors.length })}</p>
            <ul className="mt-1 text-xs text-red-600 dark:text-red-400 space-y-0.5">
              {errors.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
              {errors.length > 5 && <li>...{errors.length - 5} more</li>}
            </ul>
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
                <tr key={i} className="border-b border-[var(--border)]">
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
            disabled={errors.length > 0}
            className="flex-1 h-11 rounded-xl bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('settings.csvPreviewImport', { count: rows.length })}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Restore Preview Modal ──────────────────────────────────────

function RestorePreviewModal({ isOpen, onClose, data, onConfirm }: {
  isOpen: boolean;
  onClose: () => void;
  data: { wallets: any[]; transactions: any[]; categories: any[]; debts: any[]; payments: any[]; exportedAt: string; version: string } | null;
  onConfirm: () => void;
}) {
  const { t, i18n } = useTranslation();
  if (!isOpen || !data) return null;

  const walletNames = data.wallets.map((w: any) => w.name).join(', ') || '—';

  return (
    <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={t('settings.restorePreviewTitle')}>
      <div className="bg-[var(--card)] rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={20} className="text-amber-500" aria-hidden="true" />
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
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────

export default function SettingsView() {
  const { t, i18n } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);
  const [pendingAction, setPendingAction] = useState<'changePin' | 'disableSecurity' | null>(null);

  // CSV Preview state
  const [csvPreview, setCsvPreview] = useState<{ rows: CsvPreviewRow[]; errors: string[] } | null>(null);

  // Restore Preview state
  const [restoreData, setRestoreData] = useState<{ wallets: any[]; transactions: any[]; categories: any[]; debts: any[]; payments: any[]; exportedAt: string; version: string } | null>(null);

  const {
    securityEnabled,
    isSecurityLoaded,
    autoLockTimeout,
    setupPin,
    disableSecurity,
    lock,
    updateAutoLockTimeout,
    checkSecurityAvailable
  } = useSecurity();

  const { pin: pinAvailable } = checkSecurityAvailable();
  const { theme, setTheme } = useTheme();
  const { hideAmount, toggleHideAmount } = usePrivacy();
  const { deferredPrompt, showInstallPrompt } = useInstallPrompt();
  const isStandalone = useIsStandalone();
  const storageEstimate = useStorageEstimate();
  const { lastBackup, needsBackup, markBackupDone } = useBackupReminder();

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

      // Show preview modal
      setCsvPreview({ rows, errors });
    } catch {
      toast.add(t('Import Error'));
    } finally {
      e.target.value = '';
    }
  };

  const handleCsvConfirmImport = async () => {
    if (!csvPreview) return;
    try {
      await importCsvTransactions(csvPreview.rows);
      toast.add(t('settings.importCsvSuccess', { count: csvPreview.rows.length }));
      setCsvPreview(null);
      window.setTimeout(() => window.location.reload(), 600);
    } catch {
      toast.add(t('Import Error'));
      setCsvPreview(null);
    }
  };

  // ── JSON Backup Export ────────────────────────────────────

  const handleExportJSON = async () => {
    const data = await generateExport();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `expend-backup-${getTodayStr()}T${new Date().toTimeString().slice(0, 8).replace(/:/g, '-')}.json`);
    await markBackupDone();
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
      window.setTimeout(() => window.location.reload(), 600);
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
      downloadBlob(blob, `expend-backup-${getTodayStr()}T${new Date().toTimeString().slice(0, 8).replace(/:/g, '-')}.json`);
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

    await db.transaction('rw', [db.transactions, db.categories, db.wallets, db.debts, db.debtPayments, db.settings], async () => {
      await db.transactions.clear();
      await db.categories.clear();
      await db.wallets.clear();
      await db.debts.clear();
      await db.debtPayments.clear();
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
      <h1 className="text-2xl font-bold">{t('Settings')}</h1>

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
          {needsBackup && (
            <div className="mx-4 mt-3 mb-1 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">{t('settings.backupReminder')}</p>
              </div>
            </div>
          )}
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

      {/* Delete All Data */}
      <NavRow
        icon={Trash2}
        label={t('settings.deleteAllLocalData')}
        description={t('settings.deleteAllDesc')}
        onClick={handleResetLocalData}
        danger
      />

      {/* ── MANAGEMENT ──────────────────────────────────── */}
      <SectionHeading>{t('settings.sectionManagement')}</SectionHeading>

      <NavRow
        icon={Tag}
        label={t('settings.categoriesBudgets')}
        description={t('settings.categoriesBudgetsDesc')}
        to="/categories"
      />

      <NavRow
        icon={ShoppingBag}
        label={t('settings.recipientsMerchants')}
        description={t('settings.recipientsMerchantsDesc')}
        to="/payees"
      />

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
                    <><Check size={12} className="text-green-500" aria-hidden="true" /> {t('settings.pinStatusActive')}</>
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
              className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-colors min-h-[44px]"
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




        {/* PWA Install Status */}
        {isStandalone ? (
          <div className="flex items-center gap-3 p-4 border-t border-[var(--border)] min-h-[44px]">
            <Check size={18} className="text-green-500" aria-hidden="true" />
            <span className="text-sm font-medium text-[var(--text-secondary)]">{t('settings.pwaInstalled')}</span>
          </div>
        ) : deferredPrompt ? (
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
        ) : null}

        {/* Support Developer */}
        <a
          href={TRAKTEER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-3 p-4 border-t border-[var(--border)] text-left hover:bg-[var(--bg)] transition-colors min-h-[44px]"
        >
          <HardDrive size={18} className="text-[var(--text-secondary)]" aria-hidden="true" />
          <span className="text-sm font-medium text-[var(--text-primary)] flex-1">{t('settings.supportOnTrakteer')}</span>
          <ExternalLinkIcon size={12} className="text-[var(--text-secondary)]" aria-hidden="true" />
        </a>
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
        onConfirm={handleCsvConfirmImport}
      />

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
