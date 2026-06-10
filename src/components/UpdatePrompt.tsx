import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

// Re-show update prompt after this interval (10 minutes)
const REDISMISS_INTERVAL_MS = 10 * 60 * 1000;

export function UpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // Check for SW updates every hour
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
      }
    },
  });

  const [dismissed, setDismissed] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-show the prompt after REDISMISS_INTERVAL_MS if user dismissed it
  useEffect(() => {
    if (dismissed && needRefresh) {
      dismissTimerRef.current = setTimeout(() => {
        setDismissed(false);
      }, REDISMISS_INTERVAL_MS);
    }
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, [dismissed, needRefresh]);

  if (!needRefresh || dismissed) return null;

  const handleUpdate = async () => {
    setDismissed(true);
    setNeedRefresh(false);
    await updateServiceWorker(true);
  };

  const handleDismiss = () => {
    setDismissed(true);
    // setNeedRefresh is NOT called here — so the SW stays waiting
    // The prompt will re-appear after REDISMISS_INTERVAL_MS
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-4 duration-300" aria-live="polite">
      <div className="flex items-center gap-3 bg-[var(--accent)] text-white pl-4 pr-2 py-2.5 rounded-2xl shadow-lg shadow-black/20 max-w-sm">
        <RefreshCw size={16} className="shrink-0 animate-spin" style={{ animationDuration: '3s' }} />
        <span className="text-sm font-medium flex-1">
          {t('New version available!')}
        </span>
        <button
          type="button"
          onClick={handleUpdate}
          className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
        >
          {t('Update')}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          aria-label={t('Dismiss')}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
