import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../db/db';
import i18n from '../i18n/init';
import { useLiveQuery } from 'dexie-react-hooks';
import { useIsStandalone } from '../utils/pwaUtils';
import { STORAGE_KEYS } from '../utils/constants';

/**
 * Manages the bootstrap state machine for the app:
 * 1. Detects returning users via IndexedDB (skip PWA/onboarding)
 * 2. Removes the splash screen after an initial delay
 * 3. Syncs the persisted language setting to i18n
 * 4. Exposes gate states needed by AppContent
 */
export function useAppBootstrap() {
  const [bypassPwa, setBypassPwa] = useState(() => localStorage.getItem(STORAGE_KEYS.BYPASS_PWA) === 'true');
  const [isBannerDismissed, setIsBannerDismissed] = useState(() => localStorage.getItem(STORAGE_KEYS.PWA_BANNER_DISMISSED) === 'true');
  const [hasOnboarded, setHasOnboarded] = useState(() => localStorage.getItem(STORAGE_KEYS.HAS_ONBOARDED) === 'true');
  const [onboardingCompleted, setOnboardingCompleted] = useState(() => localStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED) === 'true');
  const [isCheckingData, setIsCheckingData] = useState(true);
  const dataCheckDone = useRef(false);
  const isStandalone = useIsStandalone();

  // Read language setting from IndexedDB
  const langSetting = useLiveQuery(() => db.settings.get('language') as Promise<{ key: string; value: unknown } | undefined>);

  // Sync persisted language to i18n
  useEffect(() => {
    if (langSetting?.value && typeof langSetting.value === 'string') {
      i18n.changeLanguage(langSetting.value);
    }
  }, [langSetting]);

  // Check if user already has data in IndexedDB — skip PWA/onboarding for returning users
  useEffect(() => {
    if (dataCheckDone.current) return;
    dataCheckDone.current = true;

    const checkExistingData = async () => {
      try {
        const walletCount = await db.wallets.count();
        const txCount = await db.transactions.count();
        const hasData = walletCount > 0 || txCount > 0;

        if (hasData) {
          localStorage.setItem(STORAGE_KEYS.HAS_ONBOARDED, 'true');
          localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');
          setHasOnboarded(true);
          setOnboardingCompleted(true);
          setBypassPwa(true);
          localStorage.setItem(STORAGE_KEYS.BYPASS_PWA, 'true');
        }
      } catch {
        // IndexedDB might not be available; fall through to normal flow
      } finally {
        setIsCheckingData(false);
      }
    };

    checkExistingData();
  }, []);

  const handleBypassPwa = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.BYPASS_PWA, 'true');
    setBypassPwa(true);
  }, []);

  const handleDismissBanner = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.PWA_BANNER_DISMISSED, 'true');
    setIsBannerDismissed(true);
  }, []);

  const handleOnboarded = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.HAS_ONBOARDED, 'true');
    setHasOnboarded(true);
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');
    setOnboardingCompleted(true);
  }, []);

  return {
    // Gate states
    isCheckingData,
    bypassPwa,
    hasOnboarded,
    onboardingCompleted,
    isBannerDismissed,
    isStandalone,
    handleBypassPwa,
    handleDismissBanner,
    handleOnboarded,
    handleOnboardingComplete,
  } as const;
}
