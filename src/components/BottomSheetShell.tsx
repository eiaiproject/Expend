import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface BottomSheetShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Optional aria-label override (defaults to title) */
  ariaLabel?: string;
  /** Optional z-index override (default 50) */
  zIndex?: number;
  /** Optional height class override (default h-[85vh]) */
  heightClass?: string;
}

/**
 * Reusable bottom sheet wrapper that handles:
 * - AnimatePresence enter/exit animation
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
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50"
            style={{ zIndex }}
            role="presentation"
          />
          <motion.div
            ref={dialogRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed bottom-0 left-0 w-full bg-[var(--card)] rounded-t-2xl flex flex-col ${heightClass}`}
            style={{ zIndex }}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel ?? title}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)] shrink-0">
              <h2 className="text-lg font-bold">{title}</h2>
              <button onClick={onClose} className="p-2 rounded-full bg-[var(--bg)]" aria-label={t('Close')}>
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
