import { db, type Merchant } from '../db/db';
import { normalizePayeeKey, normalizePayeeName } from './payeeService';

/**
 * Ensure a merchant entry exists for the given transaction description.
 * Creates one if missing. Returns the merchant.
 */
export async function ensureMerchant(description: string): Promise<Merchant> {
  const key = normalizePayeeKey(description);
  if (!key) {
    // Fallback for empty descriptions
    const now = new Date().toISOString();
    const id = await db.merchants.add({
      displayName: 'Unknown',
      originalName: 'Unknown',
      aliases: [],
      archivedAt: null,
      mergedIntoId: null,
      createdAt: now,
      updatedAt: now,
    });
    return (await db.merchants.get(id))!;
  }

  const existing = await findMerchantByKey(key);
  if (existing) return existing;

  const now = new Date().toISOString();
  const trimmedName = normalizePayeeName(description);
  const id = await db.merchants.add({
    displayName: trimmedName,
    originalName: trimmedName,
    aliases: [],
    archivedAt: null,
    mergedIntoId: null,
    createdAt: now,
    updatedAt: now,
  });
  return (await db.merchants.get(id))!;
}

/**
 * Find merchant by normalized key (matches displayName, originalName, or aliases).
 */
export async function findMerchantByKey(key: string): Promise<Merchant | undefined> {
  const all = await db.merchants.toArray();
  return all.find(m => merchantMatchesKey(m, key));
}

/**
 * Check if a merchant matches a normalized key.
 */
function merchantMatchesKey(merchant: Merchant, key: string): boolean {
  if (normalizePayeeKey(merchant.displayName) === key) return true;
  if (normalizePayeeKey(merchant.originalName) === key) return true;
  return merchant.aliases.some(a => normalizePayeeKey(a) === key);
}

/**
 * Sync merchants table: ensure every unique expense description has a merchant entry.
 */
export async function syncMerchants(): Promise<void> {
  const expenses = await db.transactions.where('type').equals('expense').toArray();
  const merchants = await db.merchants.toArray();
  const existingKeys = new Set(
    merchants.flatMap(m => {
      const keys: string[] = [];
      if (m.displayName) keys.push(normalizePayeeKey(m.displayName));
      if (m.originalName && m.originalName !== m.displayName) keys.push(normalizePayeeKey(m.originalName));
      for (const a of m.aliases) keys.push(normalizePayeeKey(a));
      return keys;
    })
  );

  const now = new Date().toISOString();
  const seen = new Set<string>();

  for (const tx of expenses) {
    if (!tx.description) continue;
    const key = normalizePayeeKey(tx.description);
    if (!key || seen.has(key) || existingKeys.has(key)) continue;
    seen.add(key);

    await db.merchants.add({
      displayName: normalizePayeeName(tx.description),
      originalName: normalizePayeeName(tx.description),
      aliases: [],
      archivedAt: null,
      mergedIntoId: null,
      createdAt: now,
      updatedAt: now,
    });
  }
}

/**
 * Rename a merchant and update all related transactions.
 */
export async function renameMerchant(
  merchantId: number,
  newName: string,
): Promise<void> {
  const merchant = await db.merchants.get(merchantId);
  if (!merchant) return;

  const trimmedName = normalizePayeeName(newName);
  if (!trimmedName || trimmedName === merchant.displayName) return;

  const oldKey = normalizePayeeKey(merchant.displayName);

  // Update all transactions with the old description
  await db.transactions
    .where('type')
    .equals('expense')
    .filter(tx => normalizePayeeKey(tx.description) === oldKey)
    .modify({ description: trimmedName });

  // Update merchant
  await db.merchants.update(merchantId, {
    displayName: trimmedName,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Add alias to a merchant.
 */
export async function addMerchantAlias(merchantId: number, alias: string): Promise<void> {
  const merchant = await db.merchants.get(merchantId);
  if (!merchant) return;

  const trimmed = normalizePayeeName(alias);
  if (!trimmed) return;
  if (merchant.aliases.some(a => a.toLowerCase() === trimmed.toLowerCase())) return;

  await db.merchants.update(merchantId, {
    aliases: [...merchant.aliases, trimmed],
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Remove alias from a merchant.
 */
export async function removeMerchantAlias(merchantId: number, alias: string): Promise<void> {
  const merchant = await db.merchants.get(merchantId);
  if (!merchant) return;

  await db.merchants.update(merchantId, {
    aliases: merchant.aliases.filter(a => a !== alias),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Archive a merchant.
 */
export async function archiveMerchant(merchantId: number): Promise<void> {
  await db.merchants.update(merchantId, {
    archivedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Restore a merchant.
 */
export async function restoreMerchant(merchantId: number): Promise<void> {
  await db.merchants.update(merchantId, {
    archivedAt: null,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Merge source merchant into target merchant.
 * Atomically updates all transactions from source to target's display name.
 */
export async function mergeMerchants(
  sourceId: number,
  targetId: number,
): Promise<{ transactionsMoved: number }> {
  const source = await db.merchants.get(sourceId);
  const target = await db.merchants.get(targetId);
  if (!source || !target || sourceId === targetId) {
    return { transactionsMoved: 0 };
  }

  const sourceKey = normalizePayeeKey(source.displayName);
  const targetName = target.displayName;

  // Count affected transactions
  const affected = await db.transactions
    .where('type')
    .equals('expense')
    .filter(tx => normalizePayeeKey(tx.description) === sourceKey)
    .count();

  // Atomic transaction
  await db.transaction('rw', [db.transactions, db.merchants], async () => {
    // Move all transactions from source to target
    await db.transactions
      .where('type')
      .equals('expense')
      .filter(tx => normalizePayeeKey(tx.description) === sourceKey)
      .modify({ description: targetName });

    // Merge aliases
    const mergedAliases = [...new Set([...target.aliases, ...source.aliases])];
    await db.merchants.update(targetId, {
      aliases: mergedAliases,
      updatedAt: new Date().toISOString(),
    });

    // Mark source as merged
    await db.merchants.update(sourceId, {
      mergedIntoId: targetId,
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  return { transactionsMoved: affected };
}

/**
 * Get merchant by ID, following merged reference if needed.
 */
export async function getMerchantById(id: number): Promise<Merchant | undefined> {
  const merchant = await db.merchants.get(id);
  if (!merchant) return undefined;
  if (merchant.mergedIntoId) {
    return db.merchants.get(merchant.mergedIntoId);
  }
  return merchant;
}
