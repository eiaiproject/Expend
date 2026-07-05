export const FALLBACK_CATEGORY_NAME = '__OTHER__';

export function getCategoryDisplayName(name: string | null | undefined, t: (key: string) => string): string {
  if (!name) return '';
  return name === FALLBACK_CATEGORY_NAME ? t('Other') : name;
}
