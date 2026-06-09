import { Calendar, Wallet as WalletIcon, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { cn } from '../utils/cn';
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
}

export function FilterSheet({ isOpen, onClose, filters, categories, wallets }: FilterSheetProps) {
  const { t } = useTranslation();

  const toggleCategory = (id: number) => {
    if (filters.categories.includes(id)) {
      filters.setCategories(filters.categories.filter(c => c !== id));
    } else {
      filters.setCategories([...filters.categories, id]);
    }
  };

  const toggleWallet = (id: number) => {
    if (filters.wallets.includes(id)) {
      filters.setWallets(filters.wallets.filter(w => w !== id));
    } else {
      filters.setWallets([...filters.wallets, id]);
    }
  };

  const formatAmountInput = (val: string) => {
    const numeric = val.replace(/[^0-9]/g, '');
    return numeric ? parseInt(numeric, 10).toLocaleString('id-ID') : '';
  };

  const handleAmountChange = (val: string, setter: (v: string) => void) => {
    const numeric = val.replace(/[^0-9]/g, '');
    setter(numeric);
  };

  return (
    <BottomSheetShell
      isOpen={isOpen}
      onClose={onClose}
      title={t('Transaction Filter')}
      ariaLabel={t('Transaction Filter')}
    >
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
              {/* Filter Type */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  {t('Filter Type')}
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {(['all', 'expense', 'balance_adjustment'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => filters.setType(type)}
                      className={cn(
                        "text-left px-4 py-3 rounded-xl text-sm transition-colors border flex items-center justify-between",
                        filters.type === type 
                          ? "bg-[var(--accent)] text-white border-[var(--accent)]" 
                          : "bg-[var(--bg)] text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--accent)]"
                      )}
                    >
                      <span>{type === 'all' ? t('All') : type === 'expense' ? t('Expense') : t('Adjustment')}</span>
                      {filters.type === type && <Check size={16} />}
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
                  {filters.categories.length > 0 && (
                    <button 
                      onClick={() => filters.setCategories([])}
                      className="text-[10px] text-[var(--accent)] font-bold uppercase"
                    >
                      {t('Reset')}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2 no-scrollbar">
                  {categories.map(cat => {
                    if (cat.id == null) return null;
                    const isSelected = filters.categories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => cat.id != null && toggleCategory(cat.id)}
                        className={cn(
                          "text-left px-4 py-3 rounded-xl text-sm transition-colors border flex items-center justify-between gap-2",
                          isSelected 
                            ? "bg-[var(--accent)] text-white border-[var(--accent)]" 
                            : "bg-[var(--bg)] text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--accent)]"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.name}
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
                  {filters.wallets.length > 0 && (
                    <button 
                      onClick={() => filters.setWallets([])}
                      className="text-[10px] text-[var(--accent)] font-bold uppercase"
                    >
                      {t('Reset')}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {wallets.map(w => {
                    if (w.id == null) return null;
                    const isSelected = filters.wallets.includes(w.id);
                    return (
                      <button
                        key={w.id}
                        onClick={() => w.id != null && toggleWallet(w.id)}
                        className={cn(
                          "text-left px-4 py-3 rounded-xl text-sm transition-colors border flex items-center justify-between gap-2",
                          isSelected 
                            ? "bg-[var(--accent)] text-white border-[var(--accent)]" 
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
                  <div className="space-y-1">
                    <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase ml-1">Min</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--text-secondary)]">Rp</span>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        value={formatAmountInput(filters.minAmount)}
                        onChange={(e) => handleAmountChange(e.target.value, filters.setMinAmount)}
                        placeholder="0"
                        className="w-full pl-8 pr-3 py-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase ml-1">Max</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--text-secondary)]">Rp</span>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        value={formatAmountInput(filters.maxAmount)}
                        onChange={(e) => handleAmountChange(e.target.value, filters.setMaxAmount)}
                        placeholder="Unlimited"
                        className="w-full pl-8 pr-3 py-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] font-mono"
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
                    <label className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
                      <Calendar size={12} /> {t('Start Date')}
                    </label>
                    <input 
                      type="date" 
                      value={filters.startDate}
                      onChange={(e) => filters.setStartDate(e.target.value)}
                      className="w-full p-3 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
                      <Calendar size={12} /> {t('End Date')}
                    </label>
                    <input 
                      type="date" 
                      value={filters.endDate}
                      onChange={(e) => filters.setEndDate(e.target.value)}
                      className="w-full p-3 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <button 
                    onClick={() => {
                      filters.setStartDate('');
                      filters.setEndDate('');
                    }}
                    className="w-full text-center text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] underline pt-2"
                  >
                    {t('Reset Date')}
                  </button>
                </div>
              </div>
            </div>

        <div className="p-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="w-full bg-[var(--accent)] text-white font-bold py-4 rounded-xl active:scale-95 transition-transform shadow-lg shadow-[var(--accent)]/20"
          >
            {t('Close Filters')}
          </button>
        </div>
    </BottomSheetShell>
  );
}
