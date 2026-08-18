import { useTranslation } from 'react-i18next';

interface SheetFormFooterProps {
  readonly onCancel: () => void;
  readonly onSave: () => void;
  readonly isSaving?: boolean;
  /** Disables the Save button when the form is invalid (default: true). */
  readonly canSave?: boolean;
}

/**
 * Standard sticky footer for wallet bottom sheets: a secondary Cancel button
 * and a primary Save button. Extracted so Add/Edit/Reconcile sheets share one
 * implementation instead of three identical button blocks.
 */
export function SheetFormFooter({ onCancel, onSave, isSaving = false, canSave = true }: SheetFormFooterProps) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 h-11 rounded-xl border border-[var(--border)] font-medium hover:bg-[var(--bg)] transition-colors active:scale-95"
      >
        {t('Cancel')}
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving || !canSave}
        className="flex-1 h-11 rounded-xl bg-[var(--accent-fill)] text-[var(--accent-ink)] font-medium transition-colors hover:opacity-90 active:scale-95 disabled:opacity-50"
      >
        {isSaving ? t('Saving...') : t('Save')}
      </button>
    </div>
  );
}
