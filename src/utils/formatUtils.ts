/**
 * Semantic currency formatters for the Expend app.
 *
 * All currency formatting uses Intl.NumberFormat with IDR currency
 * for consistent, locale-aware output.
 *
 * Each variant has a clear semantic meaning:
 * - formatCurrency(amount)        → plain "Rp 50.000"
 * - formatAbsoluteCurrency(amount)→ "Rp 50.000" (always positive display)
 * - formatCurrencyValue(amount)   → "50.000" (plain number for inline use)
 */

const CURRENCY_FORMATTER = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const NUMBER_FORMATTER = new Intl.NumberFormat('id-ID');

/**
 * Format a bare amount with "Rp" prefix (no sign).
 * Suitable for total expense display.
 */
export function formatCurrency(amount: number, hideAmount = false): string {
  if (hideAmount) return '•••••';
  return CURRENCY_FORMATTER.format(Math.abs(amount));
}

/**
 * Format a balance value — preserves negative sign for the balance itself.
 * Suitable for the summary card balance display.
 */
export function formatBalance(amount: number, hideAmount = false): string {
  if (hideAmount) return '•••••';
  const sign = amount < 0 ? '-' : '';
  return `${sign}${CURRENCY_FORMATTER.format(Math.abs(amount))}`;
}

/**
 * Format an amount with sign prefix as a single string.
 * Suitable for transaction cards — no separate minus element.
 * Returns "-Rp500.000" or "+Rp500.000".
 */
export function formatSignedCurrency(amount: number, hideAmount = false): string {
  if (hideAmount) return '•••••';
  const sign = amount < 0 ? '-' : '+';
  return `${sign}${CURRENCY_FORMATTER.format(Math.abs(amount))}`;
}

/**
 * Format an amount value as a plain number string (for inline use in transaction cards).
 */
export function formatCurrencyValue(amount: number, hideAmount = false): string {
  if (hideAmount) return '•••••';
  return NUMBER_FORMATTER.format(Math.abs(amount));
}

// Re-export shared amount parsing/formatting helpers
export { parseAmount, formatAmountInput } from './amountUtils';
