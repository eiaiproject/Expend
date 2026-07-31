import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarDays, ChevronRight, Handshake, ReceiptText } from 'reicon-react';
import { displayDateMedium } from '../utils/dateUtils';
import type { UpcomingItem } from '../services/recurringService';
import { formatCurrency } from '../utils/formatUtils';
import { cn } from '../utils/cn';

const MAX_VISIBLE_ITEMS = 3;

interface UpcomingSectionProps {
  readonly items: UpcomingItem[];
  readonly hideAmount?: boolean;
  /** Label for the frequency, e.g. t('recurring.freqMonthly'). */
  readonly frequencyLabel: (frequency: string) => string;
  readonly viewAllTarget: string;
}

function urgencyLabel(
  urgency: UpcomingItem['urgency'],
  date: string,
  locale: string,
  t: (key: string, options?: Record<string, string | number>) => string,
): string {
  if (urgency === 'overdue') return t('upcoming.overdue');
  if (urgency === 'today') return t('upcoming.today');
  return t('upcoming.inDays', { date: displayDateMedium(date, locale) });
}

/** Icon container tone for an upcoming item (avoids a nested ternary). */
function itemIconTone(item: UpcomingItem): string {
  if (item.urgency === 'overdue') return 'bg-red-500/10 text-red-500';
  if (item.kind === 'debt') return 'bg-[var(--accent)]/10 text-[var(--accent)]';
  return 'bg-amber-500/10 text-amber-500';
}

/** Secondary label under an item title (avoids a nested ternary). */
function itemKindLabel(
  item: UpcomingItem,
  frequencyLabel: UpcomingSectionProps['frequencyLabel'],
  t: (key: string, options?: Record<string, string | number>) => string,
): string {
  if (item.kind === 'schedule') return frequencyLabel(item.frequency);
  return item.type === 'payable' ? t('upcoming.payable') : t('upcoming.receivable');
}

/**
 * Compact Upcoming section on Home (master.md 7.4).
 * Shows at most three items: schedule occurrences and debt due dates.
 */
export function UpcomingSection({ items, hideAmount = false, frequencyLabel, viewAllTarget }: UpcomingSectionProps) {
  const { t, i18n } = useTranslation();
  if (items.length === 0) return null;

  const visible = items.slice(0, MAX_VISIBLE_ITEMS);
  const hasMore = items.length > MAX_VISIBLE_ITEMS;

  return (
    <section
      aria-label={t('upcoming.title')}
      className="rounded-[16px] border border-[var(--border)] bg-[var(--card)] p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-[var(--accent)]/10 p-2 text-[var(--accent)]">
            <CalendarDays size={16} aria-hidden="true" />
          </div>
          <h2 className="font-bold">{t('upcoming.title')}</h2>
        </div>
        <Link
          to={viewAllTarget}
          className="inline-flex min-h-[44px] items-center gap-0.5 text-xs font-bold text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 rounded-md px-1"
        >
          {t('upcoming.viewAll')}
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      </div>

      <ul className="space-y-2">
        {visible.map((item) => (
          <li key={item.id}>
            <Link
              to={item.target}
              className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 transition-colors hover:border-[var(--accent)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
            >
              <div
                className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', itemIconTone(item))}
                aria-hidden="true"
              >
                {item.kind === 'debt' ? <Handshake size={16} /> : <ReceiptText size={16} />}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[var(--text-primary)]">{item.title}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                  {item.urgency === 'overdue' && (
                    <AlertTriangle size={12} className="shrink-0 text-red-500" aria-hidden="true" />
                  )}
                  {itemKindLabel(item, frequencyLabel, t)}
                  <span aria-hidden="true">•</span>
                  {urgencyLabel(item.urgency, item.date, i18n.language, t)}
                </p>
              </div>

              <p className="shrink-0 font-mono text-sm font-bold text-[var(--text-primary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {hideAmount ? '•••••' : formatCurrency(item.amount)}
              </p>
              <ChevronRight size={14} className="shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>

      {hasMore && (
        <p className="mt-2 text-center text-xs font-bold text-[var(--text-secondary)]">
          {t('upcoming.moreCount', { count: items.length - MAX_VISIBLE_ITEMS })}
        </p>
      )}
    </section>
  );
}
