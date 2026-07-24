import { Fragment, useMemo } from 'react';

interface SearchHighlightProps {
  readonly text: string;
  readonly searchTerm: string;
  readonly className?: string;
}

/**
 * Renders text with matching search terms highlighted using <mark> elements.
 * Case-insensitive matching. If no search term is provided, renders plain text.
 */
export function SearchHighlight({ text, searchTerm, className }: SearchHighlightProps) {
  const normalizedSearchTerm = searchTerm?.trim() || '';
  
  const regex = useMemo(() => {
    if (!normalizedSearchTerm) return null;
    const escaped = normalizedSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(${escaped})`, 'gi');
  }, [normalizedSearchTerm]);

  const parts = useMemo(() => {
    if (!regex) return null;
    return text.split(regex);
  }, [text, regex]);

  if (!regex || !parts || parts.length === 1) {
    // No search term or no match found
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={`${part}-${i}`}
            className="bg-[var(--accent)]/20 text-[var(--accent)] rounded-sm px-0.5 font-medium"
          >
            {part}
          </mark>
        ) : (
          <Fragment key={`${part}-${i}`}>{part}</Fragment>
        )
      )}
    </span>
  );
}
