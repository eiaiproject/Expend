/**
 * Parse a YYYY-MM-DD date string into a Date object.
 * Uses noon UTC to avoid timezone-induced day shifting.
 *
 * For BUSINESS LOGIC (grouping, filtering, daily comparison),
 * prefer string-based helpers (getTodayStr, etc.) over Date objects
 * to avoid timezone-induced day shifting entirely.
 */
import { MONTH_NAMES_EN, MONTH_NAMES_ID } from './constants';

export function parseDate(dateStr: string): Date {
  const normalized = dateStr.includes('T') ? dateStr.split('T')[0]! : dateStr;
  return new Date(normalized + 'T12:00:00Z');
}

/**
 * Format a transaction date for detail display (dd MMMM yyyy).
 */
export function displayDateFull(dateStr: string, locale?: string): string {
  const d = parseDate(dateStr);
  const months = locale === 'id' ? MONTH_NAMES_ID : MONTH_NAMES_EN;
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ─── Local date string helpers ──────────────────────────────────
// These use the local timezone consistently so business logic
// (daily grouping, budget boundaries) is immune to UTC shifts.

/**
 * Get today's date as a YYYY-MM-DD string using the local timezone.
 * This is the SAFE way to get "today" for business logic.
 *
 * @param now - Optional fixed date (for testing/deterministic behaviour).
 */
export function getTodayStr(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get yesterday's date as a YYYY-MM-DD string using the local timezone.
 *
 * @param now - Optional fixed date (for testing/deterministic behaviour).
 */
export function getYesterdayStr(now: Date = new Date()): string {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const y = yesterday.getFullYear();
  const m = String(yesterday.getMonth() + 1).padStart(2, '0');
  const d = String(yesterday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get the start of the current week (Monday) as YYYY-MM-DD.
 * Uses local timezone.
 *
 * @param now - Optional fixed date (for testing/deterministic behaviour).
 */
export function getWeekStartStr(now: Date = new Date()): string {
  const d = new Date(now);
  const dayOfWeek = d.getDay() || 7; // Sunday → 7, Monday → 1
  d.setDate(d.getDate() - dayOfWeek + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Get the start of the current month as YYYY-MM-DD.
 *
 * @param now - Optional fixed date (for testing/deterministic behaviour).
 */
export function getMonthStartStr(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

/**
 * Get the start of the next month as YYYY-MM-DD.
 *
 * @param now - Optional fixed date (for testing/deterministic behaviour).
 */
export function getNextMonthStartStr(now: Date = new Date()): string {
  let m = now.getMonth() + 1;
  let y = now.getFullYear();
  if (m > 11) {
    m = 0;
    y += 1;
  }
  const mm = String(m + 1).padStart(2, '0');
  return `${y}-${mm}-01`;
}

/**
 * Extract the YYYY-MM prefix from a YYYY-MM-DD string.
 */
export function getMonthPrefix(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/**
 * Normalise a date string to YYYY-MM-DD (strip time component if present).
 */
export function normaliseDate(dateStr: string): string {
  return dateStr.includes('T') ? dateStr.split('T')[0]! : dateStr;
}
