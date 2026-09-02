import { useEffect, useRef, useCallback } from 'react';
import type { RefObject } from 'react';

interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly destructive?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  destructive = false,
  onConfirm,
  onCancel,
  returnFocusRef,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement & HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onCancel]
  );

  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement;
      cancelRef.current?.focus();
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    } else {
      // Return focus to trigger element
      const target = returnFocusRef?.current ?? previousFocus.current;
      if (target && typeof target.focus === 'function') {
        target.focus();
      }
    }
  }, [open, handleKeyDown, returnFocusRef]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onCancel} aria-hidden="true" />
      <dialog
        ref={dialogRef as unknown as React.RefObject<HTMLDialogElement>}
        open
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="relative z-10 w-full max-w-sm rounded-[var(--radius-lg)] bg-[var(--card)] border border-[var(--border)] p-5 shadow-lg"
      >
        <h2 id="dialog-title" className="text-base font-bold leading-snug">{title}</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">{description}</p>
        <div className="flex gap-2 mt-5 justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-11 px-4 rounded-[var(--radius-md)] bg-[var(--bg)] border border-[var(--border)] text-sm font-semibold hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-11 px-4 rounded-[var(--radius-md)] text-sm font-bold active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 ${
              destructive
                ? 'bg-[var(--danger)] text-white hover:opacity-90'
                : 'bg-[var(--accent-fill)] text-[var(--accent-ink)] hover:opacity-90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </dialog>
    </div>
  );
}
