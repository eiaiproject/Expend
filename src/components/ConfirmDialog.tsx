import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  /** If set, user must type this exact string to enable confirm button. */
  requireTypedConfirm?: string;
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
  const [typedText, setTypedText] = useState('');
  const dialogRef = useFocusTrap(!!currentDialog);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDialogState = setCurrentDialog;
    return () => {
      pendingResolve?.(false);
      pendingResolve = null;
      setDialogState = null;
    };
  }, []);

  useEffect(() => {
    if (currentDialog) {
      setTypedText('');
      if (currentDialog.requireTypedConfirm) {
        // Focus the typed input after a short delay
        setTimeout(() => inputRef.current?.focus(), 100);
      } else if (cancelButtonRef.current) {
        cancelButtonRef.current.focus();
      }
    }
  }, [currentDialog]);

  const handleClose = useCallback((result: boolean) => {
    pendingResolve?.(result);
    pendingResolve = null;
    setCurrentDialog(null);
    setTypedText('');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose(false);
    }
  }, [handleClose]);

  const isTypedConfirmValid = !currentDialog?.requireTypedConfirm || typedText === currentDialog.requireTypedConfirm;

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
              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line">
                {currentDialog.message}
              </p>
            </div>

            {currentDialog.requireTypedConfirm && (
              <div>
                <label htmlFor="confirm-typed-input" className="sr-only">
                  {t('settings.confirmTypedLabel', { word: currentDialog.requireTypedConfirm })}
                </label>
                <input
                  id="confirm-typed-input"
                  ref={inputRef}
                  type="text"
                  value={typedText}
                  onChange={(e) => setTypedText(e.target.value)}
                  placeholder={currentDialog.requireTypedConfirm}
                  className="w-full h-11 px-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20"
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="mt-1 text-xs text-[var(--text-secondary)] text-center">
                  {t('settings.confirmTypedInstruction', { word: currentDialog.requireTypedConfirm })}
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button"
                ref={cancelButtonRef}
                onClick={() => handleClose(false)}
                className="flex-1 h-11 rounded-xl border border-[var(--border)] font-medium hover:bg-[var(--bg)] transition-colors active:scale-95"
              >
                {currentDialog.cancelLabel || t('Cancel')}
              </button>
              <button type="button"
                onClick={() => handleClose(true)}
                disabled={!isTypedConfirmValid}
                className={(
                  "flex-1 h-11 rounded-xl font-medium transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed " +
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
