import { useState, useEffect, useCallback } from 'react';
import { Check } from 'reicon-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../utils/cn';
import { BottomSheetShell } from './BottomSheetShell';
import { CategoryFilterList, CurrencyRangeFields, DateRangeFields, FilterFooter, WalletFilterList } from './FilterControls';

interface FilterSheetProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly filters: {
    readonly type: string;
    readonly setType: (val: 'all' | 'expense' | 'balance_adjustment') => void;
    readonly categories: number[];
    readonly setCategories: (val: number[]) => void;
    readonly wallets: number[];
    readonly setWallets: (val: number[]) => void;
    readonly startDate: string;
    readonly setStartDate: (val: string) => void;
    readonly endDate: string;
    readonly setEndDate: (val: string) => void;
    readonly minAmount: string;
    readonly setMinAmount: (val: string) => void;
    readonly maxAmount: string;
    readonly setMaxAmount: (val: string) => void;
  };
  categories: import('../db/db').Category[];
  wallets: import('../db/db').Wallet[];
}

interface DraftState {
  readonly type: string;
  readonly categories: number[];
  readonly wallets: number[];
  readonly startDate: string;
  readonly endDate: string;
  readonly minAmount: string;
  readonly maxAmount: string;
}

export function FilterSheet({ isOpen, onClose, filters, categories, wallets }: FilterSheetProps) {
  const { t } = useTranslation();

  const [draft, setDraft] = useState<DraftState>({
    type: filters.type,
    categories: [...filters.categories],
    wallets: [...filters.wallets],
    startDate: filters.startDate,
    endDate: filters.endDate,
    minAmount: filters.minAmount,
    maxAmount: filters.maxAmount,
  });

  // Sync draft when sheet opens
  useEffect(() => {
    if (isOpen) {
      setDraft({
        type: filters.type,
        categories: [...filters.categories],
        wallets: [...filters.wallets],
        startDate: filters.startDate,
        endDate: filters.endDate,
        minAmount: filters.minAmount,
        maxAmount: filters.maxAmount,
      });
    }
  }, [isOpen, filters.type, filters.categories, filters.wallets, filters.startDate, filters.endDate, filters.minAmount, filters.maxAmount]);

  const updateDraft = useCallback((patch: Partial<DraftState>) => {
    setDraft(prev => ({ ...prev, ...patch }));
  }, []);

  const toggleCategory = (id: number) => {
    setDraft(prev => ({
      ...prev,
      categories: prev.categories.includes(id)
        ? prev.categories.filter(c => c !== id)
        : [...prev.categories, id],
    }));
  };

  const toggleWallet = (id: number) => {
    setDraft(prev => ({
      ...prev,
      wallets: prev.wallets.includes(id)
        ? prev.wallets.filter(w => w !== id)
        : [...prev.wallets, id],
    }));
  };

  const handleApply = () => {
    filters.setType(draft.type as 'all' | 'expense' | 'balance_adjustment');
    filters.setCategories(draft.categories);
    filters.setWallets(draft.wallets);
    filters.setStartDate(draft.startDate);
    filters.setEndDate(draft.endDate);
    filters.setMinAmount(draft.minAmount);
    filters.setMaxAmount(draft.maxAmount);
    onClose();
  };

  const handleResetAll = () => {
    setDraft({
      type: 'all',
      categories: [],
      wallets: [],
      startDate: '',
      endDate: '',
      minAmount: '',
      maxAmount: '',
    });
  };

  const draftActiveCount = [
    draft.type !== 'all' ? 1 : 0,
    draft.categories.length,
    draft.wallets.length,
    draft.startDate ? 1 : 0,
    draft.endDate ? 1 : 0,
    draft.minAmount ? 1 : 0,
    draft.maxAmount ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <BottomSheetShell
      isOpen={isOpen}
      onClose={onClose}
      title={t('Transaction Filter')}
      ariaLabel={t('Transaction Filter')}
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scroll-fade-bottom">
          <div className="space-y-3" role="group" aria-label={t('Filter Type')}>
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              {t('Filter Type')}
            </p>
            <div className="grid grid-cols-1 gap-2">
              {(['all', 'expense', 'balance_adjustment'] as const).map((type) => (
                <button
                  type="button"
                  key={type}
                  aria-pressed={draft.type === type}
                  onClick={() => updateDraft({ type })}
                  className={cn(
                    "text-left px-4 py-3 rounded-xl text-sm transition-colors border flex items-center justify-between min-h-[44px]",
                    draft.type === type
                      ? "bg-[var(--accent-fill)] text-[var(--accent-ink)] border-[var(--accent-fill)]"
                      : "bg-[var(--bg)] text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--accent)]"
                  )}
                >
                  <span>{(() => { if (type === 'all') return t('All'); if (type === 'expense') return t('Expense'); return t('Adjustment'); })()}</span>
                  {draft.type === type && <Check size={16} />}
                </button>
              ))}
            </div>
          </div>

          <CategoryFilterList
            categories={categories}
            selectedIds={draft.categories}
            onToggle={toggleCategory}
            onClear={() => updateDraft({ categories: [] })}
          />
          <WalletFilterList
            wallets={wallets}
            selectedIds={draft.wallets}
            onToggle={toggleWallet}
            onClear={() => updateDraft({ wallets: [] })}
          />
          <CurrencyRangeFields
            idPrefix="filter-amount"
            title={t('Amount Range')}
            min={draft.minAmount}
            max={draft.maxAmount}
            onMinChange={(minAmount) => updateDraft({ minAmount })}
            onMaxChange={(maxAmount) => updateDraft({ maxAmount })}
          />
          <DateRangeFields
            idPrefix="filter"
            startDate={draft.startDate}
            endDate={draft.endDate}
            onStartChange={(startDate) => updateDraft({ startDate })}
            onEndChange={(endDate) => updateDraft({ endDate })}
            onReset={() => updateDraft({ startDate: '', endDate: '' })}
          />
        </div>

        <FilterFooter activeCount={draftActiveCount} onApply={handleApply} onReset={handleResetAll} />
      </div>
    </BottomSheetShell>
  );
}
