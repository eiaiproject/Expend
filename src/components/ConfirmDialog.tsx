import { useRef } from 'react';
import type { RefObject } from 'react';
import { useTranslation } from '../i18n';
import { useFocusTrap } from '../utils/focusTrap';

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
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
  returnFocusRef,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement & HTMLDialogElement>(null);

  useFocusTrap(dialogRef, { onClose: onCancel, initialFocusRef: cancelRef, restoreFocusRef: returnFocusRef, active: open });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="fixed inset-0 bg-black/40 hover:bg-black/50 transition-colors cursor-pointer" onClick={onCancel} aria-hidden="true" />
      <dialog
        ref={dialogRef as unknown as React.RefObject<HTMLDialogElement>}
        open
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="relative z-10 w-full max-w-sm rounded-[var(--radius-lg)] bg-[var(--card)] text-[var(--text-primary)] border border-[var(--border)] p-5 shadow-lg"
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
            {cancelLabel ?? t('common.cancel')}
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
            {confirmLabel ?? t('common.confirm')}
          </button>
        </div>
      </dialog>
    </div>
  );
}
