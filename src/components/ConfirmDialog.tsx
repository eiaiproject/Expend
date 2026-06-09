import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
}

type Resolver = (value: boolean) => void;

const dialogQueue: Array<{ opts: ConfirmDialogOptions & { id: number }; resolve: Resolver }> = [];
let dialogCounter = 0;

// State setter shared between ConfirmDialogProvider instances
let setDialogState: React.Dispatch<React.SetStateAction<(ConfirmDialogOptions & { id: number }) | null>> | null = null;

function processQueue() {
  if (dialogQueue.length === 0) {
    setDialogState?.(null);
    return;
  }
  // Only show one dialog at a time
  if (setDialogState) {
    setDialogState(dialogQueue[0]!.opts);
  }
}

export const confirm = (options: ConfirmDialogOptions): Promise<boolean> => {
  return new Promise((resolve) => {
    const id = ++dialogCounter;
    dialogQueue.push({ opts: { ...options, id }, resolve });
    if (dialogQueue.length === 1) {
      processQueue();
    }
  });
};

import { useFocusTrap } from '../hooks/useFocusTrap';

export function ConfirmDialogProvider() {
  const { t } = useTranslation();
  const [currentDialog, setCurrentDialog] = useState<(ConfirmDialogOptions & { id: number }) | null>(null);
  const dialogRef = useFocusTrap(!!currentDialog);

  useEffect(() => {
    setDialogState = setCurrentDialog;
    // If there's already something in the queue, show it
    processQueue();
    return () => {
      setDialogState = null;
    };
  }, []);

  const handleClose = useCallback((result: boolean) => {
    const item = dialogQueue.shift();
    if (item) {
      item.resolve(result);
    }
    // Process next item in queue after a microtask to allow state to settle
    setTimeout(processQueue, 0);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose(false);
    }
  }, [handleClose]);

  return (
    <AnimatePresence>
      {currentDialog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-6"
          onClick={() => handleClose(false)}
          onKeyDown={handleKeyDown}
          role="dialog"
          aria-modal="true"
          aria-label={currentDialog.title}
        >
          <motion.div
            ref={dialogRef}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
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
                onClick={() => handleClose(false)}
                className="flex-1 h-11 rounded-xl border border-[var(--border)] font-medium hover:bg-[var(--bg)] transition-colors active:scale-95"
                autoFocus
              >
                {currentDialog.cancelLabel || t('Cancel')}
              </button>
              <button
                onClick={() => handleClose(true)}
                className={(
                  "flex-1 h-11 rounded-xl font-medium transition-all active:scale-95 " +
                  (currentDialog.variant === 'danger'
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-[var(--accent)] text-white hover:opacity-90")
                )}
              >
                {currentDialog.confirmLabel || t('Confirm')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
