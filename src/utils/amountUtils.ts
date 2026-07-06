/** Parse a formatted or raw amount string to integer. */
export function parseAmount(value: string): number {
  return parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
}

/** Format raw numeric input for display (locale-aware thousand separators). */
export function formatAmountInput(value: string): string {
  const raw = value.replace(/[^0-9]/g, '');
  return raw ? parseInt(raw, 10).toLocaleString('id-ID') : '';
}
