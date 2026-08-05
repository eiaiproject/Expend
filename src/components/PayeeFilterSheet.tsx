import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheetShell } from './BottomSheetShell';
import {
  CategoryFilterList,
  CurrencyRangeFields,
  DateRangeFields,
  FilterFooter,
  FilterSection,
  WalletFilterList,
} from './FilterControls';

export interface PayeeFilterDraft {
  readonly categoryIds: number[];
  readonly walletIds: number[];
  readonly startDate: string;
  readonly endDate: string;
  readonly minTotalExpense: string;
  readonly maxTotalExpense: string;
  readonly minTransactionCount: string;
  readonly maxTransactionCount: string;
}

interface PayeeFilterSheetProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly draft: PayeeFilterDraft;
  readonly onApply: (draft: PayeeFilterDraft) => void;
  readonly categories: import('../db/db').Category[];
  readonly wallets: import('../db/db').Wallet[];
}

export function PayeeFilterSheet({ isOpen, onClose, draft: initialDraft, onApply, categories, wallets }: PayeeFilterSheetProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<PayeeFilterDraft>({ ...initialDraft });

  useEffect(() => {
    if (isOpen) {
      setDraft({ ...initialDraft });
    }
  }, [isOpen, initialDraft]);

  const updateDraft = useCallback((patch: Partial<PayeeFilterDraft>) => {
    setDraft(prev => ({ ...prev, ...patch }));
  }, []);

  const toggleCategory = (id: number) => {
    setDraft(prev => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(id)
        ? prev.categoryIds.filter(c => c !== id)
        : [...prev.categoryIds, id],
    }));
  };

  const toggleWallet = (id: number) => {
    setDraft(prev => ({
      ...prev,
      walletIds: prev.walletIds.includes(id)
        ? prev.walletIds.filter(w => w !== id)
        : [...prev.walletIds, id],
    }));
  };

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  const handleResetAll = () => {
    setDraft({
      categoryIds: [],
      walletIds: [],
      startDate: '',
      endDate: '',
      minTotalExpense: '',
      maxTotalExpense: '',
      minTransactionCount: '',
      maxTransactionCount: '',
    });
  };

  const handleCountChange = (val: string, key: 'minTransactionCount' | 'maxTransactionCount') => {
    updateDraft({ [key]: val.replace(/\D/g, '') });
  };

  const draftActiveCount = [
    draft.categoryIds.length,
    draft.walletIds.length,
    draft.startDate ? 1 : 0,
    draft.endDate ? 1 : 0,
    draft.minTotalExpense ? 1 : 0,
    draft.maxTotalExpense ? 1 : 0,
    draft.minTransactionCount ? 1 : 0,
    draft.maxTransactionCount ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <BottomSheetShell
      isOpen={isOpen}
      onClose={onClose}
      title={t('Payee Filter')}
      ariaLabel={t('Payee Filter')}
      size="medium"
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          <CategoryFilterList
            categories={categories}
            selectedIds={draft.categoryIds}
            onToggle={toggleCategory}
            onClear={() => updateDraft({ categoryIds: [] })}
          />
          <WalletFilterList
            wallets={wallets}
            selectedIds={draft.walletIds}
            onToggle={toggleWallet}
            onClear={() => updateDraft({ walletIds: [] })}
          />
          <DateRangeFields
            idPrefix="payee-filter"
            startDate={draft.startDate}
            endDate={draft.endDate}
            onStartChange={(startDate) => updateDraft({ startDate })}
            onEndChange={(endDate) => updateDraft({ endDate })}
            onReset={() => updateDraft({ startDate: '', endDate: '' })}
          />
          <CurrencyRangeFields
            idPrefix="payee-filter-expense"
            title={t('Total Spent Range')}
            min={draft.minTotalExpense}
            max={draft.maxTotalExpense}
            onMinChange={(minTotalExpense) => updateDraft({ minTotalExpense })}
            onMaxChange={(maxTotalExpense) => updateDraft({ maxTotalExpense })}
          />

          <FilterSection title={t('Transaction Count Range')}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase ml-1" htmlFor="payee-filter-min-count">{t('Min')}</label>
                <input
                  id="payee-filter-min-count"
                  name="minTransactionCount"
                  type="text"
                  inputMode="numeric"
                  value={draft.minTransactionCount}
                  onChange={(e) => handleCountChange(e.target.value, 'minTransactionCount')}
                  placeholder="0"
                  className="w-full px-3 py-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow] font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase ml-1" htmlFor="payee-filter-max-count">{t('Max')}</label>
                <input
                  id="payee-filter-max-count"
                  name="maxTransactionCount"
                  type="text"
                  inputMode="numeric"
                  value={draft.maxTransactionCount}
                  onChange={(e) => handleCountChange(e.target.value, 'maxTransactionCount')}
                  placeholder={t('Unlimited')}
                  className="w-full px-3 py-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow] font-mono"
                />
              </div>
            </div>
          </FilterSection>
        </div>

        <FilterFooter activeCount={draftActiveCount} onApply={handleApply} onReset={handleResetAll} />
      </div>
    </BottomSheetShell>
  );
}
