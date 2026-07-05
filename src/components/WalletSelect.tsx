import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Wallet as WalletIcon } from 'lucide-react';
import type { Wallet } from '../db/db';
import { cn } from '../utils/cn';

interface WalletSelectProps {
  id: string;
  value: string;
  wallets: Wallet[];
  placeholder: string;
  onChange: (value: string) => void;
}

export function WalletSelect({ id, value, wallets, placeholder, onChange }: WalletSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = `${id}-listbox`;
  const options = useMemo(() => wallets.filter((wallet) => wallet.id != null), [wallets]);
  const selectedWallet = options.find((wallet) => String(wallet.id) === value);
  const isDisabled = options.length === 0;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  const selectWallet = (walletId: number) => {
    onChange(String(walletId));
    setIsOpen(false);
  };

  return (
    <div ref={rootRef} className="relative" data-wallet-select>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-required="true"
        disabled={isDisabled}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        className={cn(
          'w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] py-3 pl-12 pr-10 text-left text-[var(--text-primary)] transition-[border-color,box-shadow]',
          'focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20',
          isOpen && 'border-[var(--accent)] ring-2 ring-[var(--accent)]/20',
          isDisabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <WalletIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} aria-hidden="true" />
        <span className={selectedWallet ? undefined : 'text-[var(--text-secondary)]'}>
          {selectedWallet?.name ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            'absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] transition-transform',
            isOpen && 'rotate-180',
          )}
          size={18}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg"
        >
          {options.map((wallet) => {
            const walletValue = String(wallet.id);
            const isSelected = walletValue === value;

            return (
              <button
                key={wallet.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-wallet-option={wallet.name}
                onClick={() => selectWallet(wallet.id!)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                  isSelected
                    ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'text-[var(--text-primary)] hover:bg-[var(--bg)]',
                )}
              >
                <span className="min-w-0 truncate">{wallet.name}</span>
                {isSelected && <Check size={16} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
