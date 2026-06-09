import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, X } from 'lucide-react';
import { useState } from 'react';

export function UpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh,
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

  if (!needRefresh || dismissed) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-center gap-3 bg-[var(--accent)] text-white pl-4 pr-2 py-2.5 rounded-2xl shadow-lg shadow-black/20 max-w-sm">
        <RefreshCw size={16} className="shrink-0 animate-spin" style={{ animationDuration: '3s' }} />
        <span className="text-sm font-medium flex-1">
          {t('New version available!')}
        </span>
        <button
          onClick={() => updateServiceWorker(true)}
          className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
        >
          {t('Update')}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          aria-label={t('Dismiss')}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
