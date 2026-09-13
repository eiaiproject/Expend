interface PageHeaderProps {
  readonly title: string;
  readonly description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="space-y-1">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] md:text-[26px] font-bold tracking-tight leading-tight">{title}</h1>
          {description && (
            <p className="text-sm text-[var(--text-secondary)] mt-1 leading-snug">{description}</p>
          )}
        </div>
      </div>
    </header>
  );
}
