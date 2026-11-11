import { useId } from 'react';
import { ChevronDown } from 'reicon-react';

export function SettingsSection({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <h2 id={headingId} className="text-xs font-bold tracking-wide uppercase text-[var(--text-secondary)] px-1">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsRow({
  icon,
  iconBg = 'bg-[var(--accent-soft)]',
  iconColor = 'text-[var(--accent)]',
  title,
  description,
  action,
  trailing,
}: {
  readonly icon: React.ReactNode;
  readonly iconBg?: string;
  readonly iconColor?: string;
  readonly title: string;
  readonly description?: string;
  readonly action?: () => void;
  readonly trailing?: React.ReactNode;
}) {
  const Tag = action ? 'button' : 'div';
  return (
    <Tag
      type={action ? 'button' : undefined}
      onClick={action}
      className={`flex items-center gap-3 px-4 py-3 w-full text-left ${action ? 'hover:bg-[var(--bg)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 rounded-[var(--radius-md)]' : ''}`}
    >
      <div className={`w-9 h-9 rounded-[var(--radius-md)] ${iconBg} grid place-items-center shrink-0`}>
        <div className={iconColor}>{icon}</div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">{title}</p>
        {description && <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">{description}</p>}
      </div>
      {trailing ?? (action && <ChevronDown size={16} className="text-[var(--text-muted)] shrink-0 pointer-events-none" aria-hidden />)}
    </Tag>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  readonly checked: boolean;
  readonly onChange: (v: boolean) => void;
  readonly label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative flex items-center min-h-12 min-w-12 justify-center focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 rounded-[var(--radius-md)]"
    >
      <div
        className={`relative w-11 h-6 rounded-full transition-colors ${
          checked ? 'bg-[var(--accent-fill)]' : 'bg-[var(--border-strong)]'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-[var(--accent-ink)] shadow-sm transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
          aria-hidden
        />
      </div>
    </button>
  );
}
