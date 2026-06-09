import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { db, type Setting } from '../db/db';
import { getSecuritySettings, setSecuritySettings, type SecuritySettingsValue } from '../utils/settingsSchema';
import { hashPin, verifyPin, verifyLegacySha256 } from '../utils/cryptoUtils';
import { AUTO_LOCK_TIMEOUT_MS, STORAGE_KEYS } from '../utils/constants';

interface SecurityContextType {
  isLocked: boolean;
  securityEnabled: boolean;
  securityMethod: 'pin' | null;
  pinLength: number;
  isSecurityLoaded: boolean;
  lock: () => void;
  unlock: (pin?: string) => Promise<boolean>;
  setupPin: (pin: string) => Promise<void>;
  disableSecurity: () => Promise<void>;
  checkSecurityAvailable: () => { pin: boolean };
}

const SecurityContext = createContext<SecurityContextType | null>(null);

export function useSecurity() {
  const context = useContext(SecurityContext);
  if (!context) throw new Error('useSecurity must be used within SecurityProvider');
  return context;
}

export function SecurityProvider({ children }: { children: ReactNode }) {
  const [isLocked, setIsLocked] = useState(false); // Start unlocked; gate via isSecurityLoaded
  const [securityEnabled, setSecurityEnabled] = useState(false);
  const [securityMethod, setSecurityMethod] = useState<'pin' | null>(null);
  const [pinLength, setPinLength] = useState(4);
  const [isSecurityLoaded, setIsSecurityLoaded] = useState(false);
  const lastActiveRef = useRef(Date.now());
  const securitySettingsPromiseRef = useRef<Promise<SecuritySettingsValue | null> | undefined>(undefined);
  const securitySettingsRef = useRef<SecuritySettingsValue | null>(null);

  useEffect(() => {
    loadSecuritySettings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-lock when app comes back to foreground after inactivity
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastActiveRef.current;
        // Lock if app was hidden for more than configured timeout
        if (securityEnabled && elapsed > AUTO_LOCK_TIMEOUT_MS) {
          setIsLocked(true);
        }
      } else if (document.visibilityState === 'hidden') {
        lastActiveRef.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [securityEnabled]);

  const loadSecuritySettings = async () => {
    const promise = (async () => {
      try {
        const secVal = await getSecuritySettings();
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
            await setSecuritySettings(updatedSettings);
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
      setSecurityMethod(result.method);
      setPinLength(result.pinLength || 4);
      setIsLocked(true);
    } else {
      setSecurityEnabled(false);
      setSecurityMethod(null);
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
    if (!securityMethod || !pin) return false;

    // Brute-force throttling: exponential backoff (persisted in IndexedDB)
    const now = Date.now();
    const lockoutRecord = await db.settings.get('lockout_record') as Setting | undefined;
    const lockoutData = (lockoutRecord?.value as { attempts: number; lockoutUntil: number } | undefined) ?? { attempts: 0, lockoutUntil: 0 };
    if (now < lockoutData.lockoutUntil) {
      return false;
    }

    if (securityMethod === 'pin') {
      // Use cached settings to avoid race condition (settings may change between read and verify)
      let secVal = securitySettingsRef.current;
      if (!secVal?.pinHash) {
        // Fallback: wait for in-flight promise or reload
        if (securitySettingsPromiseRef.current) {
          secVal = await securitySettingsPromiseRef.current ?? null;
        } else {
          secVal = await getSecuritySettings() ?? null;
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
            await setSecuritySettings(updatedSettings);
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
    }

    return false;
  }, [securityMethod]);

  const lock = useCallback(() => {
    if (securityEnabled) {
      setIsLocked(true);
    }
  }, [securityEnabled]);

  const setupPin = useCallback(async (pin: string) => {
    const pinHash = await hashPin(pin);
    const length = pin.length;
    await setSecuritySettings({
      enabled: true,
      method: 'pin',
      pinHash,
      pinLength: length,
    });
    setSecurityEnabled(true);
    setSecurityMethod('pin');
    setPinLength(length);
    setIsLocked(false);
  }, []);

  const disableSecurity = useCallback(async () => {
    await db.settings.delete('security');
    await db.settings.delete('lockout_record');
    setSecurityEnabled(false);
    setSecurityMethod(null);
    setIsLocked(false);
  }, []);

  return (
    <SecurityContext.Provider value={{
      isLocked: isSecurityLoaded ? (securityEnabled ? isLocked : false) : true,
      pinLength,
      securityEnabled,
      securityMethod,
      isSecurityLoaded,
      lock,
      unlock,
      setupPin,
      disableSecurity,
      checkSecurityAvailable
    }}>
      {children}
    </SecurityContext.Provider>
  );
}