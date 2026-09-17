import { useMemo } from 'react';
import { parseChatInput } from '../utils/chatParser';
import { extractChatDate } from '../utils/chatParser';
import { todayLocalISO } from '../utils/date';
import { fmtIDR } from '../utils/format';
import { useTranslation } from '../i18n';
import { InlineAlert } from './InlineAlert';

interface Parts {
  description: string;
  amount: number;
  source?: string;
  date?: string;
  /** Tanggal eksplisit/relatif di input (bukan default hari ini). */
  dateBadge: string | null;
}

/** Parse sinkron murni untuk badge live (presentation layer; parser tak diubah). */
export function getLiveParts(raw: string): Parts | null {
  const text = raw.trim();
  if (!text) return null;
  let parsed: ReturnType<typeof parseChatInput>;
  try {
    parsed = parseChatInput(text);
  } catch {
    return null;
  }
  if (!parsed) return null;
  const lower = text.toLowerCase();
  const hasDateWord =
    lower.includes('kemarin') || lower.includes('kemaren') || lower.includes('lusa') ||
    lower.includes('hari ini') || /\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(text) ||
    /(?:tgl|tanggal)\s+\d{1,2}/i.test(text);
  let dateBadge: string | null = null;
  if (hasDateWord) {
    try {
      const d = extractChatDate(text);
      dateBadge = d === todayLocalISO() && !lower.includes('hari ini') ? d : d;
    } catch {
      dateBadge = parsed.date ?? null;
    }
  }
  return { description: parsed.description, amount: parsed.amount, source: parsed.source, date: parsed.date, dateBadge };
}

export function hasDigits(s: string): boolean {
  return /\d/.test(s);
}

/**
 * Feedback parsing real-time: badge per komponen + InlineAlert actionable
 * saat gagal parse. Input `debounced` dari parent (300ms) agar <350ms.
 */
export function LiveParseFeedback({ debounced }: { readonly debounced: string }) {
  const { t } = useTranslation();
  const parts = useMemo(() => getLiveParts(debounced), [debounced]);
  const text = debounced.trim();
  if (!text) return null;
  if (!parts) {
    if (!hasDigits(text)) return null;
    return (
      <div className="mb-2">
        <InlineAlert>{t('chat.parseTooSmall')}</InlineAlert>
      </div>
    );
  }
  return (
    <div aria-live="polite" className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="inline-flex items-center rounded-full bg-[var(--bone)] border border-[var(--border)] px-2.5 py-1 font-medium max-w-[12rem] truncate">
        {parts.description}
      </span>
      <span className="inline-flex items-center rounded-full bg-[var(--success-soft)] text-[var(--success)] border border-[var(--success)]/20 px-2.5 py-1 font-bold tabular-nums">
        {fmtIDR(parts.amount)}
      </span>
      {parts.source && (
        <span className="inline-flex items-center rounded-full bg-[var(--info-soft)] text-[var(--info)] border border-[var(--info)]/20 px-2.5 py-1 font-semibold">
          {parts.source}
        </span>
      )}
      {parts.dateBadge && (
        <span className="inline-flex items-center rounded-full bg-[var(--bg)] text-[var(--text-secondary)] border border-[var(--border)] px-2.5 py-1 tabular-nums">
          {parts.dateBadge}
        </span>
      )}
    </div>
  );
}
