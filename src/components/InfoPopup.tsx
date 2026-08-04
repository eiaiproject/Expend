import { useEffect } from 'react';
import { useEscapeKeyClose } from '../hooks/useEscapeKeyClose';
import { Coffee, Keyboard, X } from 'reicon-react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { TRAKTEER_URL } from '../services/supportService';

export function InfoPopup({ isOpen, onClose }: { readonly isOpen: boolean; readonly onClose: () => void }) {
  const { t } = useTranslation();
  const dialogRef = useFocusTrap(isOpen);

  useEscapeKeyClose(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <dialog
        open
        aria-label={t('Project Information')}
        className="bg-[var(--card)] text-[var(--text-primary)] w-full max-w-[300px] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative p-0 border-0 backdrop:bg-transparent m-0"
      >
        <button type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-[var(--border)] transition-colors"
        >
          <X size={20} />
        </button>

        <div className="p-6 flex flex-col items-center text-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <span className="text-sm font-medium opacity-60">{t('Version')}</span>
            <span className="text-lg font-bold">{__APP_VERSION__}</span>
            <span className="text-xs font-mono opacity-40 tabular-nums">
              Build: {__BUILD_DATE__}
            </span>
          </div>

          <div className="hidden sm:block h-px w-full bg-[var(--border)]" />

          <div className="w-full hidden sm:block">
            <div className="flex items-center gap-2 mb-2">
              <Keyboard size={14} className="text-[var(--text-secondary)]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                {t('Keyboard Shortcuts')}
              </span>
            </div>
            <div className="text-xs text-[var(--text-secondary)] space-y-1 text-left">
              <div className="flex justify-between">
                <span>{t('Search')}</span>
                <kbd className="px-1.5 py-0.5 bg-[var(--bg)] rounded border border-[var(--border)] font-mono">
                  /
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>{t('Toggle sort')}</span>
                <kbd className="px-1.5 py-0.5 bg-[var(--bg)] rounded border border-[var(--border)] font-mono">
                  S
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>{t('Toggle filter')}</span>
                <kbd className="px-1.5 py-0.5 bg-[var(--bg)] rounded border border-[var(--border)] font-mono">
                  F
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>{t('Add transaction')}</span>
                <kbd className="px-1.5 py-0.5 bg-[var(--bg)] rounded border border-[var(--border)] font-mono">
                  N
                </kbd>
              </div>
            </div>
          </div>

          <div className="hidden sm:block h-px w-full bg-[var(--border)]" />

          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">© Anggie Irawan</span>
            </div>
          </div>

          <a
            href={TRAKTEER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl flex items-center justify-center gap-2 font-medium transition-colors active:scale-95 shadow-md"
          >
            <Coffee size={18} aria-hidden="true" />
            {t('settings.supportOnTrakteer')}
            <span className="sr-only">{t('settings.opensExternalSite')}</span>
          </a>
        </div>
      </dialog>
    </div>
  );
}
