/**
 * Unit tests for walletPreferenceService default wallet fallback logic.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../src/db/db';
import type { Wallet } from '../../src/db/db';
import {
  resolveDefaultWalletFromValues,
  getDefaultExpenseWallet,
  setDefaultWallet,
  clearDefaultWallet,
  rememberLastUsedWallet,
  getConfiguredDefaultWalletId,
  getLastUsedWalletId,
  sanitizeWalletPreferences,
} from '../../src/services/walletPreferenceService';

function makeWallet(id: number, archived = false): Wallet {
  return {
    id,
    name: `Wallet ${id}`,
    currency: 'IDR',
    lastUpdated: new Date().toISOString(),
    initialBalance: 0,
    currentBalance: 0,
    archivedAt: archived ? new Date().toISOString() : null,
  };
}

beforeEach(async () => {
  await db.wallets.clear();
  await db.settings.clear();
});

// ── Pure fallback helper ───────────────────────────────────────

describe('resolveDefaultWalletFromValues', () => {
  const wallets = [makeWallet(1), makeWallet(2), makeWallet(3)];

  it('returns null when no wallets exist', () => {
    expect(resolveDefaultWalletFromValues([], null, null)).toBeNull();
  });

  it('returns null when all wallets are archived', () => {
    const archived = [makeWallet(1, true)];
    expect(resolveDefaultWalletFromValues(archived, null, null)).toBeNull();
  });

  it('prefers the explicitly configured default wallet', () => {
    expect(resolveDefaultWalletFromValues(wallets, 3, 1)?.id).toBe(3);
  });

  it('falls back to last-used wallet when no explicit default', () => {
    expect(resolveDefaultWalletFromValues(wallets, null, 2)?.id).toBe(2);
  });

  it('falls back to first active wallet when no preferences exist', () => {
    expect(resolveDefaultWalletFromValues(wallets, null, null)?.id).toBe(1);
  });

  it('ignores archived wallets in preferences', () => {
    const withArchivedDefault = [makeWallet(1), makeWallet(2), makeWallet(3, true)];
    expect(resolveDefaultWalletFromValues(withArchivedDefault, 3, null)?.id).toBe(1);
  });

  it('ignores non-existent wallet ids in preferences', () => {
    expect(resolveDefaultWalletFromValues(wallets, 99, null)?.id).toBe(1);
  });

  it('prefers explicit default over last-used', () => {
    expect(resolveDefaultWalletFromValues(wallets, 1, 2)?.id).toBe(1);
  });
});

// ── DB-backed API ──────────────────────────────────────────────

describe('getDefaultExpenseWallet (DB-backed)', () => {
  it('returns null when the wallets table is empty', async () => {
    expect(await getDefaultExpenseWallet([])).toBeNull();
  });

  it('resolves configured default from settings', async () => {
    await db.wallets.bulkAdd([makeWallet(1), makeWallet(2)]);
    await setDefaultWallet(2);
    const result = await getDefaultExpenseWallet();
    expect(result?.id).toBe(2);
  });

  it('resolves last-used when no explicit default', async () => {
    await db.wallets.bulkAdd([makeWallet(1), makeWallet(2)]);
    await rememberLastUsedWallet(2);
    const result = await getDefaultExpenseWallet();
    expect(result?.id).toBe(2);
  });

  it('resolves first active wallet when nothing is configured', async () => {
    await db.wallets.bulkAdd([makeWallet(1), makeWallet(2)]);
    const result = await getDefaultExpenseWallet();
    expect(result?.id).toBe(1);
  });

  it('skips an archived configured default', async () => {
    await db.wallets.bulkAdd([makeWallet(1), makeWallet(2, true)]);
    await setDefaultWallet(2);
    const result = await getDefaultExpenseWallet();
    expect(result?.id).toBe(1);
  });
});

// ── Sanitization ───────────────────────────────────────────────

describe('sanitizeWalletPreferences', () => {
  it('clears a default wallet that no longer exists', async () => {
    await setDefaultWallet(5);
    await sanitizeWalletPreferences();
    expect(await getConfiguredDefaultWalletId()).toBeNull();
  });

  it('clears a last-used wallet that is archived', async () => {
    await db.wallets.add(makeWallet(1, true));
    await rememberLastUsedWallet(1);
    await sanitizeWalletPreferences();
    expect(await getLastUsedWalletId()).toBeNull();
  });

  it('keeps valid preferences', async () => {
    await db.wallets.add(makeWallet(1));
    await setDefaultWallet(1);
    await rememberLastUsedWallet(1);
    await sanitizeWalletPreferences();
    expect(await getConfiguredDefaultWalletId()).toBe(1);
    expect(await getLastUsedWalletId()).toBe(1);
  });
});

// ── Settings round-trip ────────────────────────────────────────

describe('settings round-trip', () => {
  it('setDefaultWallet and clearDefaultWallet', async () => {
    await setDefaultWallet(3);
    expect(await getConfiguredDefaultWalletId()).toBe(3);
    await clearDefaultWallet();
    expect(await getConfiguredDefaultWalletId()).toBeNull();
  });
});
