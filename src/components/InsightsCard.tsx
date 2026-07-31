import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lightbulb, X } from 'reicon-react';
import type { Insight } from '../services/insightsService';

interface InsightsCardProps {
  readonly insights: Insight[];
  readonly hideAmount: boolean;
  readonly onDismiss: (id: string) => void;
}

const MAX_VISIBLE_INSIGHTS = 3; // master.md 10: no more than three on Home

/**
 * Compact actionable-insights section on Home (master.md 10).
 * Each insight drills down to its source view and can be dismissed.
 */
export function InsightsCard({ insights, hideAmount, onDismiss }: InsightsCardProps) {
  const { t } = useTranslation();
  if (insights.length === 0) return null;

  const visible = insights.slice(0, MAX_VISIBLE_INSIGHTS);

  return (
    <section
      aria-label={t('insight.title')}
      className="rounded-[16px] border border-[var(--border)] bg-[var(--card)] p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-[var(--accent)]/10 p-2 text-[var(--accent)]">
            <Lightbulb size={16} aria-hidden="true" />
          </div>
          <h2 className="font-bold">{t('insight.title')}</h2>
        </div>
      </div>

      <ul className="space-y-2">
        {visible.map((insight) => {
          // Privacy mode (master.md 10): derived percentages are amounts in
          // disguise — hide them rather than leaking spending deltas.
          const params = hideAmount && typeof insight.params.percent === 'number'
            ? { ...insight.params, percent: '••' }
            : insight.params;
          return (
            <li key={insight.id} className="group">
              <div className="flex items-start gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 transition-colors hover:border-[var(--accent)]/40">
                <Link
                  to={insight.target}
                  className="flex-1 min-w-0 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 py-1"
                >
                  {t(insight.titleKey, params)}
                </Link>
                <button
                  type="button"
                  onClick={() => onDismiss(insight.id)}
                  aria-label={t('insight.dismiss')}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
