import { Check, X } from 'reicon-react';
import { useTranslation } from '../../i18n';
import { fmtIDR } from '../../utils/format';

export type Pending = { description: string; amount: number; date: string; note?: string; source?: string };

interface PendingCardProps {
  readonly pending: Pending;
  readonly editable: boolean;
  readonly saving: boolean;
  readonly ocrConfidence: number | null;
  readonly onToggleEdit: () => void;
  readonly onChange: (pending: Pending) => void;
  readonly onSave: () => void;
  readonly onCancel: () => void;
}

export function PendingCard({
  pending,
  editable,
  saving,
  ocrConfidence,
  onToggleEdit,
  onChange,
  onSave,
  onCancel,
}: PendingCardProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--accent)] bg-[var(--card)] p-5 overflow-clip motion-safe:animate-[in_0.2s_ease-out] motion-reduce:animate-none">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-[var(--accent-fill)] text-[var(--accent-ink)] grid place-items-center">
          <Check size={14} aria-hidden />
        </div>
        <p className="text-xs font-bold tracking-wide uppercase text-[var(--accent)]">{t('chat.checkTransaction')}</p>
        <button
          type="button"
          onClick={onToggleEdit}
          aria-expanded={editable}
          className="ml-auto text-xs font-semibold text-[var(--accent)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 rounded px-1 min-h-8"
        >
          {t('chat.pendingEdit')}
        </button>
      </div>
      <p className="mt-3 text-sm font-bold leading-snug break-words">{pending.description}</p>
      <p className="mt-1 text-xs text-[var(--text-secondary)] tabular-nums">
        {fmtIDR(pending.amount || 0)} &middot; {pending.date}{pending.source ? ` · ${pending.source}` : ''}
      </p>
      {pending.note && (
        <p className="mt-1 text-xs text-[var(--text-secondary)] break-words">
          {t('chat.note')}: {pending.note}
        </p>
      )}
      {ocrConfidence !== null && (
        <div className="mt-2 space-y-1">
          <p className="text-xs font-semibold text-[var(--text-secondary)] tabular-nums" aria-live="polite">
            {t('chat.ocrConfidence', { value: ocrConfidence })}
          </p>
          <p className="text-xs text-[var(--text-muted)]">{t('chat.ocrPriorityNote')}</p>
        </div>
      )}
      {(editable || !pending.amount) && (
        <div className="mt-4 space-y-3 border-t border-[var(--border)]/60 pt-4">
          <label htmlFor="pending-desc" className="block">
            <span className="text-xs font-medium text-[var(--text-secondary)]">{t('chat.description')}</span>
            <input
              id="pending-desc"
              value={pending.description}
              onChange={(e) => onChange({ ...pending, description: e.target.value })}
              autoComplete="off"
              placeholder={t('chat.descPlaceholder')}
              className="mt-1 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label htmlFor="pending-amount" className="block">
              <span className="text-xs font-medium text-[var(--text-secondary)]">{t('chat.amount')}</span>
              <input
                id="pending-amount"
                type="number"
                inputMode="numeric"
                min="0"
                max="1000000000000"
                step="1"
                value={pending.amount || ''}
                onChange={(e) => {
                  const v = Math.max(0, Number(e.target.value) || 0);
                  onChange({ ...pending, amount: v });
                }}
                placeholder="50000"
                className="mt-1 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]"
              />
            </label>
            <label htmlFor="pending-date" className="block">
              <span className="text-xs font-medium text-[var(--text-secondary)]">{t('chat.date')}</span>
              <input
                id="pending-date"
                type="date"
                value={pending.date}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^\d{4}-\d{2}-\d{2}$/.test(v) || v === '') onChange({ ...pending, date: v });
                }}
                className="mt-1 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]"
              />
            </label>
          </div>
          <label htmlFor="pending-source" className="block">
            <span className="text-xs font-medium text-[var(--text-secondary)]">{t('chat.source')}</span>
            <input
              id="pending-source"
              value={pending.source ?? ''}
              onChange={(e) => onChange({ ...pending, source: e.target.value })}
              autoComplete="off"
              placeholder={t('chat.sourcePlaceholder')}
              className="mt-1 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]"
            />
          </label>
          <label htmlFor="pending-note" className="block">
            <span className="text-xs font-medium text-[var(--text-secondary)]">{t('chat.note')} <span className="text-[var(--text-muted)]">({t('chat.noteOptional')})</span></span>
            <input
              id="pending-note"
              value={pending.note ?? ''}
              onChange={(e) => onChange({ ...pending, note: e.target.value })}
              autoComplete="off"
              placeholder={t('chat.notePlaceholder')}
              className="mt-1 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]"
            />
          </label>
        </div>
      )}
      <div className="sticky bottom-0 -mx-5 -mb-5 mt-4 border-t border-[var(--border)]/60 bg-[var(--card)] px-5 pb-5 pt-3 flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!pending.amount || saving}
          className="flex-1 min-h-12 py-3 rounded-[var(--radius-md)] bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold inline-flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
        >
          <Check size={16} aria-hidden />
          {t('chat.saveTransaction')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-12 px-5 rounded-[var(--radius-md)] bg-[var(--card)] border border-[var(--border)] text-sm font-semibold inline-flex items-center gap-2 hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
        >
          <X size={16} aria-hidden />
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
