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
  { name: 'Food & Drinks', color: '#EF4444' },
  { name: 'Transportation', color: '#F97316' },
  { name: 'Shopping', color: '#EAB308' },
  { name: 'Entertainment', color: '#A855F7' },
  { name: 'Bills & Subscriptions', color: '#06B6D4' },
  { name: 'Healthcare', color: '#22C55E' },
  { name: 'Education', color: '#3B82F6' },
  { name: 'Other', color: '#64748B' },
] as const;

/** App version displayed in InfoPopup and Settings. Derived from package.json via Vite define. */
export const APP_VERSION = `v${__APP_VERSION__}`;

/** Maximum PIN length. */
export const MAX_PIN_LENGTH = 6;

/** Minimum PIN length. */
export const MIN_PIN_LENGTH = 4;

/** Preset amounts shown in the transaction form. */
export const PRESET_AMOUNTS = [10000, 20000, 50000, 100000, 200000, 500000] as const;

/** Auto-lock timeout in milliseconds (2 minutes). */
export const AUTO_LOCK_TIMEOUT_MS = 120_000;

/** Number of days before a wallet is considered stale (30 days). */
export const WALLET_STALE_DAYS = 30;

/** Number of days for spending trend comparison (recent vs previous). */
export const SPENDING_TREND_RECENT_DAYS = 7;
export const SPENDING_TREND_PREVIOUS_DAYS = 14;

/** Maximum file size for JSON import (10 MB). */
export const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024;

/** Valid transaction types for import validation. */
export const VALID_TX_TYPES = ['expense', 'balance_adjustment', 'transfer_in', 'transfer_out'] as const;

/** Month names in English. */
export const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** Month names in Indonesian. */
export const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
] as const;

/** LocalStorage keys for app state persistence. */
export const STORAGE_KEYS = {
  BYPASS_PWA: 'expend_bypass_pwa',
  PWA_BANNER_DISMISSED: 'expend_pwa_banner_dismissed',
  HAS_ONBOARDED: 'expend_has_onboarded',
  ONBOARDING_COMPLETED: 'expend_onboarding_completed',
  // Legacy localStorage throttle keys kept so reset can clean older installs.
  FAILED_ATTEMPTS: 'expend_failed_attempts',
  LOCKOUT_UNTIL: 'expend_lockout_until',
} as const;
