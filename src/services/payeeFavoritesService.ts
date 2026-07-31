/**
 * Payee favorites service (master.md section 6.4).
 *
 * Favorites are stored as an array of normalized payee keys in the
 * lightweight `settings` store — no schema migration needed and no
 * relational querying required.
 *
 * Favorite payees receive ranking priority in the "Frequently used"
 * section and remain subject to archive-state rules like any other payee.
 */
import { db } from '../db/db';
import { normalizePayeeKey } from './payeeService';

const FAVORITES_SETTINGS_KEY = 'favoritePayees';

function parseFavoriteKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((k): k is string => typeof k === 'string' && k.length > 0);
}

/**
 * List all favorited normalized payee keys.
 */
export async function getFavoritePayeeKeys(): Promise<string[]> {
  const entry = await db.settings.get(FAVORITES_SETTINGS_KEY);
  return parseFavoriteKeys(entry?.value);
}

/**
 * Check whether a payee name is favorited.
 */
export async function isFavoritePayee(payeeName: string): Promise<boolean> {
  const key = normalizePayeeKey(payeeName);
  if (!key) return false;
  const favorites = await getFavoritePayeeKeys();
  return favorites.includes(key);
}

/**
 * Add or remove a favorite by payee name. Returns the new favorite state.
 */
export async function toggleFavoritePayee(payeeName: string): Promise<boolean> {
  const key = normalizePayeeKey(payeeName);
  if (!key) return false;
  const isFav = (await getFavoritePayeeKeys()).includes(key);
  await setFavoritePayee(payeeName, !isFav);
  return !isFav;
}

/**
 * Explicitly set the favorite state for a payee name.
 */
export async function setFavoritePayee(payeeName: string, favorite: boolean): Promise<void> {
  const key = normalizePayeeKey(payeeName);
  if (!key) return;
  const favorites = await getFavoritePayeeKeys();
  const next = favorite
    ? Array.from(new Set([...favorites, key]))
    : favorites.filter((k) => k !== key);
  await db.settings.put({ key: FAVORITES_SETTINGS_KEY, value: next });
}

/**
 * Re-key a favorite when a payee is renamed or merged (master.md 6.8).
 * Moves the favorite from the old normalized key to the new one so the
 * favorite status survives renames and merchant merges. No-op when the
 * old key is not favorited or both keys are equal.
 */
export async function renameFavoritePayee(oldName: string, newName: string): Promise<void> {
  const oldKey = normalizePayeeKey(oldName);
  const newKey = normalizePayeeKey(newName);
  if (!oldKey || !newKey || oldKey === newKey) return;
  const favorites = await getFavoritePayeeKeys();
  if (!favorites.includes(oldKey)) return;
  const next = Array.from(new Set([...favorites.filter((k) => k !== oldKey), newKey]));
  await db.settings.put({ key: FAVORITES_SETTINGS_KEY, value: next });
}
