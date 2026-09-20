const BACKUP_KEY = 'expend_last_backup';
const BACKUP_DUE_DAYS = 30;
const BACKUP_INTERVAL_KEY = 'expend_backup_interval';
export type BackupInterval = 'off' | 'weekly' | 'monthly';
const DAY_MS = 86_400_000;

export function getBackupInterval(): BackupInterval {
  try {
    const v = localStorage.getItem(BACKUP_INTERVAL_KEY);
    if (v === 'weekly' || v === 'monthly' || v === 'off') return v;
  } catch {}
  return 'weekly';
}

export function setBackupInterval(v: BackupInterval): void {
  try {
    localStorage.setItem(BACKUP_INTERVAL_KEY, v);
  } catch {}
}

export function intervalDueDays(v: BackupInterval): number | null {
  if (v === 'off') return null;
  if (v === 'weekly') return 7;
  return 30;
}

export function daysSince(lastISO: string | null, now = Date.now()): number | null {
  if (!lastISO) return null;
  const t = Date.parse(lastISO);
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / DAY_MS);
}

export function isBackupDue(txCount: number, lastISO: string | null, now = Date.now(), dueDays = BACKUP_DUE_DAYS): boolean {
  if (txCount === 0) return false;
  const d = daysSince(lastISO, now);
  return d === null || d >= dueDays;
}

/** Varian interval-aware untuk banner/pengaturan (off = tidak pernah due). */
export function isBackupDueWithInterval(
  txCount: number,
  lastISO: string | null,
  interval: BackupInterval,
  now = Date.now(),
): boolean {
  const days = intervalDueDays(interval);
  if (days === null) return false;
  return isBackupDue(txCount, lastISO, now, days);
}

export function readLastBackup(): string | null {
  try {
    return localStorage.getItem(BACKUP_KEY);
  } catch {
    return null;
  }
}

export function recordBackup(now = new Date()): string {
  const iso = now.toISOString();
  try {
    localStorage.setItem(BACKUP_KEY, iso);
  } catch {}
  return iso;
}
