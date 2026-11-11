import { Gallery } from 'reicon-react';
import { useTranslation } from '../../i18n';

export function OcrProgressCard({ progress, previewUrl }: { readonly progress: number; readonly previewUrl: string | null }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4">
      {previewUrl && (
        <div className="mb-3 rounded-[var(--radius-md)] overflow-hidden border border-[var(--border)]">
          <img src={previewUrl} alt={t('chat.uploadReceipt')} className="w-full max-h-48 object-cover" />
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-[var(--bg)] border border-[var(--border)] grid place-items-center">
          <Gallery size={14} className="text-[var(--text-secondary)]" aria-hidden />
        </div>
        <p className="text-xs font-semibold" aria-live="polite">
          {t('chat.readingReceipt')} {progress}%
        </p>
        <span className="ml-auto text-xs text-[var(--text-muted)]">{t('chat.offline')}</span>
      </div>
      <progress value={progress} max={100} aria-label={t('chat.scanningReceipt')} aria-valuetext={`${progress}%`} className="mt-3 h-1.5 w-full rounded-full overflow-hidden" />
      <p className="text-xs text-[var(--text-muted)] mt-2">{t('chat.stayOnPage')}</p>
    </div>
  );
}
