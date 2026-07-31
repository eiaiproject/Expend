/**
 * Centralized domain constants for the Expend app.
 * All domain constants should live here to avoid duplication across files.
 */

/** Curated color palette for categories. */
export const CURATED_PALETTE = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E', '#06B6D4',
  '#3B82F6', '#A855F7', '#EC4899', '#7C3AED', '#B45309',
  '#0D9488', '#4D7C0F', '#92400E', '#64748B', '#BE123C',
] as const;

/** Default categories shown during onboarding. */
export const DEFAULT_CATEGORIES = [
  { nameKey: 'Default Category Food & Drinks', color: '#EF4444' },
  { nameKey: 'Default Category Transportation', color: '#F97316' },
  { nameKey: 'Default Category Shopping', color: '#EAB308' },
  { nameKey: 'Default Category Entertainment', color: '#A855F7' },
  { nameKey: 'Default Category Bills & Subscriptions', color: '#06B6D4' },
  { nameKey: 'Default Category Healthcare', color: '#22C55E' },
  { nameKey: 'Default Category Education', color: '#3B82F6' },
  { nameKey: 'Default Category Other', color: '#64748B' },
] as const;

/** App version displayed in InfoPopup and Settings. Derived from package.json via Vite define. */
export const APP_VERSION = `v${__APP_VERSION__}`;

/** Sentinel name used for fallback categories (displayed as "Other"). */
export const FALLBACK_CATEGORY_NAME = '__OTHER__';

/** Maximum PIN length. */
export const MAX_PIN_LENGTH = 6;

/** Minimum PIN length. */
export const MIN_PIN_LENGTH = 4;

/** Preset amounts shown in the transaction form. */
export const PRESET_AMOUNTS = [10000, 20000, 50000, 100000, 200000, 500000] as const;

/** Auto-lock timeout options in milliseconds. */
export const AUTO_LOCK_TIMEOUT_OPTIONS = [
  { value: 1, labelKey: 'settings.autoLockImmediately' },
  { value: 300_000, labelKey: 'settings.autoLock5min' },
  { value: 1_800_000, labelKey: 'settings.autoLock30min' },
  { value: 0, labelKey: 'settings.autoLockNever' },
] as const;

/**
 * Map a stored auto-lock timeout to the simplified option set (master.md 8.5).
 * Legacy values (1/2/15 min) collapse to the nearest new option:
 * 1-2 min → 5 min, 15 min → 30 min. Unknown values → 5 min default.
 */
export function normalizeAutoLockTimeout(value: number | null | undefined): number {
  if (value == null) return 300_000;
  const allowed: Set<number> = new Set(AUTO_LOCK_TIMEOUT_OPTIONS.map((o) => o.value));
  if (allowed.has(value)) return value;
  if (value === 60_000 || value === 120_000) return 300_000;
  if (value === 900_000) return 1_800_000;
  return 300_000;
}

/** Default auto-lock timeout (5 minutes). */
export const AUTO_LOCK_TIMEOUT_MS = 300_000;

/** Number of days before a wallet is considered stale (30 days). */
export const WALLET_STALE_DAYS = 30;

/** Number of days for spending trend comparison (recent vs previous). */
export const SPENDING_TREND_RECENT_DAYS = 7;
export const SPENDING_TREND_PREVIOUS_DAYS = 14;

/** Maximum file size for JSON import (10 MB). */
export const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024;

/** Budget warning threshold (80% used). */
export const BUDGET_NEAR_LIMIT_THRESHOLD = 0.80;

/** Valid transaction types for import validation. */
export const VALID_TX_TYPES = ['expense', 'balance_adjustment', 'transfer_in', 'transfer_out'] as const;

/** Backup format version constant. */
export const BACKUP_FORMAT_VERSION = '1.0';

/** Number of days before a backup is considered old. */
export const BACKUP_OLD_DAYS = 30;

/** Minimum changes since backup before recommending another backup. */
export const BACKUP_CHANGES_THRESHOLD = 50;

/** Critical changes since backup threshold. */
export const BACKUP_CHANGES_CRITICAL = 100;

/** Minimum transactions before prompting first backup. */
export const BACKUP_MIN_TX_FOR_PROMPT = 10;

/** Default reminder postponement in days. */
export const BACKUP_POSTPONE_DAYS = 7;

/** LocalStorage keys for app state persistence. */
export const STORAGE_KEYS = {
  BYPASS_PWA: 'expend_bypass_pwa',
  PWA_BANNER_DISMISSED: 'expend_pwa_banner_dismissed',
  HAS_ONBOARDED: 'expend_has_onboarded',
  ONBOARDING_COMPLETED: 'expend_onboarding_completed',
} as const;
