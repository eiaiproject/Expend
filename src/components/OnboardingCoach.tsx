import { useRef, useState } from 'react';
import { useTranslation } from '../i18n';
import { useFocusTrap } from '../utils/focusTrap';
import { fmtIDR } from '../utils/format';

const EXAMPLES = ['kopi 25rb dari BSI', 'bayar listrik 200rb via GoPay', 'makan siang 30rb kemarin'];

export function OnboardingCoach({
  open,
  onClose,
  onTryExample,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onTryExample: (example: string) => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(dialogRef, { onClose, initialFocusRef: skipRef, active: open });
  if (!open) return null;
  const last = step === 3;
  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="fixed inset-0 bg-black/40 cursor-pointer" onClick={onClose} aria-hidden="true" />
      <dialog
        ref={dialogRef}
        open
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="relative z-10 w-full max-w-md rounded-[var(--radius-lg)] bg-[var(--card)] text-[var(--text-primary)] border border-[var(--border)] p-5 shadow-lg motion-safe:animate-[in_0.2s_ease-out] motion-reduce:animate-none"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold tracking-wide uppercase text-[var(--text-muted)] tabular-nums">
            {step + 1} / 4
          </p>
          <button
            ref={skipRef}
            type="button"
            onClick={onClose}
            className="min-h-11 px-3 rounded-[var(--radius-md)] text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bone)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
          >
            {t('onboarding.skip')}
          </button>
        </div>
        <h2 id="onboarding-title" className="text-base font-bold leading-snug mt-1">{t('onboarding.title')}</h2>

        {step === 0 && (
          <div className="mt-2">
            <p className="text-sm font-semibold">{t('onboarding.step1Title')}</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">{t('onboarding.step1Desc')}</p>
          </div>
        )}
        {step === 1 && (
          <div className="mt-2">
            <p className="text-sm font-semibold">{t('onboarding.step2Title')}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{t('onboarding.step2Desc')}</p>
            <div className="mt-3 space-y-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  aria-label={t('chat.useExample', { example: ex })}
                  onClick={() => onTryExample(ex)}
                  className="w-full text-left font-mono text-xs rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 hover:bg-[var(--bone)] active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="mt-2">
            <p className="text-sm font-semibold">{t('onboarding.step3Title')}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{t('onboarding.step3Desc')}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs" aria-hidden="true">
              <span className="rounded-full bg-[var(--bone)] border border-[var(--border)] px-2.5 py-1 font-medium">Kopi</span>
              <span className="rounded-full bg-[var(--success-soft)] text-[var(--success)] px-2.5 py-1 font-bold tabular-nums">{fmtIDR(25000)}</span>
              <span className="rounded-full bg-[var(--info-soft)] text-[var(--info)] px-2.5 py-1 font-semibold">BSI</span>
            </div>
            <p className="font-mono text-[11px] text-[var(--text-muted)] mt-2">kopi 25rb dari BSI</p>
          </div>
        )}
        {step === 3 && (
          <div className="mt-2">
            <p className="text-sm font-semibold">{t('onboarding.step4Title')}</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">{t('onboarding.step4Desc')}</p>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm font-semibold hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
            >
              {t('onboarding.back')}
            </button>
          )}
          {!last ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="flex-1 min-h-12 rounded-[var(--radius-md)] bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
            >
              {t('onboarding.next')}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-12 rounded-[var(--radius-md)] bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
            >
              {t('onboarding.done')}
            </button>
          )}
        </div>
      </dialog>
      <style>{String.raw`@keyframes in { from { opacity:0; transform: translateY(4px)} to { opacity:1; transform: translateY(0)} }`}</style>
    </div>
  );
}
