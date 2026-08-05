import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'reicon-react';

interface PageHeaderProps {
  readonly title: string;
  /** Optional concise description under the title. */
  readonly description?: ReactNode;
  /** Up to two secondary actions; additional actions belong in an overflow menu. */
  readonly actions?: ReactNode;
  /** Renders a 44px back button before the title. */
  readonly onBack?: () => void;
  /** Accessible name for the back button (defaults to localized "Back"). */
  readonly backLabel?: string;
}

/**
 * Shared page-header contract (master.md §3.2): one H1, optional description,
 * primary/secondary actions on the right. Every route-level page uses this so
 * spacing, heading size, and back placement stay identical.
 */
export function PageHeader({ title, description, actions, onBack, backLabel }: PageHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2 min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] transition-colors hover:bg-[var(--border)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            aria-label={backLabel ?? t('Back')}
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl tracking-tight truncate" style={{ fontFamily: 'var(--font-display)' }}>
            {title}
          </h1>
          {description && <div className="text-xs text-[var(--text-secondary)] mt-1">{description}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
