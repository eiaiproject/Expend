interface SkeletonCardProps {
  readonly lines?: number;
  readonly className?: string;
}

export function SkeletonCard({ lines = 2, className = '' }: SkeletonCardProps) {
  return (
    <output className={`rounded-[var(--radius-lg)] bg-[var(--card)] border border-[var(--border)] p-4 space-y-3 animate-pulse ${className}`} aria-live="polite" aria-label="Memuat data">
      <span className="sr-only">Memuat...</span>
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--border)]" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 rounded bg-[var(--border)]" />
          <div className="h-5 w-32 rounded bg-[var(--border)]" />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={`skeleton-${i}`} className="flex items-center gap-3"> // NOSONAR - static skeleton
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-3/4 rounded bg-[var(--border)]" />
            <div className="h-3 w-1/3 rounded bg-[var(--border)]" />
          </div>
          <div className="h-4 w-20 rounded bg-[var(--border)]" />
        </div>
      ))}
    </output>
  );
}
