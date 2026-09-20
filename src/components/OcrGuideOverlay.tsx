import { useTranslation } from '../i18n';

/** Overlay panduan visual sebelum capture/upload OCR (frame struk + tips). */
export function OcrGuideOverlay({ onDismiss }: { readonly onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--accent)] bg-[var(--accent-soft)]/40 p-4">
      <div
        aria-hidden="true"
        className="mx-auto max-w-[220px] rounded-[var(--radius-md)] border-2 border-[var(--accent)]/60 bg-[var(--card)] p-3"
      >
        <div className="h-1.5 w-2/3 rounded bg-[var(--border-strong)]" />
        <div className="mt-2 h-1.5 w-full rounded bg-[var(--border)]" />
        <div className="mt-1.5 h-1.5 w-5/6 rounded bg-[var(--border)]" />
        <div className="mt-2 h-1.5 w-1/2 rounded bg-[var(--border-strong)]" />
      </div>
      <p className="text-sm font-bold text-center mt-3">{t('chat.ocrGuideTitle')}</p>
      <p className="text-xs text-[var(--text-secondary)] text-center mt-1 leading-relaxed">{t('chat.ocrGuideDesc')}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-3 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] text-xs font-bold hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
      >
        {t('chat.ocrGuideGotIt')}
      </button>
    </div>
  );
}
