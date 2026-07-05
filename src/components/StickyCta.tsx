import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';

export function StickyCta() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.9);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-subtle)] bg-[var(--bg)]/90 p-3 backdrop-blur-md transition-transform duration-300 ${
        show ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4">
        <span className="text-sm text-[var(--text-muted)] hidden sm:inline">
          {t('landing.stickyNote')}
        </span>
        <a
          href="#install-section"
          className="ml-auto inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent)]/90 transition-colors active:scale-95"
        >
          <Download size={16} aria-hidden="true" />
          {t('landing.stickyInstall')}
        </a>
      </div>
    </div>
  );
}
