import { type ReactNode } from 'react';
import { Calendar, Check, Wallet as WalletIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Category, Wallet } from '../db/db';
import { cn } from '../utils/cn';
import { FALLBACK_CATEGORY_NAME } from '../utils/categoryDisplay';

function formatNumericInput(value: string) {
  const numeric = value.replace(/[^0-9]/g, '');
  return numeric ? parseInt(numeric, 10).toLocaleString('id-ID') : '';
}

export function FilterSection({
  title,
  showReset,
  onReset,
  children,
}: {
  title: string;
  showReset?: boolean;
  onReset?: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-end">
        <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
          {title}
        </p>
        {showReset && onReset && (
          <button type="button" onClick={onReset} className="text-[10px] text-[var(--accent)] font-bold uppercase">
            {t('Reset')}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export function CategoryFilterList({
  categories,
  selectedIds,
  onToggle,
  onClear,
}: {
  categories: Category[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();

  return (
    <FilterSection title={t('Filter Category')} showReset={selectedIds.length > 0} onReset={onClear}>
      <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2 no-scrollbar">
        {categories.map((cat) => {
          if (cat.id == null) return null;
          const isSelected = selectedIds.includes(cat.id);
          return (
            <button
              type="button"
              key={cat.id}
              aria-pressed={isSelected}
              onClick={() => onToggle(cat.id!)}
              className={cn(
                "text-left px-4 py-3 rounded-xl text-sm transition-colors border flex items-center justify-between gap-2",
                isSelected
                  ? "bg-[var(--accent-fill)] text-[var(--accent-ink)] border-[var(--accent-fill)]"
                  : "bg-[var(--bg)] text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--accent)]"
              )}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                {cat.name === FALLBACK_CATEGORY_NAME ? t('Other') : cat.name}
              </div>
              {isSelected && <Check size={16} />}
            </button>
          );
        })}
      </div>
    </FilterSection>
  );
}

export function WalletFilterList({
  wallets,
  selectedIds,
  onToggle,
  onClear,
}: {
  wallets: Wallet[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();

  return (
    <FilterSection title={t('Filter Wallet')} showReset={selectedIds.length > 0} onReset={onClear}>
      <div className="grid grid-cols-1 gap-2">
        {wallets.map((wallet) => {
          if (wallet.id == null) return null;
          const isSelected = selectedIds.includes(wallet.id);
          return (
            <button
              type="button"
              key={wallet.id}
              aria-pressed={isSelected}
              onClick={() => onToggle(wallet.id!)}
              className={cn(
                "text-left px-4 py-3 rounded-xl text-sm transition-colors border flex items-center justify-between gap-2",
                isSelected
                  ? "bg-[var(--accent-fill)] text-[var(--accent-ink)] border-[var(--accent-fill)]"
                  : "bg-[var(--bg)] text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--accent)]"
              )}
            >
              <div className="flex items-center gap-2">
                <WalletIcon size={14} />
                {wallet.name}
              </div>
              {isSelected && <Check size={16} />}
            </button>
          );
        })}
      </div>
    </FilterSection>
  );
}

export function CurrencyRangeFields({
  idPrefix,
  title,
  min,
  max,
  onMinChange,
  onMaxChange,
}: {
  idPrefix: string;
  title: string;
  min: string;
  max: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <FilterSection title={title}>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase ml-1" htmlFor={`${idPrefix}-min`}>
            {t('Min')}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--text-secondary)]">{t('Currency Symbol')}</span>
            <input
              id={`${idPrefix}-min`}
              type="text"
              inputMode="numeric"
              value={formatNumericInput(min)}
              onChange={(event) => onMinChange(event.target.value.replace(/[^0-9]/g, ''))}
              placeholder="0"
              className="w-full pl-8 pr-3 py-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow] font-mono"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase ml-1" htmlFor={`${idPrefix}-max`}>
            {t('Max')}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--text-secondary)]">{t('Currency Symbol')}</span>
            <input
              id={`${idPrefix}-max`}
              type="text"
              inputMode="numeric"
              value={formatNumericInput(max)}
              onChange={(event) => onMaxChange(event.target.value.replace(/[^0-9]/g, ''))}
              placeholder={t('Unlimited')}
              className="w-full pl-8 pr-3 py-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow] font-mono"
            />
          </div>
        </div>
      </div>
    </FilterSection>
  );
}

export function DateRangeFields({
  idPrefix,
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  onReset,
}: {
  idPrefix: string;
  startDate: string;
  endDate: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();

  return (
    <FilterSection title={t('Filter Date Range')}>
      <div className="grid grid-cols-1 gap-4 bg-[var(--bg)] p-4 rounded-2xl border border-[var(--border)]">
        <div className="space-y-2">
          <label className="text-xs text-[var(--text-secondary)] flex items-center gap-2" htmlFor={`${idPrefix}-start-date`}>
            <Calendar size={12} aria-hidden="true" /> {t('Start Date')}
          </label>
          <input
            id={`${idPrefix}-start-date`}
            type="date"
            value={startDate}
            onChange={(event) => onStartChange(event.target.value)}
            className="w-full p-3 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs text-[var(--text-secondary)] flex items-center gap-2" htmlFor={`${idPrefix}-end-date`}>
            <Calendar size={12} aria-hidden="true" /> {t('End Date')}
          </label>
          <input
            id={`${idPrefix}-end-date`}
            type="date"
            value={endDate}
            onChange={(event) => onEndChange(event.target.value)}
            className="w-full p-3 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
          />
        </div>
        <button type="button" onClick={onReset} className="w-full text-center text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] underline pt-2">
          {t('Reset Date')}
        </button>
      </div>
    </FilterSection>
  );
}

export function FilterFooter({
  activeCount,
  onApply,
  onReset,
}: {
  activeCount: number;
  onApply: () => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="p-4 border-t border-[var(--border)] space-y-2">
      <button
        type="button"
        onClick={onApply}
        className="w-full bg-[var(--accent-fill)] text-[var(--accent-ink)] font-bold py-4 rounded-xl active:scale-95 transition-transform shadow-lg shadow-[var(--accent-fill)]/20"
      >
        {t('Apply Filter')} {activeCount > 0 && `(${activeCount})`}
      </button>
      {activeCount > 0 && (
        <button
          type="button"
          onClick={onReset}
          className="w-full text-[var(--text-secondary)] font-bold py-3 rounded-xl active:scale-95 transition-transform text-sm"
        >
          {t('Reset All')}
        </button>
      )}
    </div>
  );
}
