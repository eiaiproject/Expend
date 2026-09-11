import type { ReactNode } from 'react';

interface StatusBadgeProps {
  readonly children: ReactNode;
  readonly variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  readonly className?: string;
}

const variants = {
  default: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  success: 'bg-[var(--success-soft)] text-[var(--success)]',
  // C7: Gunakan CSS variables konsisten dengan komponen lain,
  // bukan Tailwind dark: modifier yang tidak ikut custom theme override.
  warning: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  error: 'bg-[var(--danger-soft)] text-[var(--danger)]',
  info: 'bg-[var(--info-soft)] text-[var(--info)]',
};

export function StatusBadge({ children, variant = 'default', className = '' }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
