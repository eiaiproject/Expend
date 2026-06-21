import { db } from '../db/db';

/**
 * Schema definition for the 'security' setting value.
 */
export interface SecuritySettingsValue {
  enabled: boolean;
  method: 'pin';
  pinHash:
    | string // Legacy SHA-256 hash (to be migrated)
    | { hash: string; salt: string; iterations: number }; // PBKDF2
  pinLength: number;
  pin?: string; // Deprecated — used during migration only
}

/**
 * Schema definition for the 'language' setting value.
 */
export type LanguageSettingsValue = string;

/**
 * Typed getter for security settings.
 * Returns `undefined` if not set.
 */
export async function getSecuritySettings(): Promise<SecuritySettingsValue | undefined> {
  const setting = await db.settings.get('security');
  return setting?.value as SecuritySettingsValue | undefined;
}

/**
 * Typed setter for security settings.
 */
export async function setSecuritySettings(value: SecuritySettingsValue): Promise<void> {
  await db.settings.put({ key: 'security', value });
}

/**
 * Typed getter for language setting.
 * Returns `undefined` if not set.
 */
export async function getLanguageSetting(): Promise<LanguageSettingsValue | undefined> {
  const setting = await db.settings.get('language');
  if (setting && typeof setting.value === 'string') {
    return setting.value;
  }
  return undefined;
}

/**
 * Typed setter for language setting.
 */
export async function setLanguageSetting(value: LanguageSettingsValue): Promise<void> {
  await db.settings.put({ key: 'language', value });
}

/**
 * Typed helper for any generic setting.
 * Use this when the value type is known at the call site.
 */
export async function getSetting<T>(key: string): Promise<T | undefined> {
  const setting = await db.settings.get(key);
  return setting?.value as T | undefined;
}

/**
 * Typed helper to write any generic setting.
 */
export async function setSetting<T>(key: string, value: T): Promise<void> {
  await db.settings.put({ key, value });
}
