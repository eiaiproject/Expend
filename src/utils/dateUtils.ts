/**
 * Parse a YYYY-MM-DD date string into a Date object.
 * Uses noon UTC to avoid timezone-induced day shifting.
 *
 * For BUSINESS LOGIC (grouping, filtering, daily comparison),
 * prefer string-based helpers (getTodayStr, etc.) over Date objects
 * to avoid timezone-induced day shifting entirely.
 */
export function parseDate(dateStr: string): Date {
  const normalized = dateStr.includes('T') ? dateStr.split('T')[0]! : dateStr;
  return new Date(normalized + 'T12:00:00Z');
}

// ponytail: single locale helper replaces localeTag + separate displayDateFull default
function fmtLocale(locale?: string, fallback = 'en-US'): string {
  return locale?.toLowerCase().startsWith('id') ? 'id-ID' : fallback;
}

function toDate(value: string | Date): Date {
  return typeof value === 'string' ? parseDate(value) : value;
}

function formatDate(value: string | Date, opts: Intl.DateTimeFormatOptions, locale?: string, fallback?: string): string {
  return new Intl.DateTimeFormat(fmtLocale(locale, fallback), opts).format(toDate(value));
}

export function displayDateFull(value: string | Date, locale?: string): string {
  return formatDate(value, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }, locale, 'en-GB');
}

export function displayDateShort(value: string | Date, locale?: string): string {
  return formatDate(value, { day: '2-digit', month: 'short' }, locale);
}

export function displayDateMedium(value: string | Date, locale?: string): string {
  return formatDate(value, { day: '2-digit', month: 'short', year: 'numeric' }, locale);
}

export function displayDateLong(value: string | Date, locale?: string): string {
  return formatDate(value, { day: 'numeric', month: 'long', year: 'numeric' }, locale);
}

export function displayTimeOrDate(value: string | Date, locale?: string): string {
  const d = toDate(value);
  const today = new Date();
  const todayStr = getTodayStr(today);
  const dateStr = typeof value === 'string' ? normaliseDate(value) : getTodayStr(d);

  if (dateStr === todayStr) {
    return displayTime(value, locale);
  }
  return displayDateShort(d, locale);
}

/**
 * Format a time value for display (HH:MM).
 */
export function displayTime(value: string | Date, locale?: string): string {
  const d = toDate(value);
  return new Intl.DateTimeFormat(fmtLocale(locale), { hour: '2-digit', minute: '2-digit' }).format(d);
}

export function displayMonthShort(value: string | Date, locale?: string): string {
  return formatDate(value, { month: 'short' }, locale);
}

export function toDateKey(date: Date): string {
  return getTodayStr(date);
}

export function toMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function daysBetweenDateOnly(left: string | Date, right: string | Date): number {
  const a = toDate(left);
  const b = toDate(right);
  const aMidnight = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bMidnight = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((aMidnight - bMidnight) / 86_400_000);
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
 * Add days to a YYYY-MM-DD string (TZ-safe string arithmetic).
 *
 * @param dateStr - Date string in YYYY-MM-DD format.
 * @param days - Number of days to add (negative to go back).
 */
export function addDays(dateStr: string, days: number): string {
  const [y = 0, m = 1, d = 1] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, (d ?? 1) + days);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
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
