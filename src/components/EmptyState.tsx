import { ClipboardList } from 'reicon-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  readonly icon?: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly action?: {
    readonly label: string;
    readonly onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-16 flex flex-col items-center">
      <div className="bg-[var(--card)] w-24 h-24 rounded-full flex items-center justify-center mb-4 border border-[var(--border)] text-[var(--accent)] shadow-inner">
        <span aria-hidden="true">{icon || <ClipboardList size={48} className="opacity-20" />}</span>
      </div>
      <h3 className="font-bold text-[var(--text-primary)]">{title}</h3>
      <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-[240px]">
        {description}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 px-6 py-3 bg-[var(--accent-fill)] text-[var(--accent-ink)] rounded-xl font-bold shadow-lg shadow-[var(--accent-fill)]/20 active:scale-95 transition-transform hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--accent-fill)]/30"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
