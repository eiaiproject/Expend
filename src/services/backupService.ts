/**
 * Centralized backup metadata service.
 *
 * Tracks:
 * - Whether a full backup has ever been completed
 * - Timestamp of the last successful backup
 * - Backup format version
 * - Number of relevant data changes since the last backup
 * - Whether a backup reminder was dismissed or postponed
 * - Next eligible reminder time
 *
 * The change counter is incremented after successful data mutations:
 * - Transaction creation, update, or deletion
 * - Transfer creation, edit, or deletion
 * - Wallet mutation
 * - Category mutation
 * - Debt or receivable mutation
 * - Debt payment
 * - Relevant import
 *
 * It is NOT incremented when an operation rolls back or fails.
 */

import { db } from '../db/db';
import {
  BACKUP_OLD_DAYS,
  BACKUP_CHANGES_THRESHOLD,
  BACKUP_CHANGES_CRITICAL,
  BACKUP_MIN_TX_FOR_PROMPT,
} from '../utils/constants';

// ── Types ──────────────────────────────────────────────────────

export interface BackupMetadata {
  /** ISO timestamp of the last successful full backup, or null if never backed up */
  lastBackupAt: string | null;
  /** Format version string of the last backup (e.g. "1.0") */
  lastBackupVersion: string | null;
  /** Number of relevant data changes since the last backup */
  changesSinceBackup: number;
  /** Cumulative total of relevant changes ever recorded (for milestone-based prompts) */
  totalChangesRecorded: number;
  /** ISO timestamp when the last backup reminder was dismissed, or null */
  reminderDismissedAt: string | null;
  /** ISO timestamp of the next eligible reminder, or null */
  nextReminderEligibleAt: string | null;
  /** Whether the user has permanently suppressed backup reminders */
  remindersPermanentlySuppressed: boolean;
}

// ── Current backup format version ──────────────────────────────

export const BACKUP_FORMAT_VERSION = '1.0';

// ── Settings keys ──────────────────────────────────────────────

const SETTINGS_KEYS = {
  BACKUP_METADATA: 'backup_metadata',
} as const;

// ── Default metadata ───────────────────────────────────────────

function getDefaultMetadata(): BackupMetadata {
  return {
    lastBackupAt: null,
    lastBackupVersion: null,
    changesSinceBackup: 0,
    totalChangesRecorded: 0,
    reminderDismissedAt: null,
    nextReminderEligibleAt: null,
    remindersPermanentlySuppressed: false,
  };
}

// ── Read / Write helpers ───────────────────────────────────────

/**
 * Read the current backup metadata from the settings store.
 * Returns the default metadata if none has been saved yet.
 */
export async function getBackupMetadata(): Promise<BackupMetadata> {
  try {
    const entry = await db.settings.get(SETTINGS_KEYS.BACKUP_METADATA);
    if (entry?.value && typeof entry.value === 'object') {
      return { ...getDefaultMetadata(), ...(entry.value as Partial<BackupMetadata>) };
    }
  } catch {
    // If the database is not available, return defaults
  }
  return getDefaultMetadata();
}

/**
 * Persist backup metadata to the settings store.
 */
async function saveBackupMetadata(metadata: BackupMetadata): Promise<void> {
  await db.settings.put({ key: SETTINGS_KEYS.BACKUP_METADATA, value: metadata });
}

// ── Change counter ─────────────────────────────────────────────

/**
 * Increment the change counter after a successful data mutation.
 *
 * Call this after successful:
 * - Transaction creation, update, or deletion
 * - Transfer creation, edit, or deletion
 * - Wallet mutation
 * - Category mutation
 * - Debt or receivable mutation
 * - Debt payment
 * - Successful import
 *
 * Do NOT call this when an operation rolls back or fails.
 */
export async function incrementChangeCount(count = 1): Promise<void> {
  const metadata = await getBackupMetadata();
  metadata.changesSinceBackup += count;
  metadata.totalChangesRecorded += count;
  await saveBackupMetadata(metadata);
}

/**
 * Read the current change count without modifying it.
 */
export async function getChangeCount(): Promise<number> {
  const metadata = await getBackupMetadata();
  return metadata.changesSinceBackup;
}

/**
 * Reset the change counter (called after a successful backup).
 */
async function resetChangeCount(): Promise<void> {
  const metadata = await getBackupMetadata();
  metadata.changesSinceBackup = 0;
  await saveBackupMetadata(metadata);
}

// ── Record backup ──────────────────────────────────────────────

/**
 * Record a successful backup. Resets the change counter and updates
 * the last backup timestamp.
 */
export async function recordSuccessfulBackup(version = BACKUP_FORMAT_VERSION): Promise<void> {
  const metadata = await getBackupMetadata();
  metadata.lastBackupAt = new Date().toISOString();
  metadata.lastBackupVersion = version;
  metadata.changesSinceBackup = 0;
  // Clear any pending reminder after a successful backup
  metadata.nextReminderEligibleAt = null;
  await saveBackupMetadata(metadata);
}

// ── Reminder management ────────────────────────────────────────

/**
 * Dismiss or postpone the backup reminder.
 *
 * @param postponeDays Number of days to postpone. Default 7.
 */
export async function dismissBackupReminder(postponeDays = 7): Promise<void> {
  const metadata = await getBackupMetadata();
  metadata.reminderDismissedAt = new Date().toISOString();
  metadata.nextReminderEligibleAt = new Date(
    Date.now() + postponeDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  await saveBackupMetadata(metadata);
}

/**
 * Permanently suppress all backup reminders.
 */
export async function suppressBackupReminders(): Promise<void> {
  const metadata = await getBackupMetadata();
  metadata.remindersPermanentlySuppressed = true;
  metadata.nextReminderEligibleAt = null;
  await saveBackupMetadata(metadata);
}

// ── Reminder evaluation ────────────────────────────────────────

export interface BackupRecommendation {
  /** Whether a backup is recommended */
  recommended: boolean;
  /** Priority level: 'critical' | 'recommended' | 'optional' | 'healthy' */
  priority: 'critical' | 'recommended' | 'optional' | 'healthy';
  /** Human-readable reason key for localization */
  reasonKey: string;
  /** Optional interpolation values for the localized string */
  reasonOptions?: Record<string, string | number>;
}

/**
 * Evaluate whether a backup reminder should be shown.
 *
 * Rule set:
 * - At least 10 transactions AND no previous backup → recommended
 * - Last successful backup older than 30 days → recommended
 * - At least 50 changes since the last backup → recommended
 * - Over 100 changes since last backup → critical
 * - Never backed up AND more than 20 transactions → critical
 */
export async function evaluateBackupReminder(txCount?: number): Promise<BackupRecommendation> {
  const metadata = await getBackupMetadata();
  const actualTxCount = txCount ?? (await db.transactions.count());

  // Check if permanently suppressed
  if (metadata.remindersPermanentlySuppressed) {
    return { recommended: false, priority: 'healthy', reasonKey: 'backup.reminderSuppressed' };
  }

  // Check if we're in a cooldown period
  if (metadata.nextReminderEligibleAt) {
    const cooldownEnd = new Date(metadata.nextReminderEligibleAt).getTime();
    if (Date.now() < cooldownEnd) {
      return { recommended: false, priority: 'healthy', reasonKey: 'backup.reminderCooldown' };
    }
  }

  // Never backed up
  if (!metadata.lastBackupAt) {
    if (actualTxCount >= BACKUP_MIN_TX_FOR_PROMPT * 2) {
        return {
          recommended: true,
          priority: 'critical',
          reasonKey: 'backup.neverBackedUpManyTx',
          reasonOptions: { count: actualTxCount },
        };
      }
      if (actualTxCount >= BACKUP_MIN_TX_FOR_PROMPT) {
        return {
          recommended: true,
          priority: 'recommended',
          reasonKey: 'backup.neverBackedUp',
          reasonOptions: { count: actualTxCount },
        };
      }
      return { recommended: false, priority: 'healthy', reasonKey: 'backup.tooEarly' };
    }

  // Changes since last backup
  if (metadata.changesSinceBackup >= BACKUP_CHANGES_THRESHOLD) {
    if (metadata.changesSinceBackup >= BACKUP_CHANGES_CRITICAL) {
      return {
        recommended: true,
        priority: 'critical',
        reasonKey: 'backup.manyChangesCritical',
        reasonOptions: { count: metadata.changesSinceBackup },
      };
    }
    return {
      recommended: true,
      priority: 'recommended',
      reasonKey: 'backup.manyChanges',
      reasonOptions: { count: metadata.changesSinceBackup },
    };
  }

  // Last backup too old
  const lastBackupTime = new Date(metadata.lastBackupAt).getTime();
  const daysSinceBackup = (Date.now() - lastBackupTime) / (1000 * 60 * 60 * 24);
  if (daysSinceBackup > BACKUP_OLD_DAYS) {
    return {
      recommended: true,
      priority: 'recommended',
      reasonKey: 'backup.lastBackupOld',
      reasonOptions: { days: Math.floor(daysSinceBackup) },
    };
  }

  return { recommended: false, priority: 'healthy', reasonKey: 'backup.healthy' };
}

// ── Backup status for UI ───────────────────────────────────────

export type BackupStatusType = 'never' | 'recent' | 'old' | 'changes' | 'many_changes';

export interface BackupStatusInfo {
  /** The status type for UI rendering */
  status: BackupStatusType;
  /** ISO timestamp of the last backup, or null */
  lastBackupAt: string | null;
  /** Days since last backup, or null if never */
  daysSinceBackup: number | null;
  /** Number of changes since last backup */
  changesSinceBackup: number;
  /** Whether the info is loading */
  loading: boolean;
}

/**
 * Get the current backup status info for UI display.
 */
export async function getBackupStatusInfo(): Promise<BackupStatusInfo> {
  const metadata = await getBackupMetadata();

  if (!metadata.lastBackupAt) {
    return {
      status: 'never',
      lastBackupAt: null,
      daysSinceBackup: null,
      changesSinceBackup: metadata.changesSinceBackup,
      loading: false,
    };
  }

  const lastBackupTime = new Date(metadata.lastBackupAt).getTime();
  const daysSinceBackup = Math.floor((Date.now() - lastBackupTime) / (1000 * 60 * 60 * 24));

  if (metadata.changesSinceBackup >= BACKUP_CHANGES_THRESHOLD) {
    return {
      status: metadata.changesSinceBackup >= BACKUP_CHANGES_CRITICAL ? 'many_changes' : 'changes',
      lastBackupAt: metadata.lastBackupAt,
      daysSinceBackup,
      changesSinceBackup: metadata.changesSinceBackup,
      loading: false,
    };
  }

  if (daysSinceBackup > BACKUP_OLD_DAYS) {
    return {
      status: 'old',
      lastBackupAt: metadata.lastBackupAt,
      daysSinceBackup,
      changesSinceBackup: metadata.changesSinceBackup,
      loading: false,
    };
  }

  return {
    status: 'recent',
    lastBackupAt: metadata.lastBackupAt,
    daysSinceBackup,
    changesSinceBackup: metadata.changesSinceBackup,
    loading: false,
  };
}

/**
 * Create a recoverable snapshot of current data before a destructive operation.
 * Returns a JSON string that can be restored later.
 */
export async function createDataSnapshot(): Promise<string> {
  const wallets = await db.wallets.toArray();
  const transactions = await db.transactions.toArray();
  const categories = await db.categories.toArray();
  const debts = await db.debts.toArray();
  const debtPayments = await db.debtPayments.toArray();
  const merchants = await db.merchants.toArray();
  const settings = await db.settings.toArray();

  return JSON.stringify({
    wallets: wallets,
    transactions: transactions,
    categories: categories,
    debts: debts,
    debtPayments: debtPayments,
    merchants: merchants,
    settings: settings,
    snapshotTakenAt: new Date().toISOString(),
  });
}

/**
 * Restore data from a previously created snapshot.
 * Used for rollback after a failed restore or destructive operation.
 */
export async function restoreFromSnapshot(snapshotJson: string): Promise<void> {
  const data = JSON.parse(snapshotJson) as {
    wallets: any[];
    transactions: any[];
    categories: any[];
    debts: any[];
    debtPayments: any[];
    merchants: any[];
    settings: any[];
  };

  await db.transaction(
    'rw',
    [
      db.wallets,
      db.transactions,
      db.categories,
      db.debts,
      db.debtPayments,
      db.merchants,
      db.settings,
    ],
    async () => {
      // Clear all data first
      await db.wallets.clear();
      await db.transactions.clear();
      await db.categories.clear();
      await db.debts.clear();
      await db.debtPayments.clear();
      await db.merchants.clear();
      await db.settings.clear();

      // Restore from snapshot using bulkPut to preserve original IDs
      // bulkPut is safer than bulkAdd for auto-increment tables because it
      // explicitly sets the primary key regardless of the auto-increment counter.
      if (data.wallets.length > 0) await db.wallets.bulkPut(data.wallets as any);
      if (data.transactions.length > 0) await db.transactions.bulkPut(data.transactions as any);
      if (data.categories.length > 0) await db.categories.bulkPut(data.categories as any);
      if (data.debts.length > 0) await db.debts.bulkPut(data.debts as any);
      if (data.debtPayments.length > 0) await db.debtPayments.bulkPut(data.debtPayments as any);
      if (data.merchants.length > 0) await db.merchants.bulkPut(data.merchants as any);
      if (data.settings.length > 0) await db.settings.bulkPut(data.settings as any);
    },
  );
}
