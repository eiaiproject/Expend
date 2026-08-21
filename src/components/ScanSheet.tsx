import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheetShell } from './BottomSheetShell';
import { Camera, Image, Check } from 'reicon-react';
import { extractTextFromImage } from '../services/ocrService';
import { parseScreenshotText } from '../services/screenshotParser';

interface ScanSheetProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onPrefill: (data: { description: string; amount: string; date: string | null; rawText: string }) => void;
}

/** Screenshot → OCR → prefilled form (automation B5). NO silent auto-save. */
export function ScanSheet({ isOpen, onClose, onPrefill }: ScanSheetProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState<string>('');

  const runOcr = async (file: File) => {
    setError(null);
    setProgress(0);
    setPreviewUrl(URL.createObjectURL(file));
    try {
      const text = await extractTextFromImage(file, setProgress);
      setOcrText(text);
    } catch {
      setError(t('scan.error'));
    } finally {
      setProgress(null);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const image = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'))?.getAsFile();
    if (image) void runOcr(image);
  };

  const handleUse = () => {
    const { description, amount, date } = parseScreenshotText(ocrText);
    onPrefill({ description, amount, date, rawText: ocrText });
    onClose();
  };

  const hasResult = ocrText.length > 0 && progress === null;

  return (
    <BottomSheetShell isOpen={isOpen} onClose={onClose} title={t('scan.title')} size="full">
      <div className="px-4 py-4 space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void runOcr(file);
          }}
        />
        <div
          onPaste={handlePaste}
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
          className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 text-center cursor-pointer focus-visible:border-[var(--accent)] min-h-[200px] flex flex-col items-center justify-center gap-3"
        >
          {previewUrl ? (
            <img src={previewUrl} alt={t('scan.title')} className="max-h-[240px] rounded-lg object-contain" />
          ) : (
            <>
              <Camera size={40} className="text-[var(--text-secondary)]" aria-hidden="true" />
              <p className="text-sm text-[var(--text-secondary)]">{t('scan.hint')}</p>
            </>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-[var(--accent)] border border-[var(--accent)]/30 bg-[var(--card)] active:scale-95 transition-transform min-h-[44px] flex items-center justify-center gap-2"
          >
            <Image size={16} aria-hidden="true" />
            {t('scan.gallery')}
          </button>
        </div>

        {progress !== null && (
          <div className="space-y-1">
            <p className="text-xs text-[var(--text-secondary)]">{t('scan.extracting')}</p>
            <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>
        )}

        {error && <p className="text-sm font-medium text-[var(--danger)]">{error}</p>}

        {hasResult && (
          <div>
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">{t('scan.preview')}</p>
            <pre className="whitespace-pre-wrap text-xs max-h-40 overflow-y-auto bg-[var(--bg)] border border-[var(--border)] rounded-xl p-3 font-sans">{ocrText}</pre>
            {(() => {
              const parsed = parseScreenshotText(ocrText);
              if (!parsed.amount) return <p className="mt-2 text-sm text-[var(--text-secondary)]">{t('scan.noAmount')}</p>;
              return (
                <button
                  type="button"
                  onClick={handleUse}
                  className="mt-3 w-full py-4 rounded-xl bg-[var(--accent-fill)] text-[var(--accent-ink)] font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform min-h-[52px]"
                >
                  <Check size={18} aria-hidden="true" />
                  {t('scan.useInForm', { description: parsed.description })}
                </button>
              );
            })()}
          </div>
        )}
      </div>
    </BottomSheetShell>
  );
}