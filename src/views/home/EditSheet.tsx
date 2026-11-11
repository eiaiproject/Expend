import { useRef, useState } from 'react';
import { X } from 'reicon-react';
import type { Transaction } from '../../db/db';
import { isValidISODate } from '../../utils/date';
import { updateTransaction } from '../../utils/transactionMutations';
import { InlineAlert } from '../../components/InlineAlert';
import { useFocusTrap } from '../../utils/focusTrap';
import { useTranslation } from '../../i18n';

interface EditSheetProps {
  readonly tx: Transaction;
  readonly onClose: () => void;
  readonly onSaved: () => void;
  readonly onError: () => void;
}

export function EditSheet({ tx, onClose, onSaved, onError }: EditSheetProps) {
  const { t } = useTranslation();
  const [description, setDescription] = useState(tx.description);
  const [amount, setAmount] = useState(String(tx.amount));
  const [date, setDate] = useState(tx.date);
  const [source, setSource] = useState(tx.source ?? '');
  const [note, setNote] = useState(tx.note ?? '');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLFormElement>(null);

  useFocusTrap(sheetRef, { onClose, initialFocusRef: firstFieldRef });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !tx.id) return;
    const parsedAmount = Number(amount.replaceAll(/\D/g, ''));
    if (!parsedAmount || parsedAmount <= 0 || parsedAmount > 1_000_000_000_000) {
      setFormError(t('home.invalidAmount'));
      return;
    }
    if (!isValidISODate(date)) {
      setFormError(t('home.invalidDate'));
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      await updateTransaction(tx.id, {
        description: description.trim() || tx.description,
        amount: parsedAmount,
        date,
        source: source.trim() || undefined,
        note: note.trim() || undefined,
      });
      onSaved();
    } catch {
      onError();
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      open
      aria-modal="true"
      aria-label={t('home.editTransaction', { name: tx.description })}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      className="absolute inset-0 z-50 m-0 max-w-none max-h-none w-full h-full bg-transparent text-[var(--text-primary)] overflow-y-auto overflow-x-hidden p-0 md:p-4 motion-safe:animate-[in_0.2s_ease-out]"
    >
      <div className="min-h-full flex items-end md:items-center justify-center">
        <form
          ref={sheetRef}
          onSubmit={handleSave}
          className="w-full md:max-w-md bg-[var(--card)] border border-[var(--border)] rounded-t-[var(--radius-xl)] md:rounded-[var(--radius-xl)] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">{t('home.editTransaction', { name: tx.description })}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('home.cancel')}
              className="min-w-12 min-h-12 grid place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <X size={18} aria-hidden />
            </button>
          </div>

          {formError && <InlineAlert>{formError}</InlineAlert>}

          <label className="block">
            <span className="text-xs font-medium text-[var(--text-secondary)]">{t('home.editDescription')}</span>
            <input
              ref={firstFieldRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="mt-1 w-full min-h-12 px-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-[var(--text-secondary)]">{t('home.editAmount')}</span>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="mt-1 w-full min-h-12 px-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-[var(--text-secondary)]">{t('home.editDate')}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="mt-1 w-full min-h-12 px-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-[var(--text-secondary)]">{t('home.editSource')}</span>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="BCA, GoPay, Tunai"
              className="mt-1 w-full min-h-12 px-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-[var(--text-secondary)]">{t('home.editNote')}</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="mt-1 w-full min-h-12 px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)] resize-none"
            />
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm font-semibold hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
            >
              {t('home.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 min-h-12 rounded-[var(--radius-md)] bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
            >
              {t('home.saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
