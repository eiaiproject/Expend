import { useEffect } from 'react';
import { Coffee, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '../hooks/useFocusTrap';

export function InfoPopup({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const dialogRef = useFocusTrap(isOpen);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div ref={dialogRef} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-label={t('Project Information')}>
      <div className="bg-[var(--card)] text-[var(--text-primary)] w-full max-w-[300px] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative">
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-[var(--border)] transition-colors"
        >
          <X size={20} />
        </button>
        
        <div className="p-6 flex flex-col items-center text-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <span className="text-sm font-medium opacity-60">{t('Version')}</span>
            <span className="text-lg font-bold">{__APP_VERSION__}</span>
            <span className="text-[10px] opacity-40">Build: {new Date(__BUILD_DATE__).toLocaleDateString('id-ID')}</span>
            <span className="text-[10px] opacity-40">Hash: {__GIT_HASH__.slice(0, 7)}</span>
          </div>

          <div className="h-px w-full bg-[var(--border)]" />

          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">© eiaiproject</span>
            </div>
          </div>

          <a 
            href="https://trakteer.id/eiaiproject" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl flex items-center justify-center gap-2 font-medium transition-all active:scale-95 shadow-md"
          >
            <Coffee size={18} />
            {t('Buy Me A Coffee')}
          </a>
        </div>
      </div>
    </div>
  );
}
