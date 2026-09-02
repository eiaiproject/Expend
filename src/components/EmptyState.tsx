import type { ReactNode } from 'react';

interface EmptyStateProps {
  readonly icon?: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly children?: ReactNode;
  readonly className?: string;
}

export function EmptyState({ icon, title, description, children, className = '' }: EmptyStateProps) {
  return (
    <div className={`rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] px-6 py-8 text-center ${className}`}>
      {icon && (
        <div className="mx-auto w-14 h-14 rounded-[var(--radius-md)] bg-[var(--accent-soft)] grid place-items-center mb-4">
          {icon}
        </div>
      )}
      <h2 className="text-[15px] font-bold leading-snug">{title}</h2>
      <p className="text-sm text-[var(--text-secondary)] mt-1.5 max-w-[36ch] mx-auto leading-relaxed">{description}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
