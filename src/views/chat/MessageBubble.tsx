import { Link } from 'react-router-dom';
import type { ChatMessage } from '../../db/db';
import type { AppLang } from '../../utils/format';
import { fmtTime } from '../../utils/format';
import { useTranslation } from '../../i18n';

export function MessageBubble({ message, showTime, lang }: { readonly message: ChatMessage; readonly showTime: boolean; readonly lang: AppLang }) {
  const { t } = useTranslation();
  return (
    <div className="flex motion-safe:animate-[in_0.2s_ease-out] motion-reduce:animate-none" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 96px' } as React.CSSProperties}>
      <div className={`flex w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-[76%]">
          <div
            className={`px-4 py-3 text-sm leading-[22px] ${
              message.role === 'user'
                ? 'bg-[var(--accent-fill)] text-[var(--accent-ink)] rounded-[var(--radius-lg)] rounded-br-[var(--radius-sm)]'
                : 'bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-lg)] rounded-bl-[var(--radius-sm)]'
            }`}
          >
            {message.text === '__LINK_RINGKASAN__' ? (
              <Link to="/" className="text-sm font-semibold text-[var(--accent)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 rounded">
                {t('chat.viewSummary')}
              </Link>
            ) : (
              <p className="whitespace-pre-wrap break-words">{message.text}</p>
            )}
          </div>
          {showTime && (
            <p className={`mt-1 text-xs tabular-nums ${message.role === 'user' ? 'text-right text-[var(--text-muted)]' : 'text-[var(--text-muted)]'}`}>
              {fmtTime(message.createdAt, lang)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
