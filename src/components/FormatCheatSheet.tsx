import { useRef } from 'react';
import { useTranslation } from '../i18n';
import { useFocusTrap } from '../utils/focusTrap';
import type { TranslationKey } from '../i18n/id';

const FORMATS: ReadonlyArray<{ sample: string; noteKey: TranslationKey }> = [
  { sample: 'kopi 25000', noteKey: 'chat.fmtPlain' },
  { sample: 'kopi 50.000 / 50,000', noteKey: 'chat.fmtThousands' },
  { sample: 'kopi 50rb / 50k', noteKey: 'chat.fmtK' },
  { sample: 'kopi 1.5jt / 1.5 juta', noteKey: 'chat.fmtM' },
  { sample: 'kopi Rp50.000', noteKey: 'chat.fmtPrefix' },
  { sample: 'kopi 20rb dari BSI / via GoPay / from BCA', noteKey: 'chat.fmtSource' },
  { sample: 'nasi goreng dari warung Pak Eko 20rb', noteKey: 'chat.fmtSeller' },
  { sample: 'kopi 20rb kemarin / lusa / hari ini', noteKey: 'chat.fmtRelativeDate' },
  { sample: 'kopi 25rb note untuk rapat', noteKey: 'chat.fmtNote' },
  { sample: 'kopi 20rb tgl 15 / 15/08/2026', noteKey: 'chat.fmtExplicitDate' },
  { sample: 'Kopi 50 ✗ ditolak', noteKey: 'chat.fmtFloor' },
  { sample: 'maks Rp1.000.000.000.000', noteKey: 'chat.fmtMax' },
];

export function FormatCheatSheet({ open, onClose }: { readonly open: boolean; readonly onClose: () => void }) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(dialogRef, { onClose, initialFocusRef: closeRef, active: open });
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="fixed inset-0 bg-black/40 cursor-pointer" onClick={onClose} aria-hidden="true" />
      <dialog
        ref={dialogRef}
        open
        aria-modal="true"
        aria-labelledby="cheatsheet-title"
        className="relative z-10 w-full max-w-md rounded-[var(--radius-lg)] bg-[var(--card)] text-[var(--text-primary)] border border-[var(--border)] p-5 shadow-lg max-h-[80dvh] overflow-y-auto"
      >
        <h2 id="cheatsheet-title" className="text-base font-bold leading-snug">{t('chat.sheetTitle')}</h2>
        <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">{t('chat.sheetDesc')}</p>
        <ul className="mt-4 space-y-2">
          {FORMATS.map((f) => (
            <li key={f.sample} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
              <p className="font-mono text-xs font-semibold break-words">{f.sample}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t(f.noteKey)}</p>
            </li>
          ))}
        </ul>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="mt-4 w-full min-h-12 rounded-[var(--radius-md)] bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
        >
          {t('chat.sheetClose')}
        </button>
      </dialog>
    </div>
  );
}
