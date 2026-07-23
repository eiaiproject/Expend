import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Tag, DollarSign, Eye, Archive, Trash2, ArrowSwapHorizontal, Wallet } from 'reicon-react';

interface HelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

function HelpItem({ icon: Icon, text }: { icon: React.ComponentType<{ size?: number; className?: string }>; text: string }) {
  return (
    <li className="flex items-start gap-3 py-2">
      <Icon size={16} className="text-[var(--accent)] mt-0.5 shrink-0" aria-hidden="true" />
      <span className="text-sm text-[var(--text-secondary)] leading-relaxed">{text}</span>
    </li>
  );
}

export function HelpDialog({ isOpen, onClose }: HelpDialogProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={t('categories.helpTitle')}>
      <div ref={dialogRef} className="bg-[var(--card)] rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-bold">{t('categories.helpTitle')}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-[var(--bg)] transition-colors"
            aria-label={t('Cancel')}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">{t('Categories')}</h3>
            <ul className="space-y-0">
              <HelpItem icon={Tag} text={t('categories.helpCategoryWhat')} />
              <HelpItem icon={ArrowSwapHorizontal} text={t('categories.helpCategoryImpact')} />
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">{t('Monthly Budget')}</h3>
            <ul className="space-y-0">
              <HelpItem icon={DollarSign} text={t('categories.helpBudgetWhat')} />
              <HelpItem icon={Wallet} text={t('categories.helpBudgetNotBalance')} />
              <HelpItem icon={DollarSign} text={t('categories.helpBudgetNotTransaction')} />
              <HelpItem icon={DollarSign} text={t('categories.helpBudgetCounted')} />
              <HelpItem icon={ArrowSwapHorizontal} text={t('categories.helpTransferExcluded')} />
              <HelpItem icon={Wallet} text={t('categories.helpBalanceAdjExcluded')} />
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">{t('categories.archiveCategory')}</h3>
            <ul className="space-y-0">
              <HelpItem icon={Archive} text={t('categories.helpArchive')} />
              <HelpItem icon={Trash2} text={t('categories.helpDelete')} />
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">{t('Security')}</h3>
            <ul className="space-y-0">
              <HelpItem icon={Eye} text={t('categories.helpPrivacy')} />
            </ul>
          </div>
        </div>

        <div className="p-4 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-xl bg-[var(--accent-fill)] text-white font-medium hover:opacity-90 transition-colors"
          >
            {t('Close')}
          </button>
        </div>
      </div>
    </div>
  );
}
