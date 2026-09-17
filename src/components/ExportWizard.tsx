import { useMemo, useRef, useState } from 'react';
import { useTranslation } from '../i18n';
import { useFocusTrap } from '../utils/focusTrap';
import { filterByDate, validateDateRange } from '../utils/export';
import type { Transaction } from '../db/db';
import { InlineAlert } from './InlineAlert';

export type ExportKind = 'json' | 'csv';

/** Wizard ekspor 3 langkah: format → rentang+preview → konfirmasi. Logika export tetap milik parent. */
export function ExportWizard({
  open,
  transactions,
  onClose,
  onExport,
}: {
  readonly open: boolean;
  readonly transactions: Transaction[];
  readonly onClose: () => void;
  readonly onExport: (kind: ExportKind, from: string, to: string) => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [kind, setKind] = useState<ExportKind>('json');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(dialogRef, { onClose, initialFocusRef: closeRef, active: open });

  const rangeErr = validateDateRange(from || undefined, to || undefined);
  const filtered = useMemo(
    () => (rangeErr ? [] : filterByDate(transactions, from || undefined, to || undefined)),
    [transactions, from, to, rangeErr],
  );

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="fixed inset-0 bg-black/40 cursor-pointer" onClick={onClose} aria-hidden="true" />
      <dialog
        ref={dialogRef}
        open
        aria-modal="true"
        aria-labelledby="export-wizard-title"
        className="relative z-10 w-full max-w-md rounded-[var(--radius-lg)] bg-[var(--card)] border border-[var(--border)] p-5 shadow-lg max-h-[85dvh] overflow-y-auto"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="export-wizard-title" className="text-base font-bold">{t('export.wizardTitle')}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="min-w-11 min-h-11 grid place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <span aria-hidden className="text-lg leading-none">&times;</span>
          </button>
        </div>
        <p className="text-[11px] font-bold tracking-wide uppercase text-[var(--text-muted)] mt-1 tabular-nums">{step} / 3</p>

        {step === 1 && (
          <div className="mt-3 space-y-2">
            <p className="text-sm font-semibold">{t('export.wizardStep1')}</p>
            {(['json', 'csv'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={`w-full text-left rounded-[var(--radius-md)] border px-3 py-3 transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 ${
                  kind === k ? 'border-[var(--accent)] bg-[var(--accent-soft)]/40' : 'border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--bone)]'
                }`}
              >
                <span className="text-sm font-bold uppercase">{k}</span>
                <span className="block text-xs text-[var(--text-secondary)] mt-0.5">
                  {k === 'json' ? t('export.wizardJsonDesc') : t('export.wizardCsvDesc')}
                </span>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="mt-3 space-y-3">
            <p className="text-sm font-semibold">{t('export.wizardStep2')}</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-[var(--text-secondary)]">{t('settings.from')}</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="mt-1 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-[var(--text-secondary)]">{t('settings.to')}</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-1 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                />
              </label>
            </div>
            {rangeErr === 'from-after-to' && <InlineAlert>{t('settings.fromAfterTo')}</InlineAlert>}
            {rangeErr === 'invalid-date' && <InlineAlert>{t('settings.invalidDate')}</InlineAlert>}
            {!rangeErr && (
              <p aria-live="polite" className="text-xs text-[var(--text-secondary)] tabular-nums">
                {from || to ? t('export.wizardPreview', { count: filtered.length }) : `${t('export.wizardAll')}: ${filtered.length}`}
              </p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="mt-3 space-y-2">
            <p className="text-sm font-semibold">{t('export.wizardStep3')}</p>
            <p className="text-sm text-[var(--text-secondary)]">
              {kind.toUpperCase()} · {from || to ? t('export.wizardPreview', { count: filtered.length }) : `${t('export.wizardAll')}: ${filtered.length}`}
            </p>
            {filtered.length === 0 && <InlineAlert>{t('settings.noExport')}</InlineAlert>}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm font-semibold hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
            >
              {t('export.wizardBack')}
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 2 && rangeErr !== null}
              className="flex-1 min-h-12 rounded-[var(--radius-md)] bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold hover:opacity-90 active:scale-[0.98] disabled:opacity-40 transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
            >
              {t('export.wizardNext')}
            </button>
          ) : (
            <button
              type="button"
              disabled={filtered.length === 0}
              onClick={() => { onExport(kind, from, to); onClose(); }}
              className="flex-1 min-h-12 rounded-[var(--radius-md)] bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold hover:opacity-90 active:scale-[0.98] disabled:opacity-40 transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
            >
              {t('export.wizardExport')}
            </button>
          )}
        </div>
      </dialog>
    </div>
  );
}
