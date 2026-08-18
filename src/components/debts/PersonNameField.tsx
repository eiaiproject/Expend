import { useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDismissOnOutsideTap } from '../../hooks/useDismissOnOutsideTap';

interface PersonNameFieldProps {
  readonly id: string;
  readonly value: string;
  readonly suggestions: readonly string[];
  readonly onChange: (value: string) => void;
}

function navigateSuggestions(
  e: KeyboardEvent<HTMLInputElement>,
  suggestions: readonly string[],
  showSuggestions: boolean,
  suggestionIndexRef: React.RefObject<number>,
  onSelect: (name: string) => void,
  onClose: () => void,
): void {
  if (!showSuggestions || suggestions.length === 0) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    suggestionIndexRef.current = Math.min(suggestionIndexRef.current + 1, suggestions.length - 1);
    onSelect(suggestions[suggestionIndexRef.current]!);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    suggestionIndexRef.current = Math.max(suggestionIndexRef.current - 1, 0);
    onSelect(suggestions[suggestionIndexRef.current]!);
  } else if (e.key === 'Enter' && suggestionIndexRef.current >= 0) {
    e.preventDefault();
    onSelect(suggestions[suggestionIndexRef.current]!);
    onClose();
  }
}

/**
 * Person (debtor/creditor) name input with a suggestion dropdown fed by
 * previously-used names. Extracted from DebtFormSheet to keep the form's
 * cognitive complexity within the S3776 limit.
 */
export function PersonNameField({ id, value, suggestions, onChange }: PersonNameFieldProps) {
  const { t } = useTranslation();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionIndexRef = useRef(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  // Friction audit B4: click-outside instead of the racy setTimeout-on-blur.
  useDismissOnOutsideTap(containerRef, showSuggestions && suggestions.length > 0, () => setShowSuggestions(false));

  const selectSuggestion = (name: string) => {
    onChange(name);
    setShowSuggestions(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <label htmlFor={id} className="block text-sm font-medium mb-1.5">
        {t('debt.formPerson')} *
      </label>
      <input
        id={id}
        type="text"
        required
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={(e) => navigateSuggestions(
          e,
          suggestions,
          showSuggestions,
          suggestionIndexRef,
          selectSuggestion,
          () => setShowSuggestions(false),
        )}
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
        autoComplete="off"
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] py-1 shadow-lg max-h-48 overflow-auto">
          {suggestions.map((name) => (
            <li key={name}>
              <button
                type="button"
                onMouseDown={() => selectSuggestion(name)}
                className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--bg)] transition-colors"
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
