import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '../db/db';

interface PrivacyContextType {
  /** When true, all monetary amounts should display as '•••••' */
  readonly hideAmount: boolean;
  readonly toggleHideAmount: () => void;
}

const PrivacyContext = createContext<PrivacyContextType | null>(null);

export function usePrivacy() {
  const context = useContext(PrivacyContext);
  if (!context) throw new Error('usePrivacy must be used within PrivacyProvider');
  return context;
}

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [hideAmount, setHideAmount] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const setting = await db.settings.get('hideAmount');
        if (setting) {
          setHideAmount(setting.value === 'true');
        }
      } catch { /* ignore */ }
    };
    load();
  }, []);

  const toggleHideAmount = useCallback(async () => {
    setHideAmount(prev => {
      const next = !prev;
      db.settings.put({ key: 'hideAmount', value: String(next) }).catch(() => {});
      return next;
    });
  }, []);

  return (
    <PrivacyContext.Provider value={{ hideAmount, toggleHideAmount }}>
      {children}
    </PrivacyContext.Provider>
  );
}
