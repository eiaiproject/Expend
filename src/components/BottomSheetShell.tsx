import { useEffect, useId, type ReactNode } from 'react';
import { X } from 'reicon-react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface BottomSheetShellProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children: ReactNode;
  /** Optional aria-label override (defaults to title) */
  readonly ariaLabel?: string;
  /** Optional z-index override (default 50) */
  readonly zIndex?: number;
  /** Size variant: content-sized pickers, medium filters, full forms. */
  readonly size?: 'content' | 'medium' | 'full';
  /** Optional height class override (default sheet-height: 85dvh with vh fallback) */
  readonly heightClass?: string;
  /** Optional sticky footer (e.g. form Save) rendered above the safe area */
  readonly footer?: ReactNode;
}

const SIZE_CLASS: Record<NonNullable<BottomSheetShellProps['size']>, string> = {
  content: 'sheet-height-content',
  medium: 'sheet-height-medium',
  full: 'sheet-height-full',
};

/**
 * Reusable bottom sheet wrapper (master.md §3.4):
 * - Backdrop click-to-close, Escape to close
 * - Focus trap with restoration
 * - Body scroll lock
 * - Size variants: content / medium / full
 * - Safe-area-aware footer slot for sticky form actions
 * - `sheet-height` utilities: dvh with vh fallbacks
 */
export function BottomSheetShell({
  isOpen,
  onClose,
  title,
  children,
  ariaLabel,
  zIndex = 50,
  size,
  heightClass = size ? SIZE_CLASS[size] : 'sheet-height',
  footer,
}: BottomSheetShellProps) {
  const { t } = useTranslation();
  const dialogRef = useFocusTrap(isOpen) as unknown as React.RefObject<HTMLDialogElement>;
  const titleId = useId();

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  return (
    <>
      {isOpen && (
        <>
          {/* Backdrop — sibling of the dialog so clicks land on it reliably */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
            style={{ zIndex: zIndex - 1 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <dialog
            ref={dialogRef}
            key="sheet"
            open
            onClose={(e) => { e.preventDefault(); onClose(); }}
            className={`fixed inset-x-0 bottom-0 m-0 max-w-full w-full bg-[var(--card)] rounded-t-2xl flex flex-col border-0 animate-in slide-in-from-bottom-full duration-300 ease-out ${heightClass}`}
            aria-modal="true"
            aria-labelledby={ariaLabel ? undefined : titleId}
            aria-label={ariaLabel}
            style={{ zIndex }}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)] shrink-0">
              <h2 id={titleId} className="text-lg font-bold">{title}</h2>
              <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg)] transition-colors hover:bg-[var(--border)]" aria-label={t('Close')}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className={`flex-1 overflow-y-auto min-h-0 overscroll-contain${footer ? '' : ' pb-[env(safe-area-inset-bottom,0px)]'}`}>
              {children}
            </div>
            {footer && (
              <div className="px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] border-t border-[var(--border)] bg-[var(--card)] shrink-0">
                {footer}
              </div>
            )}
          </dialog>
        </>
      )}
    </>
  );
}
