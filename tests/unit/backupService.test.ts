/**
 * Unit tests for backupService
 *
 * Tests cover:
 * - Backup metadata CRUD
 * - Change counter increment
 * - Backup reminder evaluation rules
 * - Data snapshot creation and restore
 * - Backup status info
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../src/db/db';
import {
  getBackupMetadata,
  incrementChangeCount,
  getChangeCount,
  recordSuccessfulBackup,
  dismissBackupReminder,
  suppressBackupReminders,
  evaluateBackupReminder,
  getBackupStatusInfo,
  createDataSnapshot,
  restoreFromSnapshot,
  BACKUP_FORMAT_VERSION,
} from '../../src/services/backupService';

// ── Setup ──────────────────────────────────────────────────────

beforeEach(async () => {
  // Clear all data and add defaults
  await db.wallets.clear();
  await db.transactions.clear();
  await db.categories.clear();
  await db.debts.clear();
  await db.debtPayments.clear();
  await db.merchants.clear();
  await db.settings.clear();
});

// ── Backup Metadata ────────────────────────────────────────────

describe('backup metadata', () => {
  it('returns default metadata when no backup has been made', async () => {
    const metadata = await getBackupMetadata();
    expect(metadata.lastBackupAt).toBeNull();
    expect(metadata.lastBackupVersion).toBeNull();
    expect(metadata.changesSinceBackup).toBe(0);
    expect(metadata.totalChangesRecorded).toBe(0);
    expect(metadata.remindersPermanentlySuppressed).toBe(false);
  });

  it('persists and retrieves metadata across read/write cycles', async () => {
    await recordSuccessfulBackup('1.0');
    const metadata = await getBackupMetadata();
    expect(metadata.lastBackupAt).not.toBeNull();
    expect(metadata.lastBackupVersion).toBe('1.0');
    expect(metadata.changesSinceBackup).toBe(0);
  });
});

// ── Change Counter ─────────────────────────────────────────────

describe('change counter', () => {
  it('starts at zero', async () => {
    const count = await getChangeCount();
    expect(count).toBe(0);
  });

  it('increments by 1 by default', async () => {
    await incrementChangeCount();
    const count = await getChangeCount();
    expect(count).toBe(1);
  });

  it('increments by custom count', async () => {
    await incrementChangeCount(5);
    const count = await getChangeCount();
    expect(count).toBe(5);
  });

  it('accumulates multiple increments', async () => {
    await incrementChangeCount(3);
    await incrementChangeCount(7);
    const count = await getChangeCount();
    expect(count).toBe(10);
  });

  it('resets change count after successful backup', async () => {
    await incrementChangeCount(15);
    await recordSuccessfulBackup();
    const count = await getChangeCount();
    expect(count).toBe(0);
  });

  it('tracks total changes recorded', async () => {
    await incrementChangeCount(10);
    await recordSuccessfulBackup();
    await incrementChangeCount(5);
    const metadata = await getBackupMetadata();
    expect(metadata.totalChangesRecorded).toBe(15);
    expect(metadata.changesSinceBackup).toBe(5);
  });
});

// ── Reminder Management ────────────────────────────────────────

describe('reminder management', () => {
  it('dismisses reminder and sets cooldown', async () => {
    await dismissBackupReminder(7);
    const metadata = await getBackupMetadata();
    expect(metadata.reminderDismissedAt).not.toBeNull();
    expect(metadata.nextReminderEligibleAt).not.toBeNull();
  });

  it('permanently suppresses reminders', async () => {
    await suppressBackupReminders();
    const metadata = await getBackupMetadata();
    expect(metadata.remindersPermanentlySuppressed).toBe(true);
    expect(metadata.nextReminderEligibleAt).toBeNull();
  });
});

// ── Reminder Evaluation ────────────────────────────────────────

describe('reminder evaluation', () => {
  it('recommends backup when never backed up and has 10+ transactions', async () => {
    const result = await evaluateBackupReminder(10);
    expect(result.recommended).toBe(true);
    expect(result.priority).toBe('recommended');
  });

  it('recommends critical backup when never backed up and has 20+ transactions', async () => {
    const result = await evaluateBackupReminder(25);
    expect(result.recommended).toBe(true);
    expect(result.priority).toBe('critical');
  });

  it('does not recommend backup when too few transactions exist', async () => {
    const result = await evaluateBackupReminder(3);
    expect(result.recommended).toBe(false);
    expect(result.priority).toBe('healthy');
  });

  it('recommends backup when changes exceed 50', async () => {
    await recordSuccessfulBackup();
    await incrementChangeCount(50);
    const result = await evaluateBackupReminder(100);
    expect(result.recommended).toBe(true);
    expect(result.priority).toBe('recommended');
  });

  it('recommends critical backup when changes exceed 100', async () => {
    await recordSuccessfulBackup();
    await incrementChangeCount(100);
    const result = await evaluateBackupReminder(100);
    expect(result.recommended).toBe(true);
    expect(result.priority).toBe('critical');
  });

  it('does not recommend when reminders are permanently suppressed', async () => {
    await suppressBackupReminders();
    await recordSuccessfulBackup();
    await incrementChangeCount(100);
    const result = await evaluateBackupReminder(100);
    expect(result.recommended).toBe(false);
  });

  it('does not recommend during cooldown period', async () => {
    await recordSuccessfulBackup();
    await dismissBackupReminder(7);
    const result = await evaluateBackupReminder(100);
    expect(result.recommended).toBe(false);
  });

  it('returns healthy status when no backup is needed', async () => {
    await recordSuccessfulBackup();
    const result = await evaluateBackupReminder(5);
    expect(result.recommended).toBe(false);
    expect(result.priority).toBe('healthy');
    expect(result.reasonKey).toBe('backup.healthy');
  });
});

// ── Backup Status Info ─────────────────────────────────────────

describe('backup status info', () => {
  it('returns never status when no backup exists', async () => {
    const info = await getBackupStatusInfo();
    expect(info.status).toBe('never');
    expect(info.lastBackupAt).toBeNull();
    expect(info.daysSinceBackup).toBeNull();
  });

  it('returns recent status after a backup with few changes', async () => {
    await recordSuccessfulBackup();
    const info = await getBackupStatusInfo();
    expect(info.status).toBe('recent');
    expect(info.lastBackupAt).not.toBeNull();
    expect(info.daysSinceBackup).toBe(0);
    expect(info.changesSinceBackup).toBe(0);
  });

  it('returns changes status when 50+ changes since backup', async () => {
    await recordSuccessfulBackup();
    await incrementChangeCount(55);
    const info = await getBackupStatusInfo();
    expect(info.status).toBe('changes');
  });

  it('returns many_changes status when 100+ changes since backup', async () => {
    await recordSuccessfulBackup();
    await incrementChangeCount(120);
    const info = await getBackupStatusInfo();
    expect(info.status).toBe('many_changes');
  });
});

// ── Data Snapshot ──────────────────────────────────────────────

describe('data snapshot', () => {
  it('creates a snapshot containing all data stores', async () => {
    // Add some test data
    await db.wallets.add({ name: 'Test Wallet', currency: 'IDR', initialBalance: 100000, currentBalance: 100000, lastUpdated: new Date().toISOString() });
    await db.categories.add({ name: 'Food', icon: '🍕', color: '#EF4444' });
    await db.transactions.add({
      walletId: 1,
      categoryId: 1,
      date: '2026-07-01',
      description: 'Test Transaction',
      type: 'expense',
      amount: 50000,
    });

    const snapshot = await createDataSnapshot();
    expect(snapshot).toBeTruthy();
    expect(typeof snapshot).toBe('string');

    const parsed = JSON.parse(snapshot);
    expect(parsed.wallets).toHaveLength(1);
    expect(parsed.transactions).toHaveLength(1);
    expect(parsed.categories).toHaveLength(1);
    expect(parsed.snapshotTakenAt).toBeTruthy();
  });

  it('creates a snapshot with empty stores when no data exists', async () => {
    const snapshot = await createDataSnapshot();
    const parsed = JSON.parse(snapshot);
    expect(parsed.wallets).toHaveLength(0);
    expect(parsed.transactions).toHaveLength(0);
    expect(parsed.categories).toHaveLength(0);
    expect(parsed.debts).toHaveLength(0);
  });

  it('restores from a snapshot correctly', async () => {
    // Create initial data
    await db.wallets.add({ name: 'Test Wallet', currency: 'IDR', initialBalance: 100000, currentBalance: 100000, lastUpdated: new Date().toISOString() });
    await db.transactions.add({
      walletId: 1,
      categoryId: null,
      date: '2026-07-01',
      description: 'Test',
      type: 'expense',
      amount: 50000,
    });

    const snapshot = await createDataSnapshot();

    // Clear data
    await db.wallets.clear();
    await db.transactions.clear();

    // Verify data is gone
    expect(await db.wallets.count()).toBe(0);
    expect(await db.transactions.count()).toBe(0);

    // Restore from snapshot
    await restoreFromSnapshot(snapshot);

    // Verify data is back
    expect(await db.wallets.count()).toBe(1);
    expect(await db.transactions.count()).toBe(1);

    const wallet = await db.wallets.toArray();
    expect(wallet[0]?.name).toBe('Test Wallet');
  });
});

// ── Backup Format Version ──────────────────────────────────────

describe('backup format version', () => {
  it('exports a version constant', () => {
    expect(BACKUP_FORMAT_VERSION).toBe('1.0');
  });

  it('records the correct version on backup', async () => {
    await recordSuccessfulBackup(BACKUP_FORMAT_VERSION);
    const metadata = await getBackupMetadata();
    expect(metadata.lastBackupVersion).toBe('1.0');
  });
});
