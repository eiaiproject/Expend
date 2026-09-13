import type { ReactNode } from 'react';
import { AlertCircle } from 'reicon-react';

interface InlineAlertProps {
  readonly children: ReactNode;
}

export function InlineAlert({ children }: InlineAlertProps) {
  return (
    <div
      role="alert"
      className="text-xs px-3 py-2.5 rounded-[var(--radius-md)] border flex items-start gap-2 bg-[var(--danger-bg)] border-[var(--danger-border)] text-[var(--danger-deep)]"
    >
      <AlertCircle size={14} className="shrink-0 mt-0.5" aria-hidden />
      <span>{children}</span>
    </div>
  );
}
