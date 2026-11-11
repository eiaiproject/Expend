import { Gallery, Receipt } from 'reicon-react';
import { useTranslation } from '../../i18n';
import { OcrGuideOverlay } from '../../components/OcrGuideOverlay';

interface ChatEmptyStateProps {
  readonly showOcrGuide: boolean;
  readonly keyboardInset: number;
  readonly onSelectExample: (text: string) => void;
  readonly onPickFile: () => void;
  readonly onDismissGuide: () => void;
}

export function ChatEmptyState({ showOcrGuide, keyboardInset, onSelectExample, onPickFile, onDismissGuide }: ChatEmptyStateProps) {
  const { t } = useTranslation();
  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col gap-3">
      <div className="w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 mt-6 mb-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-soft)] border border-[var(--border)]/60 grid place-items-center shrink-0 shadow-sm">
            <Receipt size={18} className="text-[var(--accent)]" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold tracking-tight leading-none">{t('chat.startRecording')}</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed">{t('chat.startDesc')}</p>
            <div className="mt-3 rounded-[10px] border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
              <div className="px-3 py-1.5 border-b border-[var(--border)]/60 bg-[var(--card)] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--border-strong)]" aria-hidden />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--border-strong)]" aria-hidden />
                <span className="text-xs font-mono tracking-wide text-[var(--text-muted)] uppercase">{t('chat.example')}</span>
                <span className="ml-auto text-xs font-sans normal-case tracking-normal text-[var(--text-muted)]">{t('chat.tapExample')}</span>
              </div>
              <div className="px-3 py-2.5 flex flex-col gap-1 font-mono text-xs leading-5 text-[var(--text-secondary)]">
                {(['chat.example1', 'chat.example2', 'chat.example3'] as const).map((key) => {
                  const example = t(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-label={t('chat.useExample', { example })}
                      onClick={() => onSelectExample(example)}
                      className="text-left flex items-center min-h-12 rounded-[8px] px-2 py-1.5 hover:bg-[var(--bone)] active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                    >
                      <span>{example}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-5">
          <button
            type="button"
            onClick={onPickFile}
            className="w-full min-h-12 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-[var(--bone)] active:scale-[0.98] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
          >
            <Gallery size={16} aria-hidden />
            {t('chat.uploadReceipt')}
          </button>
        </div>
      </div>
      {showOcrGuide && keyboardInset === 0 && (
        <div className="mb-4">
          <OcrGuideOverlay onDismiss={onDismissGuide} />
        </div>
      )}
    </div>
  );
}
