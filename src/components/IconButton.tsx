import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly children: ReactNode;
  readonly variant?: 'default' | 'ghost' | 'danger';
  readonly size?: 'sm' | 'md';
}

const variants = {
  default: 'bg-[var(--bg)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bone)]',
  ghost: 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)]',
  danger: 'bg-transparent text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)]',
};

const sizes = {
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
};

export function IconButton({ children, variant = 'default', size = 'md', className = '', ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`rounded-[var(--radius-md)] grid place-items-center shrink-0 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
