import type { ReactNode } from 'react';

interface SectionCardProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly padding?: 'sm' | 'md' | 'lg';
}

const paddings = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

export function SectionCard({ children, className = '', padding = 'md' }: SectionCardProps) {
  return (
    <div className={`rounded-[var(--radius-lg)] bg-[var(--card)] border border-[var(--border)] ${paddings[padding]} ${className}`}>
      {children}
    </div>
  );
}
