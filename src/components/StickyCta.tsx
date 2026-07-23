import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function StickyCta({ onEnter }: { onEnter: () => void }) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.9);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-subtle)] bg-[var(--bg)]/90 backdrop-blur-md transition-transform duration-300 ${
        show ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <span className="text-xs sm:text-sm text-[var(--text-muted)] hidden sm:inline">
          {t('landing.stickyNote')}
        </span>
        <button
          type="button"
          onClick={onEnter}
          className="ml-auto inline-flex items-center gap-2 rounded-full bg-[var(--accent-fill)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity active:scale-95 cursor-pointer"
        >
          {t('landing.stickyCta', 'Start Tracking')}
        </button>
      </div>
    </div>
  );
}
