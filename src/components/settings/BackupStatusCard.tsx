/**
 * BackupStatusCard — Displays the current backup state and actionable steps.
 *
 * States:
 * - never: Never backed up, primary CTA to back up now
 * - recent: Backed up recently, secondary info
 * - old: Last backup is old, recommend backup
 * - changes: Many changes since last backup
 * - many_changes: Critical number of changes since last backup
 */

import { useTranslation } from 'react-i18next';
import { Download, Upload, AlertTriangle, CheckCircle, Clock, Database } from 'reicon-react';
import type { BackupStatusType } from '../../services/backupService';

export interface BackupStatusCardProps {
  /** The current backup status type */
  status: BackupStatusType;
  /** ISO timestamp of the last backup, or null */
  lastBackupAt: string | null;
  /** Days since last backup, or null if never */
  daysSinceBackup: number | null;
  /** Number of changes since last backup */
  changesSinceBackup: number;
  /** Whether data is loading */
  loading: boolean;
  /** Callback when "Back Up Now" is clicked */
  onBackupNow: () => void;
  /** Callback when "Restore Backup" is clicked */
  onRestore: () => void;
  /** Callback when "Import/Export" is clicked */
  onImportExport: () => void;
}

export function BackupStatusCard({
  status,
  lastBackupAt,
  daysSinceBackup,
  changesSinceBackup,
  loading,
  onBackupNow,
  onRestore,
  onImportExport,
}: BackupStatusCardProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 animate-pulse">
        <div className="h-4 w-32 bg-[var(--border)] rounded mb-3" />
        <div className="h-3 w-48 bg-[var(--border)] rounded mb-2" />
        <div className="h-3 w-36 bg-[var(--border)] rounded" />
      </div>
    );
  }

  const statusConfig = getStatusConfig(status, t);

  return (
    <div
      className={`rounded-xl border p-4 ${
        status === 'never' || status === 'many_changes'
          ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20'
          : status === 'old' || status === 'changes'
            ? 'border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20'
            : 'border-[var(--border)] bg-[var(--card)]'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`rounded-lg p-2 ${
              status === 'never' || status === 'many_changes'
                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                : status === 'old' || status === 'changes'
                  ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400'
                  : status === 'recent'
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                    : 'bg-[var(--accent)]/10 text-[var(--accent)]'
            }`}
          >
            {status === 'recent' ? (
              <CheckCircle size={18} aria-hidden="true" />
            ) : status === 'never' ? (
              <AlertTriangle size={18} aria-hidden="true" />
            ) : (
              <Clock size={18} aria-hidden="true" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              {statusConfig.title}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {statusConfig.description}
            </p>
          </div>
        </div>

        {/* Status badge */}
        <span
          className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${
            status === 'recent'
              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
              : status === 'never' || status === 'many_changes'
                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
          }`}
        >
          {statusConfig.badge}
        </span>
      </div>

      {/* Details */}
      {status !== 'never' && lastBackupAt && (
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] mb-3">
          <Database size={12} aria-hidden="true" />
          <span>
            {t('backup.lastBackupAt', { date: new Date(lastBackupAt).toLocaleDateString() })}
          </span>
          {changesSinceBackup > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                {t('backup.changesSinceBackup', { count: changesSinceBackup })}
              </span>
            </>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onBackupNow}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[var(--accent-fill)] text-[var(--accent-ink)] text-xs font-semibold hover:opacity-90 transition-opacity active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 min-h-[44px]"
        >
          <Download size={14} aria-hidden="true" />
          {t('backup.backupNow')}
        </button>
        <button
          type="button"
          onClick={onRestore}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[var(--border)] text-[var(--text-primary)] text-xs font-semibold hover:bg-[var(--bg)] transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 min-h-[44px]"
        >
          <Upload size={14} aria-hidden="true" />
          {t('backup.restoreBackup')}
        </button>
        <button
          type="button"
          onClick={onImportExport}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] text-xs font-medium hover:bg-[var(--bg)] transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 min-h-[44px]"
        >
          {t('backup.importExport')}
        </button>
      </div>
    </div>
  );
}

// ── Status configuration ───────────────────────────────────────

interface StatusConfig {
  title: string;
  description: string;
  badge: string;
}

function getStatusConfig(status: BackupStatusType, t: (key: string, opts?: any) => string): StatusConfig {
  switch (status) {
    case 'never':
      return {
        title: t('backup.statusNeverTitle'),
        description: t('backup.statusNeverDesc'),
        badge: t('backup.statusNeverBadge'),
      };
    case 'recent':
      return {
        title: t('backup.statusRecentTitle'),
        description: t('backup.statusRecentDesc'),
        badge: t('backup.statusRecentBadge'),
      };
    case 'old':
      return {
        title: t('backup.statusOldTitle'),
        description: t('backup.statusOldDesc'),
        badge: t('backup.statusOldBadge'),
      };
    case 'changes':
      return {
        title: t('backup.statusChangesTitle'),
        description: t('backup.statusChangesDesc'),
        badge: t('backup.statusChangesBadge'),
      };
    case 'many_changes':
      return {
        title: t('backup.statusManyChangesTitle'),
        description: t('backup.statusManyChangesDesc'),
        badge: t('backup.statusManyChangesBadge'),
      };
    default:
      return {
        title: t('backup.statusRecentTitle'),
        description: t('backup.statusRecentDesc'),
        badge: t('backup.statusRecentBadge'),
      };
  }
}
