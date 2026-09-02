import type { ReactNode } from 'react';

interface StatusBadgeProps {
  readonly children: ReactNode;
  readonly variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  readonly className?: string;
}

const variants = {
  default: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  success: 'bg-[var(--success-soft)] text-[var(--success)]',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  error: 'bg-[var(--danger-soft)] text-[var(--danger)]',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

export function StatusBadge({ children, variant = 'default', className = '' }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
