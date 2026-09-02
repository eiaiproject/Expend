import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface SecondaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly children: ReactNode;
  readonly fullWidth?: boolean;
}

export function SecondaryButton({ children, fullWidth = false, className = '', ...props }: SecondaryButtonProps) {
  return (
    <button
      type="button"
      className={`min-h-12 px-5 rounded-[var(--radius-md)] bg-[var(--card)] border border-[var(--border)] text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-[var(--bone)] active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
