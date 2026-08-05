import { type ChangeEvent } from 'react';
import { formatAmountInput } from '../utils/formatUtils';

interface AmountInputProps {
  readonly id: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly label: string;
  readonly required?: boolean;
  readonly placeholder?: string;
  readonly disabled?: boolean;
}

/**
 * Numeric amount input with currency symbol prefix.
 * Handles formatting (group separators) on input.
 */
export function AmountInput({
  id,
  value,
  onChange,
  label,
  required = true,
  placeholder = '0',
  disabled = false,
}: AmountInputProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-[var(--text-secondary)]">
          Rp
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          required={required}
          disabled={disabled}
          value={value}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange(formatAmountInput(event.target.value))
          }
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] py-3 pl-12 pr-4 font-mono text-xl font-bold focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow] disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder={placeholder}
          autoComplete="off"
        />
      </div>
    </div>
  );
}