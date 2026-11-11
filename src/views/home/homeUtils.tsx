import type { GroupGranularity } from '../../utils/grouping';
import type { TranslationKey } from '../../i18n/id';

export function highlightMatch(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const lq = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let k = 0;
  for (;;) {
    const idx = lower.indexOf(lq, i);
    if (idx === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(<mark key={k++} className="bg-[var(--warning-soft)] rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>);
    i = idx + q.length;
  }
  return <>{parts}</>;
}

export const GRANULARITY_LABEL_KEY: Record<GroupGranularity, TranslationKey> = {
  day: 'home.groupDay',
  week: 'home.groupWeek',
  month: 'home.groupMonth',
};

export type QuickRange = 'today' | 'week' | 'month' | 'all';

export const QUICK_LABEL_KEY: Record<QuickRange, TranslationKey> = {
  today: 'home.quickToday',
  week: 'home.quick7d',
  month: 'home.quickMonth',
  all: 'home.quickAll',
};
