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
  /** Optional height class override (default h-[85vh]) */
  readonly heightClass?: string;
}

/**
 * Reusable bottom sheet wrapper that handles:
 * - Backdrop overlay shell
 * - Backdrop overlay with click-to-close
 * - Escape key to close
 * - Focus trap
 * - Header with title and close button
 */
export function BottomSheetShell({
  isOpen,
  onClose,
  title,
  children,
  ariaLabel,
  zIndex = 50,
  heightClass = 'h-[85vh]',
}: BottomSheetShellProps) {
  const { t } = useTranslation();
  const dialogRef = useFocusTrap(isOpen);
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
        <div
          key="sheet-root"
          className="fixed inset-0 pointer-events-none"
          style={{ zIndex }}
        >
          <div
            onClick={onClose}
            className="absolute inset-0 bg-black/50 pointer-events-auto"
            role="presentation"
          />
          <div
            ref={dialogRef}
            className={`absolute inset-x-0 bottom-0 bg-[var(--card)] rounded-t-2xl flex flex-col pointer-events-auto ${heightClass}`}
            role="dialog" // NOSONAR S6819 — <dialog> would break custom styling
            aria-modal="true"
            aria-labelledby={ariaLabel ? undefined : titleId}
            aria-label={ariaLabel}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)] shrink-0">
              <h2 id={titleId} className="text-lg font-bold">{title}</h2>
              <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg)] transition-colors hover:bg-[var(--border)]" aria-label={t('Close')}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain pb-[env(safe-area-inset-bottom,0px)]">
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
