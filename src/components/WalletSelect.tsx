import { ChevronDown, Wallet as WalletIcon } from 'lucide-react';
import type { Wallet } from '../db/db';

interface WalletSelectProps {
  id: string;
  value: string;
  wallets: Wallet[];
  placeholder: string;
  onChange: (value: string) => void;
}

export function WalletSelect({ id, value, wallets, placeholder, onChange }: WalletSelectProps) {
  const options = wallets.filter((wallet) => wallet.id != null);
  const isDisabled = options.length === 0;

  return (
    <div className="relative">
      <WalletIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} aria-hidden="true" />
      <select
        id={id}
        value={value}
        required
        disabled={isDisabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--bg)] py-3 pl-12 pr-10 text-left text-[var(--text-primary)] transition-[border-color,box-shadow] focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((wallet) => (
          <option key={wallet.id} value={String(wallet.id)}>
            {wallet.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} aria-hidden="true" />
    </div>
  );
}
