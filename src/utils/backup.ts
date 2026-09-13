export const BACKUP_KEY = 'expend_last_backup';
export const BACKUP_DUE_DAYS = 30;
const DAY_MS = 86_400_000;

export function daysSince(lastISO: string | null, now = Date.now()): number | null {
  if (!lastISO) return null;
  const t = Date.parse(lastISO);
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / DAY_MS);
}

export function isBackupDue(txCount: number, lastISO: string | null, now = Date.now()): boolean {
  if (txCount === 0) return false;
  const d = daysSince(lastISO, now);
  return d === null || d >= BACKUP_DUE_DAYS;
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
