import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export interface ToastMessage {
  readonly id: number;
  readonly message: string;
  readonly onUndo?: () => void;
  readonly duration?: number;
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

function ToastItem({ toast: msg, onRemove, t: translate }: { toast: ToastMessage; onRemove: (id: number) => void; t: (key: string) => string }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverRef = useRef(false);
  const focusRef = useRef(false);

  const startTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!hoverRef.current && !focusRef.current) {
        onRemove(msg.id);
      }
    }, msg.onUndo ? 7000 : (msg.duration || 5000));
  };

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMouseEnter = () => { hoverRef.current = true; if (timerRef.current) clearTimeout(timerRef.current); };
  const handleMouseLeave = () => { hoverRef.current = false; startTimer(); };
  const handleFocus = () => { focusRef.current = true; if (timerRef.current) clearTimeout(timerRef.current); };
  const handleBlur = () => { focusRef.current = false; startTimer(); };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className="bg-[var(--text-primary)] text-[var(--bg)] px-4 py-3 rounded-lg shadow-xl flex items-center gap-4 text-sm font-medium pointer-events-auto max-w-[90vw]"
    >
      <span>{msg.message}</span>
      {msg.onUndo && (
        <button type="button"
          onClick={() => {
            msg.onUndo?.();
            onRemove(msg.id);
          }}
          className="text-[var(--accent)] hover:underline ml-auto border-l border-[var(--bg)]/20 pl-4 font-bold whitespace-nowrap"
        >
          {translate('UNDO')}
        </button>
      )}
    </div>
  );
}

export function Toaster() {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener = (newToast: ToastMessage) => {
      setToasts(prev => [...prev, newToast]);
    };

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <>
      {/* Mobile: above bottom nav */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[100] lg:hidden flex flex-col items-center gap-2 px-4 pointer-events-none"
        style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 16px)' }}
        aria-live="polite"
        role="status"
      >
        {toasts.map(msg => (
          <ToastItem key={msg.id} toast={msg} onRemove={removeToast} t={t} />
        ))}
      </div>
      {/* Desktop: bottom-right */}
      <div
        className="fixed bottom-6 right-6 z-[100] hidden lg:flex flex-col items-end gap-2 pointer-events-none"
        aria-live="polite"
        role="status"
      >
        {toasts.map(msg => (
          <ToastItem key={msg.id} toast={msg} onRemove={removeToast} t={t} />
        ))}
      </div>
    </>
  );
}
