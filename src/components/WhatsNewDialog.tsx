import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, X } from 'reicon-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  getLastSeenVersion,
  getReleaseNotesSince,
  markVersionSeen,
  type ReleaseNote,
} from '../services/releaseNotesService';

/**
 * "What's New" version-change popup (master.md release notes).
 *
 * Appears once after the app is updated: it lists the changes for every
 * released version newer than the last one the user acknowledged, newest
 * first. Dismissing (or pressing Esc) records the current version so it is
 * not shown again until the next release. Brand-new users never see it.
 *
 * Evaluated on mount, like SupportPrompt — the app shell only renders it
 * after onboarding completes and the app is unlocked.
 */
export function WhatsNewDialog() {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<ReleaseNote[] | null>(null);
  const dialogRef = useFocusTrap(notes !== null && notes.length > 0);

  // Evaluate once on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const lastSeen = await getLastSeenVersion();
      if (cancelled) return;
      const current = __APP_VERSION__;
      const newer = getReleaseNotesSince(lastSeen, current);
      if (newer.length > 0) {
        setNotes(newer);
      } else if (lastSeen !== current) {
        // Nothing to announce (first launch or no curated notes for the gap) —
        // keep the stored version current so a stale value cannot resurface
        // the popup later. Skipped when already up to date to avoid a
        // redundant write on every launch.
        await markVersionSeen(current);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleClose = useCallback(async () => {
    await markVersionSeen(__APP_VERSION__);
    setNotes(null);
  }, []);

  // Esc closes and records the version as seen.
  useEffect(() => {
    if (!notes) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void handleClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [notes, handleClose]);

  if (!notes || notes.length === 0) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <dialog
        open
        aria-modal="true"
        aria-labelledby="whats-new-title"
        className="bg-[var(--card)] text-[var(--text-primary)] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative p-0 border-0 backdrop:bg-transparent m-0"
      >
        <button
          type="button"
          onClick={() => void handleClose()}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-[var(--border)] transition-colors"
          aria-label={t('whatsNew.close')}
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div className="p-6 flex flex-col items-center text-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center">
            <Sparkles size={26} className="text-[var(--accent)]" aria-hidden="true" />
          </div>
          <h2 id="whats-new-title" className="text-lg font-bold">
            {t('whatsNew.title')}
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {t('whatsNew.version', { version: __APP_VERSION__ })}
          </p>
        </div>

        <div className="px-6 pb-2 max-h-[45vh] overflow-y-auto space-y-4 text-left">
          {notes.map((note) => (
            <section key={note.version} aria-label={`v${note.version}`}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                v{note.version}
              </h3>
              <ul className="space-y-2">
                {note.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm leading-relaxed">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[var(--accent)] shrink-0" aria-hidden="true" />
                    <span>{t(item)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="p-6 pt-4">
          <button
            type="button"
            onClick={() => void handleClose()}
            className="w-full h-12 rounded-xl bg-[var(--accent-fill)] text-[var(--accent-ink)] font-bold active:scale-95 transition-transform shadow-lg shadow-[var(--accent-fill)]/20"
          >
            {t('whatsNew.gotIt')}
          </button>
        </div>
      </dialog>
    </div>
  );
}
