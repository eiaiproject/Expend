import { useId, useState, useCallback } from 'react';
import { ChevronDown } from 'reicon-react';

interface SettingsAccordionProps {
  readonly title: string;
  readonly defaultOpen?: boolean;
  readonly children: React.ReactNode;
}

export function SettingsAccordion({ title, defaultOpen = false, children }: SettingsAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const triggerId = useId();
  const contentId = useId();

  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  return (
    <section className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between p-4 min-h-[44px]"
        id={triggerId}
        aria-expanded={isOpen}
        aria-controls={contentId}
      >
        <span className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">{title}</span>
        <ChevronDown
          size={20}
          className={`text-[var(--text-secondary)] transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
          aria-hidden="true"
        />
      </button>
      {isOpen && (
        <div
          id={contentId}
          role="region" // NOSONAR: S6819 — div with aria-label is valid landmark region
          aria-labelledby={triggerId}
          className="overflow-hidden bg-[var(--bg)] border-t border-[var(--border)]"
        >
          {children}
        </div>
      )}
    </section>
  );
}
