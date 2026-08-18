import { useTranslation } from 'react-i18next';

const WALLET_COLORS = ['#7A9B6A', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#64748b', '#78716c'];

interface WalletColorPickerProps {
  readonly value: string;
  readonly onChange: (color: string) => void;
}

/**
 * Swatch grid for picking a wallet color. Shared by AddWalletSheet and
 * EditWalletSheet so both sheets use one implementation (CPD-clean).
 */
export function WalletColorPicker({ value, onChange }: WalletColorPickerProps) {
  const { t } = useTranslation();
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{t('wallet.colorLabel')}</label>
      <div className="flex flex-wrap gap-2">
        {WALLET_COLORS.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => onChange(hex)}
            className={`w-8 h-8 rounded-full transition-all ${
              value === hex ? 'ring-2 ring-offset-2 ring-[var(--accent)] scale-110' : 'hover:scale-110'
            }`}
            style={{ backgroundColor: hex }}
            aria-label={hex}
            aria-pressed={value === hex}
          />
        ))}
      </div>
    </div>
  );
}
