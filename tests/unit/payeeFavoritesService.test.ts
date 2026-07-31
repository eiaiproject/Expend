/**
 * Unit tests for payee favorites service.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';
import {
  getFavoritePayeeKeys,
  isFavoritePayee,
  toggleFavoritePayee,
  setFavoritePayee,
  renameFavoritePayee,
} from '../../src/services/payeeFavoritesService';

beforeEach(async () => {
  await db.settings.clear();
});

describe('payee favorites', () => {
  it('returns an empty list initially', async () => {
    expect(await getFavoritePayeeKeys()).toEqual([]);
  });

  it('isFavoritePayee returns false for unknown payees', async () => {
    expect(await isFavoritePayee('Coffee Shop')).toBe(false);
  });

  it('toggles a favorite on and normalizes the key', async () => {
    const state = await toggleFavoritePayee('  Coffee Shop  ');
    expect(state).toBe(true);
    expect(await getFavoritePayeeKeys()).toEqual(['coffee shop']);
    expect(await isFavoritePayee('coffee shop')).toBe(true);
  });

  it('toggles a favorite off', async () => {
    await setFavoritePayee('Coffee Shop', true);
    const state = await toggleFavoritePayee('Coffee Shop');
    expect(state).toBe(false);
    expect(await getFavoritePayeeKeys()).toEqual([]);
  });

  it('setFavoritePayee(true) is idempotent', async () => {
    await setFavoritePayee('Coffee', true);
    await setFavoritePayee('COFFEE', true);
    expect(await getFavoritePayeeKeys()).toEqual(['coffee']);
  });

  it('setFavoritePayee(false) removes without touching others', async () => {
    await setFavoritePayee('Coffee', true);
    await setFavoritePayee('Lunch', true);
    await setFavoritePayee('Coffee', false);
    expect(await getFavoritePayeeKeys()).toEqual(['lunch']);
  });

  it('ignores empty payee names', async () => {
    expect(await toggleFavoritePayee('   ')).toBe(false);
    await setFavoritePayee('', true);
    expect(await getFavoritePayeeKeys()).toEqual([]);
  });

  it('handles corrupt stored values gracefully', async () => {
    await db.settings.put({ key: 'favoritePayees', value: 'not-an-array' });
    expect(await getFavoritePayeeKeys()).toEqual([]);

    await db.settings.put({ key: 'favoritePayees', value: ['valid', 42, ''] });
    expect(await getFavoritePayeeKeys()).toEqual(['valid']);
  });

  it('renameFavoritePayee re-keys a favorited payee (6.8)', async () => {
    await setFavoritePayee('Coffee Shop', true);
    await renameFavoritePayee('Coffee Shop', 'Cafe Kopi');
    const keys = await getFavoritePayeeKeys();
    expect(keys).toEqual(['cafe kopi']);
    expect(await isFavoritePayee('Cafe Kopi')).toBe(true);
    expect(await isFavoritePayee('Coffee Shop')).toBe(false);
  });

  it('renameFavoritePayee normalizes both keys', async () => {
    await setFavoritePayee('  Coffee Shop  ', true);
    await renameFavoritePayee('coffee shop', '  CAFE KOPI ');
    expect(await getFavoritePayeeKeys()).toEqual(['cafe kopi']);
  });

  it('renameFavoritePayee is a no-op when not favorited or keys equal', async () => {
    await setFavoritePayee('Lunch', true);
    await renameFavoritePayee('Not Favorited', 'Something Else');
    expect(await getFavoritePayeeKeys()).toEqual(['lunch']);

    await renameFavoritePayee('Lunch', 'lunch');
    expect(await getFavoritePayeeKeys()).toEqual(['lunch']);
  });

  it('renameFavoritePayee merges when the new key already exists', async () => {
    await setFavoritePayee('Old Name', true);
    await setFavoritePayee('Existing Favorite', true);
    await renameFavoritePayee('Old Name', 'Existing Favorite');
    expect(await getFavoritePayeeKeys()).toEqual(['existing favorite']);
  });
});
