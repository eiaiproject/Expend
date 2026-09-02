import type { ReactNode } from 'react';
import { AlertCircle, Information } from 'reicon-react';

interface InlineAlertProps {
  readonly type?: 'error' | 'info';
  readonly children: ReactNode;
  readonly className?: string;
}

export function InlineAlert({ type = 'error', children, className = '' }: InlineAlertProps) {
  const Icon = type === 'error' ? AlertCircle : Information;
  const bg = type === 'error' ? 'bg-[var(--danger-bg)] border-[var(--danger-border)] text-[var(--danger)]' : 'bg-[var(--accent-soft)] border-[var(--border)] text-[var(--text-secondary)]';

  return (
    <div
      role={type === 'error' ? 'alert' : undefined}
      className={`text-xs px-3 py-2.5 rounded-[var(--radius-md)] border flex items-start gap-2 ${bg} ${className}`}
    >
      <Icon size={14} className="shrink-0 mt-0.5" aria-hidden />
      <span>{children}</span>
    </div>
  );
}
