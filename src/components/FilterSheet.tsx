import { useState, useEffect, useCallback } from 'react';
import { Calendar, Wallet as WalletIcon, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../utils/cn';
import { getCategoryDisplayName } from '../utils/categoryDisplay';
import { BottomSheetShell } from './BottomSheetShell';

interface FilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  filters: {
    type: string;
    setType: (val: 'all' | 'expense' | 'balance_adjustment') => void;
    categories: number[];
    setCategories: (val: number[]) => void;
    wallets: number[];
    setWallets: (val: number[]) => void;
    startDate: string;
    setStartDate: (val: string) => void;
    endDate: string;
    setEndDate: (val: string) => void;
    minAmount: string;
    setMinAmount: (val: string) => void;
    maxAmount: string;
    setMaxAmount: (val: string) => void;
  };
  categories: import('../db/db').Category[];
  wallets: import('../db/db').Wallet[];
  activeFilterCount?: number;
}

interface DraftState {
  type: string;
  categories: number[];
  wallets: number[];
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
}

export function FilterSheet({ isOpen, onClose, filters, categories, wallets, activeFilterCount = 0 }: FilterSheetProps) {
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

  const formatAmountInput = (val: string) => {
    const numeric = val.replace(/[^0-9]/g, '');
    return numeric ? parseInt(numeric, 10).toLocaleString('id-ID') : '';
  };

  const handleAmountChange = (val: string, key: 'minAmount' | 'maxAmount') => {
    const numeric = val.replace(/[^0-9]/g, '');
    updateDraft({ [key]: numeric });
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
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
            {/* Filter Type */}
              <div className="space-y-3" role="radiogroup" aria-label={t('Filter Type')}>
                <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  {t('Filter Type')}
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {(['all', 'expense', 'balance_adjustment'] as const).map((type) => (
                    <button
                      type="button"
                      key={type}
                      role="radio"
                      aria-checked={draft.type === type}
                      onClick={() => updateDraft({ type })}
                      className={cn(
                        "text-left px-4 py-3 rounded-xl text-sm transition-colors border flex items-center justify-between",
                        draft.type === type 
                          ? "bg-[var(--accent-fill)] text-[var(--accent-ink)] border-[var(--accent-fill)]" 
                          : "bg-[var(--bg)] text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--accent)]"
                      )}
                    >
                      <span>{type === 'all' ? t('All') : type === 'expense' ? t('Expense') : t('Adjustment')}</span>
                      {draft.type === type && <Check size={16} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter Category */}
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                    {t('Filter Category')}
                  </p>
                  {draft.categories.length > 0 && (
                    <button 
                      onClick={() => updateDraft({ categories: [] })}
                      className="text-[10px] text-[var(--accent)] font-bold uppercase"
                    >
                      {t('Reset')}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2 no-scrollbar">
                  {categories.map(cat => {
                    if (cat.id == null) return null;
                    const isSelected = draft.categories.includes(cat.id);
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        aria-pressed={isSelected}
                        onClick={() => cat.id != null && toggleCategory(cat.id)}
                        className={cn(
                          "text-left px-4 py-3 rounded-xl text-sm transition-colors border flex items-center justify-between gap-2",
                          isSelected 
                            ? "bg-[var(--accent-fill)] text-[var(--accent-ink)] border-[var(--accent-fill)]" 
                            : "bg-[var(--bg)] text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--accent)]"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                          {getCategoryDisplayName(cat.name, t)}
                        </div>
                        {isSelected && <Check size={16} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Filter Wallet */}
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                    {t('Filter Wallet')}
                  </p>
                  {draft.wallets.length > 0 && (
                    <button 
                      onClick={() => updateDraft({ wallets: [] })}
                      className="text-[10px] text-[var(--accent)] font-bold uppercase"
                    >
                      {t('Reset')}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {wallets.map(w => {
                    if (w.id == null) return null;
                    const isSelected = draft.wallets.includes(w.id);
                    return (
                      <button
                        type="button"
                        key={w.id}
                        aria-pressed={isSelected}
                        onClick={() => w.id != null && toggleWallet(w.id)}
                        className={cn(
                          "text-left px-4 py-3 rounded-xl text-sm transition-colors border flex items-center justify-between gap-2",
                          isSelected 
                            ? "bg-[var(--accent-fill)] text-[var(--accent-ink)] border-[var(--accent-fill)]" 
                            : "bg-[var(--bg)] text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--accent)]"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <WalletIcon size={14} />
                          {w.name}
                        </div>
                        {isSelected && <Check size={16} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Filter Amount Range */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  {t('Amount Range')}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">                      <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase ml-1" htmlFor="filter-min-amount">{t('Min')}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--text-secondary)]">{t('Currency Symbol')}</span>
                      <input 
                        id="filter-min-amount"
                        name="minAmount"
                        type="text"
                        inputMode="numeric"
                        value={formatAmountInput(draft.minAmount)}
                        onChange={(e) => handleAmountChange(e.target.value, 'minAmount')}
                        placeholder="0"
                        className="w-full pl-8 pr-3 py-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow] font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">                      <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase ml-1" htmlFor="filter-max-amount">{t('Max')}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--text-secondary)]">{t('Currency Symbol')}</span>
                      <input 
                        id="filter-max-amount"
                        name="maxAmount"
                        type="text"
                        inputMode="numeric"
                        value={formatAmountInput(draft.maxAmount)}
                        onChange={(e) => handleAmountChange(e.target.value, 'maxAmount')}
                        placeholder={t('Unlimited')}
                        className="w-full pl-8 pr-3 py-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow] font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Filter Date Range */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  {t('Filter Date Range')}
                </p>
                <div className="grid grid-cols-1 gap-4 bg-[var(--bg)] p-4 rounded-2xl border border-[var(--border)]">
                  <div className="space-y-2">
                    <label className="text-xs text-[var(--text-secondary)] flex items-center gap-2" htmlFor="filter-start-date">
                      <Calendar size={12} aria-hidden="true" /> {t('Start Date')}
                    </label>
                    <input 
                      id="filter-start-date"
                      name="startDate"
                      type="date"
                      value={draft.startDate}
                      onChange={(e) => updateDraft({ startDate: e.target.value })}
                      className="w-full p-3 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-[var(--text-secondary)] flex items-center gap-2" htmlFor="filter-end-date">
                      <Calendar size={12} aria-hidden="true" /> {t('End Date')}
                    </label>
                    <input 
                      id="filter-end-date"
                      name="endDate"
                      type="date"
                      value={draft.endDate}
                      onChange={(e) => updateDraft({ endDate: e.target.value })}
                      className="w-full p-3 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
                    />
                  </div>
                  <button 
                    onClick={() => updateDraft({ startDate: '', endDate: '' })}
                    className="w-full text-center text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] underline pt-2"
                  >
                    {t('Reset Date')}
                  </button>
                </div>
              </div>
            </div>

        <div className="p-4 border-t border-[var(--border)] space-y-2">
          <button
            type="button"
            onClick={handleApply}
            className="w-full bg-[var(--accent-fill)] text-[var(--accent-ink)] font-bold py-4 rounded-xl active:scale-95 transition-transform shadow-lg shadow-[var(--accent-fill)]/20"
          >
            {t('Apply Filter')} {draftActiveCount > 0 && `(${draftActiveCount})`}
          </button>
          {draftActiveCount > 0 && (
            <button
              type="button"
              onClick={handleResetAll}
              className="w-full text-[var(--text-secondary)] font-bold py-3 rounded-xl active:scale-95 transition-transform text-sm"
            >
              {t('Reset All')}
            </button>
          )}
        </div>
    </BottomSheetShell>
  );
}
