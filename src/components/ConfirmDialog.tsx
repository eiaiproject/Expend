import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
}

type Resolver = (value: boolean) => void;

let pendingResolve: Resolver | null = null;
let setDialogState: React.Dispatch<React.SetStateAction<ConfirmDialogOptions | null>> | null = null;

export const confirm = (options: ConfirmDialogOptions): Promise<boolean> => {
  return new Promise((resolve) => {
    pendingResolve?.(false);
    pendingResolve = resolve;
    setDialogState?.(options);
  });
};

import { useFocusTrap } from '../hooks/useFocusTrap';

export function ConfirmDialogProvider() {
  const { t } = useTranslation();
  const [currentDialog, setCurrentDialog] = useState<ConfirmDialogOptions | null>(null);
  const dialogRef = useFocusTrap(!!currentDialog);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDialogState = setCurrentDialog;
    return () => {
      pendingResolve?.(false);
      pendingResolve = null;
      setDialogState = null;
    };
  }, []);

  useEffect(() => {
    if (currentDialog && cancelButtonRef.current) {
      cancelButtonRef.current.focus();
    }
  }, [currentDialog]);

  const handleClose = useCallback((result: boolean) => {
    pendingResolve?.(result);
    pendingResolve = null;
    setCurrentDialog(null);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose(false);
    }
  }, [handleClose]);

  return (
    <>
      {currentDialog && (
        <div
          className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-6"
          onClick={() => handleClose(false)}
          onKeyDown={handleKeyDown}
          role="dialog"
          aria-modal="true"
          aria-label={currentDialog.title}
        >
          <div
            ref={dialogRef}
            className="bg-[var(--card)] rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-2">
              <h2 className="text-lg font-bold">{currentDialog.title}</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                {currentDialog.message}
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                ref={cancelButtonRef}
                onClick={() => handleClose(false)}
                className="flex-1 h-11 rounded-xl border border-[var(--border)] font-medium hover:bg-[var(--bg)] transition-colors active:scale-95"
              >
                {currentDialog.cancelLabel || t('Cancel')}
              </button>
              <button
                onClick={() => handleClose(true)}
                className={(
                  "flex-1 h-11 rounded-xl font-medium transition-colors active:scale-95 " +
                  (currentDialog.variant === 'danger'
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-[var(--accent)] text-white hover:opacity-90")
                )}
              >
                {currentDialog.confirmLabel || t('Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
