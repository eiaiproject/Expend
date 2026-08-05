import { useTranslation } from 'react-i18next';

interface WalletNameFieldProps {
  readonly id: string;
  readonly inputRef: React.RefObject<HTMLInputElement | null>;
  readonly value: string;
  readonly error: string;
  readonly onChange: (value: string) => void;
  readonly onKeyDown: (e: React.KeyboardEvent) => void;
  readonly placeholder?: string;
}

/**
 * Wallet name input + inline validation error. Shared by AddWalletSheet and
 * EditWalletSheet so both sheets use one implementation (CPD-clean).
 */
export function WalletNameField({
  id,
  inputRef,
  value,
  error,
  onChange,
  onKeyDown,
  placeholder,
}: WalletNameFieldProps) {
  const { t } = useTranslation();
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1">
        {t('wallet.addNameLabel')} <span className="text-red-500" aria-hidden="true">*</span>
      </label>
      <input
        ref={inputRef}
        id={id}
        type="text"
        name="walletName"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2.5 focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
      />
      {error && (
        <p id={errorId} className="mt-1 text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
