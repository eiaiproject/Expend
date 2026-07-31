/**
 * Default wallet preference service.
 *
 * Fallback order for the default expense wallet:
 * 1. Explicitly configured default wallet
 * 2. Last-used active wallet
 * 3. First valid active wallet
 * 4. null (UI asks the user when no valid wallet exists)
 *
 * Archived or deleted wallets must never remain active defaults.
 */
import { db, type Wallet } from '../db/db';

// ── Settings keys ──────────────────────────────────────────────

const SETTINGS_KEYS = {
  DEFAULT_WALLET_ID: 'defaultWalletId',
  LAST_USED_WALLET_ID: 'lastUsedWalletId',
} as const;

// ── Helpers ────────────────────────────────────────────────────

function isActiveWallet(wallet: Wallet): boolean {
  return !wallet.archivedAt;
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Get the explicit default wallet id from settings, if any.
 */
export async function getConfiguredDefaultWalletId(): Promise<number | null> {
  const entry = await db.settings.get(SETTINGS_KEYS.DEFAULT_WALLET_ID);
  const value = entry?.value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return value;
  }
  return null;
}

/**
 * Set the explicit default wallet id.
 */
export async function setDefaultWallet(walletId: number): Promise<void> {
  await db.settings.put({ key: SETTINGS_KEYS.DEFAULT_WALLET_ID, value: walletId });
}

/**
 * Clear the explicit default wallet preference.
 */
export async function clearDefaultWallet(): Promise<void> {
  await db.settings.delete(SETTINGS_KEYS.DEFAULT_WALLET_ID);
}

/**
 * Get the last-used active wallet id from settings, if any.
 */
export async function getLastUsedWalletId(): Promise<number | null> {
  const entry = await db.settings.get(SETTINGS_KEYS.LAST_USED_WALLET_ID);
  const value = entry?.value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return value;
  }
  return null;
}

/**
 * Remember the wallet most recently used for an expense.
 */
export async function rememberLastUsedWallet(walletId: number): Promise<void> {
  await db.settings.put({ key: SETTINGS_KEYS.LAST_USED_WALLET_ID, value: walletId });
}

/**
 * Resolve the default expense wallet following the documented fallback order.
 *
 * @returns The chosen active wallet, or null when no valid wallet exists.
 */
export async function getDefaultExpenseWallet(
  wallets?: readonly Wallet[],
): Promise<Wallet | null> {
  const allWallets = wallets ?? (await db.wallets.toArray());
  const configured = await getConfiguredDefaultWalletId();
  const lastUsed = await getLastUsedWalletId();
  return resolveDefaultWalletFromValues(allWallets, configured, lastUsed);
}

/**
 * Sanitize persisted wallet preferences so archived/deleted wallets never
 * remain as active defaults. Run at app bootstrap.
 */
export async function sanitizeWalletPreferences(): Promise<void> {
  const wallets = await db.wallets.toArray();
  const activeIds = new Set(wallets.filter(isActiveWallet).map((w) => w.id));

  const configured = await getConfiguredDefaultWalletId();
  if (configured != null && !activeIds.has(configured)) {
    await clearDefaultWallet();
  }

  const lastUsed = await getLastUsedWalletId();
  if (lastUsed != null && !activeIds.has(lastUsed)) {
    await db.settings.delete(SETTINGS_KEYS.LAST_USED_WALLET_ID);
  }
}

/**
 * Pure fallback selection helper for testing (no DB access).
 * Mirrors `getDefaultExpenseWallet` ordering but operates on given values.
 */
export function resolveDefaultWalletFromValues(
  wallets: readonly Wallet[],
  configuredId: number | null,
  lastUsedId: number | null,
): Wallet | null {
  const activeWallets = wallets.filter(isActiveWallet);
  if (activeWallets.length === 0) return null;

  if (configuredId != null && activeWallets.some((w) => w.id === configuredId)) {
    return activeWallets.find((w) => w.id === configuredId) ?? null;
  }
  if (lastUsedId != null && activeWallets.some((w) => w.id === lastUsedId)) {
    return activeWallets.find((w) => w.id === lastUsedId) ?? null;
  }
  return activeWallets[0] ?? null;
}
