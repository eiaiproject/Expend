import { useState, useEffect, useCallback } from 'react';
import { Calendar, Wallet as WalletIcon, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../utils/cn';
import { getCategoryDisplayName } from '../utils/categoryDisplay';
import { BottomSheetShell } from './BottomSheetShell';

export interface PayeeFilterDraft {
  categoryIds: number[];
  walletIds: number[];
  startDate: string;
  endDate: string;
  minTotalExpense: string;
  maxTotalExpense: string;
  minTransactionCount: string;
  maxTransactionCount: string;
}

interface PayeeFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  draft: PayeeFilterDraft;
  onApply: (draft: PayeeFilterDraft) => void;
  categories: import('../db/db').Category[];
  wallets: import('../db/db').Wallet[];
  activeFilterCount: number;
}

export function PayeeFilterSheet({ isOpen, onClose, draft: initialDraft, onApply, categories, wallets, activeFilterCount }: PayeeFilterSheetProps) {
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

  const formatAmountInput = (val: string) => {
    const numeric = val.replace(/[^0-9]/g, '');
    return numeric ? parseInt(numeric, 10).toLocaleString('id-ID') : '';
  };

  const handleAmountChange = (val: string, key: 'minTotalExpense' | 'maxTotalExpense') => {
    const numeric = val.replace(/[^0-9]/g, '');
    updateDraft({ [key]: numeric });
  };

  const handleCountChange = (val: string, key: 'minTransactionCount' | 'maxTransactionCount') => {
    const numeric = val.replace(/[^0-9]/g, '');
    updateDraft({ [key]: numeric });
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
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Filter Category */}
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                {t('Filter Category')}
              </p>
              {draft.categoryIds.length > 0 && (
                <button
                  onClick={() => updateDraft({ categoryIds: [] })}
                  className="text-[10px] text-[var(--accent)] font-bold uppercase"
                >
                  {t('Reset')}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2 no-scrollbar">
              {categories.map(cat => {
                if (cat.id == null) return null;
                const isSelected = draft.categoryIds.includes(cat.id);
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
              {draft.walletIds.length > 0 && (
                <button
                  onClick={() => updateDraft({ walletIds: [] })}
                  className="text-[10px] text-[var(--accent)] font-bold uppercase"
                >
                  {t('Reset')}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {wallets.map(w => {
                if (w.id == null) return null;
                const isSelected = draft.walletIds.includes(w.id);
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

          {/* Filter Date Range */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              {t('Filter Date Range')}
            </p>
            <div className="grid grid-cols-1 gap-4 bg-[var(--bg)] p-4 rounded-2xl border border-[var(--border)]">
              <div className="space-y-2">
                <label className="text-xs text-[var(--text-secondary)] flex items-center gap-2" htmlFor="payee-filter-start-date">
                  <Calendar size={12} aria-hidden="true" /> {t('Start Date')}
                </label>
                <input
                  id="payee-filter-start-date"
                  name="startDate"
                  type="date"
                  value={draft.startDate}
                  onChange={(e) => updateDraft({ startDate: e.target.value })}
                  className="w-full p-3 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-[var(--text-secondary)] flex items-center gap-2" htmlFor="payee-filter-end-date">
                  <Calendar size={12} aria-hidden="true" /> {t('End Date')}
                </label>
                <input
                  id="payee-filter-end-date"
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

          {/* Total Spent Range */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              {t('Total Spent Range')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase ml-1" htmlFor="payee-filter-min-expense">{t('Min')}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--text-secondary)]">{t('Currency Symbol')}</span>
                  <input
                    id="payee-filter-min-expense"
                    name="minTotalExpense"
                    type="text"
                    inputMode="numeric"
                    value={formatAmountInput(draft.minTotalExpense)}
                    onChange={(e) => handleAmountChange(e.target.value, 'minTotalExpense')}
                    placeholder="0"
                    className="w-full pl-8 pr-3 py-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow] font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase ml-1" htmlFor="payee-filter-max-expense">{t('Max')}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--text-secondary)]">{t('Currency Symbol')}</span>
                  <input
                    id="payee-filter-max-expense"
                    name="maxTotalExpense"
                    type="text"
                    inputMode="numeric"
                    value={formatAmountInput(draft.maxTotalExpense)}
                    onChange={(e) => handleAmountChange(e.target.value, 'maxTotalExpense')}
                    placeholder={t('Unlimited')}
                    className="w-full pl-8 pr-3 py-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow] font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Transaction Count Range */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              {t('Transaction Count Range')}
            </p>
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
      </div>
    </BottomSheetShell>
  );
}
