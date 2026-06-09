import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

export interface ToastMessage {
  id: number;
  message: string;
  onUndo?: () => void;
  duration?: number; // Custom duration in ms
}

let toastCounter = 0;
type Listener = (toast: ToastMessage) => void;
const listeners = new Set<Listener>();

export const toast = {
  add: (message: string, onUndo?: () => void, duration?: number) => {
    const id = ++toastCounter;
    listeners.forEach(l => l({ id, message, onUndo, duration }));
  }
};

export function Toaster() {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const timers = new Map<number, ReturnType<typeof setTimeout>>();

    const listener = (toast: ToastMessage) => {
      setToasts(prev => [...prev, toast]);
      // Duration: Undo toasts longer (7s), success shorter (3s), default 5s
      const duration = toast.onUndo ? 7000 : (toast.duration || 5000);
      const timer = setTimeout(() => {
        timers.delete(toast.id);
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, duration);
      timers.set(toast.id, timer);
    };

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      // Clear all pending timers on unmount
      timers.forEach(timer => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return (
    <div className="fixed bottom-[80px] left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-max max-w-[90vw]" aria-live="polite" role="status">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-[var(--text-primary)] text-[var(--bg)] px-4 py-3 rounded-lg shadow-xl flex items-center gap-4 text-sm font-medium"
          >
            <span>{toast.message}</span>
            {toast.onUndo && (
              <button 
                onClick={() => {
                  toast.onUndo?.();
                  // Clear the auto-dismiss timer for this toast
                  setToasts(prev => prev.filter(t => t.id !== toast.id));
                }}
                className="text-[var(--accent)] hover:underline ml-auto border-l border-[var(--bg)]/20 pl-4 font-bold"
              >
                {t('UNDO')}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
