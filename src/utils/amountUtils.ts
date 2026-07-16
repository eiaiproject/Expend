/** Parse a formatted or raw amount string to integer. */
export function parseAmount(value: string): number {
  return Number.parseInt(value.replace(/\D/g, ''), 10) || 0;
}

/** Format raw numeric input for display (locale-aware thousand separators). */
export function formatAmountInput(value: string): string {
  const raw = value.replace(/\D/g, '');
  return raw ? Number.parseInt(raw, 10).toLocaleString('id-ID') : '';
}
