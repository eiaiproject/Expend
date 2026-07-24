import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';
import { db, type Setting } from '../db/db';
import { hashPin, verifyPin, verifyLegacySha256 } from '../utils/cryptoUtils';
import { AUTO_LOCK_TIMEOUT_MS } from '../utils/constants';

interface SecuritySettingsValue {
  readonly enabled: boolean;
  readonly method: 'pin';
  pinHash:
    | string
    | { hash: string; salt: string; iterations: number };
  pinLength: number;
  pin?: string;
}

interface SecurityContextType {
  readonly isLocked: boolean;
  readonly securityEnabled: boolean;
  readonly pinLength: number;
  readonly isSecurityLoaded: boolean;
  readonly autoLockTimeout: number;
  readonly lock: () => void;
  readonly unlock: (pin?: string) => Promise<boolean>;
  readonly setupPin: (pin: string) => Promise<void>;
  readonly disableSecurity: () => Promise<void>;
  readonly updateAutoLockTimeout: (ms: number) => Promise<void>;
  readonly checkSecurityAvailable: () => { pin: boolean };
}

const SecurityContext = createContext<SecurityContextType | null>(null);

export function useSecurity() {
  const context = useContext(SecurityContext);
  if (!context) throw new Error('useSecurity must be used within SecurityProvider');
  return context;
}

export function SecurityProvider({ children }: { readonly children: ReactNode }) {
  const [isLocked, setIsLocked] = useState(false); // Start unlocked; gate via isSecurityLoaded
  const [securityEnabled, setSecurityEnabled] = useState(false);
  const [pinLength, setPinLength] = useState(4);
  const [isSecurityLoaded, setIsSecurityLoaded] = useState(false);
  const [autoLockTimeout, setAutoLockTimeout] = useState(AUTO_LOCK_TIMEOUT_MS);
  const lastActiveRef = useRef(Date.now());
  const securitySettingsPromiseRef = useRef<Promise<SecuritySettingsValue | null> | undefined>(undefined);
  const securitySettingsRef = useRef<SecuritySettingsValue | null>(null);

  useEffect(() => {
    loadSecuritySettings();
    loadAutoLockTimeout();
  }, []);

  const loadAutoLockTimeout = async () => {
    try {
      const setting = await db.settings.get('autoLockTimeout');
      if (setting && typeof setting.value === 'number') {
        setAutoLockTimeout(setting.value);
      }
    } catch { /* ignore */ }
  };

  const updateAutoLockTimeout = useCallback(async (ms: number) => {
    setAutoLockTimeout(ms);
    await db.settings.put({ key: 'autoLockTimeout', value: ms });
  }, []);

  // Auto-lock when app comes back to foreground after inactivity
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastActiveRef.current;
        if (securityEnabled && autoLockTimeout > 0 && elapsed > autoLockTimeout) {
          setIsLocked(true);
        }
      } else if (document.visibilityState === 'hidden') {
        lastActiveRef.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [securityEnabled, autoLockTimeout]);

  const loadSecuritySettings = async () => {
    const promise = (async () => {
      try {
        const secVal = (await db.settings.get('security'))?.value as SecuritySettingsValue | undefined;
        // Validate state: ensure method and pinHash exist if security is enabled
        // Accept both PBKDF2 (pinHash) and legacy plaintext (pin) formats
        if (secVal?.enabled && secVal.method === 'pin' && (secVal.pinHash || secVal.pin)) {
          // Migration: convert old plaintext PIN to hashed format
          if (secVal.pin && !secVal.pinHash) {
            const pinHash = await hashPin(secVal.pin);
            const updatedSettings: SecuritySettingsValue = {
              ...secVal,
              pinHash,
              pin: undefined,
              pinLength: secVal.pinLength || 4,
            };
            await db.settings.put({ key: 'security', value: updatedSettings });
            return updatedSettings;
          }
          return secVal;
        } else {
          // Corrupted or missing security config — reset to safe state
          if (secVal?.enabled) {
            await db.settings.delete('security');
          }
          return null;
        }
      } catch (err) {
        console.error('Error loading security settings:', err);
        return null;
      }
    })();

    securitySettingsPromiseRef.current = promise;
    const result = await promise;

    // Cache for synchronous reads
    securitySettingsRef.current = result;

    if (result?.enabled && result.method === 'pin' && result.pinHash) {
      setSecurityEnabled(true);
      setPinLength(result.pinLength || 4);
      setIsLocked(true);
    } else {
      setSecurityEnabled(false);
      setPinLength(4);
      setIsLocked(false);
    }

    setIsSecurityLoaded(true);
  };

  const checkSecurityAvailable = useCallback(() => {
    return {
      pin: typeof crypto !== 'undefined' && !!crypto.subtle
    };
  }, []);

  const unlock = useCallback(async (pin?: string): Promise<boolean> => {
    if (!securityEnabled || !pin) return false;

    // Brute-force throttling: exponential backoff (persisted in IndexedDB)
    const now = Date.now();
    const lockoutRecord = await db.settings.get('lockout_record') as Setting | undefined;
    const lockoutData = (lockoutRecord?.value as { attempts: number; lockoutUntil: number } | undefined) ?? { attempts: 0, lockoutUntil: 0 };
    if (now < lockoutData.lockoutUntil) {
      return false;
    }

    // Use cached settings to avoid race condition (settings may change between read and verify)
    let secVal = securitySettingsRef.current;
    if (!secVal?.pinHash) {
      // Fallback: wait for in-flight promise or reload
      if (securitySettingsPromiseRef.current) {
        secVal = await securitySettingsPromiseRef.current ?? null;
      } else {
        secVal = ((await db.settings.get('security'))?.value as SecuritySettingsValue | undefined) ?? null;
      }
      securitySettingsRef.current = secVal;
      if (!secVal?.pinHash) return false;
    }

    const cachedVal = secVal!;
    const ph = cachedVal.pinHash;

    try {
      const matched = typeof ph === 'string'
        ? await verifyLegacySha256(pin, ph)
        : await verifyPin(pin, ph.hash, ph.salt, ph.iterations);
      if (matched) {
        await db.settings.delete('lockout_record');
        setIsLocked(false);
        lastActiveRef.current = Date.now();

        // Upgrade legacy SHA-256 hash to PBKDF2 on successful unlock
        if (typeof ph === 'string') {
          const newPinHash = await hashPin(pin);
          const updatedSettings: SecuritySettingsValue = {
            ...cachedVal,
            pinHash: newPinHash,
          };
          await db.settings.put({ key: 'security', value: updatedSettings });
          securitySettingsRef.current = updatedSettings;
        }

        return true;
      }
    } catch (err) {
      // Crypto subsystem failure (e.g., insecure context)
      console.error('Security verification failed:', err);
      return false;
    }

    // Failed attempt — apply exponential backoff (persisted to IndexedDB)
    const newAttempts = lockoutData.attempts + 1;
    const backoffMs = Math.min(1000 * Math.pow(2, newAttempts - 1), 60_000);
    const newLockoutUntil = Date.now() + backoffMs;
    await db.settings.put({
      key: 'lockout_record',
      value: { attempts: newAttempts, lockoutUntil: newLockoutUntil }
    });
    return false;
  }, [securityEnabled]);

  const lock = useCallback(() => {
    if (securityEnabled) {
      setIsLocked(true);
    }
  }, [securityEnabled]);

  const setupPin = useCallback(async (pin: string) => {
    const pinHash = await hashPin(pin);
    const length = pin.length;
    const nextSettings: SecuritySettingsValue = {
      enabled: true,
      method: 'pin',
      pinHash,
      pinLength: length,
    };

    await db.settings.put({ key: 'security', value: nextSettings });
    securitySettingsRef.current = nextSettings;
    securitySettingsPromiseRef.current = Promise.resolve(nextSettings);
    setSecurityEnabled(true);
    setPinLength(length);
    setIsLocked(false);
  }, []);

  const disableSecurity = useCallback(async () => {
    await db.settings.delete('security');
    await db.settings.delete('lockout_record');
    securitySettingsRef.current = null;
    securitySettingsPromiseRef.current = Promise.resolve(null);
    setSecurityEnabled(false);
    setIsLocked(false);
  }, []);

  return (
    <SecurityContext.Provider value={useMemo(() => ({
      isLocked: isSecurityLoaded ? (securityEnabled ? isLocked : false) : true,
      pinLength,
      securityEnabled,
      isSecurityLoaded,
      autoLockTimeout,
      lock,
      unlock,
      setupPin,
      disableSecurity,
      updateAutoLockTimeout,
      checkSecurityAvailable
    }), [isLocked, isSecurityLoaded, securityEnabled, pinLength, autoLockTimeout, lock, unlock, setupPin, disableSecurity, updateAutoLockTimeout, checkSecurityAvailable])}>
      {children}
    </SecurityContext.Provider>
  );
}
