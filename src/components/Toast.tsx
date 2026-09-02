import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, X } from 'reicon-react';

interface ToastProps {
  readonly message: string;
  readonly type?: 'success' | 'error';
  readonly onDismiss?: () => void;
  readonly duration?: number;
}

export function Toast({ message, type = 'success', onDismiss, duration = 4000 }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  useEffect(() => {
    if (!visible && onDismiss) {
      const timer = setTimeout(onDismiss, 300);
      return () => clearTimeout(timer);
    }
  }, [visible, onDismiss]);

  if (!visible && !onDismiss) return null;

  const Icon = type === 'success' ? CheckCircle : AlertCircle;
  const iconClass = type === 'success' ? 'text-[var(--success)]' : 'text-[var(--danger)]';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[calc(100%-2rem)] px-4 py-3 rounded-[var(--radius-md)] bg-[var(--card)] border border-[var(--border)] shadow-lg flex items-start gap-3 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}
    >
      <Icon size={18} className={`shrink-0 mt-0.5 ${iconClass}`} aria-hidden />
      <p className="text-sm flex-1 min-w-0 leading-snug">{message}</p>
      <button
        type="button"
        onClick={() => { setVisible(false); onDismiss?.(); }}
        aria-label="Tutup"
        className="shrink-0 min-w-11 min-h-11 -mt-1 -mr-1 grid place-items-center rounded-full hover:bg-[var(--bg)] transition-colors"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
