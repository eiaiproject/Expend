import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Coffee, X } from 'reicon-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  TRAKTEER_URL,
  evaluateSupportPromptNow,
  recordSupportPromptShown,
  dismissSupportPrompt,
  recordSupportClick,
  type SupportPromptEvaluation,
} from '../services/supportService';

/**
 * Contextual support prompt (master.md 9.4 / 9.5).
 *
 * Appears after positive moments (first backup, restore, settled debt,
 * 100 transactions, 30 days of use) and respects strict cooldowns:
 * at most once per 60 days, never before meaningful use, and long
 * suppression after a support action is clicked.
 *
 * Evaluated on mount and when the window regains focus — never on every
 * navigation. The app shell only renders it after onboarding completes
 * and the app is unlocked, so it cannot appear during onboarding or while
 * locked.
 */
export function SupportPrompt() {
  const { t } = useTranslation();
  const [decision, setDecision] = useState<SupportPromptEvaluation | null>(null);
  const dialogRef = useFocusTrap(decision !== null);

  const evaluate = useCallback(async () => {
    if (decision) return; // already showing
    const result = await evaluateSupportPromptNow();
    if (result.show && result.milestoneKey) {
      setDecision(result);
      // Record immediately so the same milestone never re-prompts
      void recordSupportPromptShown(result.milestoneKey);
    }
  }, [decision]);

  // Evaluate on mount
  useEffect(() => {
    void evaluate();
  }, [evaluate]);

  // Re-check when the window regains focus (e.g. returning after a backup)
  useEffect(() => {
    const onFocus = () => void evaluate();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [evaluate]);

  const handleDismiss = useCallback(async () => {
    await dismissSupportPrompt();
    setDecision(null);
  }, []);

  // The anchor's default target="_blank" handles the single new tab;
  // this only records the click and closes the prompt (no window.open).
  const handleSupportClick = useCallback(async () => {
    await recordSupportClick();
    setDecision(null);
  }, []);

  // Esc closes and dismisses
  useEffect(() => {
    if (!decision) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void handleDismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [decision, handleDismiss]);

  if (!decision) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <dialog
        open
        aria-modal="true"
        aria-labelledby="support-prompt-title"
        className="bg-[var(--card)] text-[var(--text-primary)] w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-0 border-0 backdrop:bg-transparent m-0"
      >
        <button
          type="button"
          onClick={() => void handleDismiss()}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-[var(--border)] transition-colors"
          aria-label={t('support.promptClose')}
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div className="p-6 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center">
            <Coffee size={26} className="text-[var(--accent)]" aria-hidden="true" />
          </div>
          <h2 id="support-prompt-title" className="text-lg font-bold text-[var(--text-primary)]">
            {t('support.promptTitle')}
          </h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            {t('support.promptBody')}
          </p>

          <div className="w-full space-y-2 mt-2">
            <a
              href={TRAKTEER_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void handleSupportClick()}
              className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-[var(--accent-fill)] text-[var(--accent-ink)] font-bold active:scale-95 transition-transform shadow-lg shadow-[var(--accent-fill)]/20"
              aria-label={t('support.promptAction')}
            >
              {t('support.promptAction')}
              <span className="text-xs opacity-70">↗</span>
            </a>
            <button
              type="button"
              onClick={() => void handleDismiss()}
              className="w-full h-11 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg)] transition-colors"
            >
              {t('support.promptDismiss')}
            </button>
          </div>

          <p className="text-xs text-[var(--text-secondary)]/70">
            {t('support.promptNote')}
          </p>
        </div>
      </dialog>
    </div>
  );
}
