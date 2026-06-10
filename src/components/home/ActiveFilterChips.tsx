import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import type { Transaction } from '../../db/db';

interface FilterState {
  type: 'all' | 'expense' | 'balance_adjustment';
  categories: number[];
  wallets: number[];
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
}

interface FilterActions {
  setType: (val: FilterState['type']) => void;
  setCategories: (val: number[]) => void;
  setWallets: (val: number[]) => void;
  setStartDate: (val: string) => void;
  setEndDate: (val: string) => void;
  setMinAmount: (val: string) => void;
  setMaxAmount: (val: string) => void;
  clearAllFilters: () => void;
}

interface ActiveFilterChipsProps {
  filters: FilterState;
  filterActions: FilterActions;
  categoryMap: Record<number, { name: string; color: string } | undefined>;
  walletMap: Record<number, { name: string } | undefined>;
}

export function ActiveFilterChips({
  filters,
  filterActions,
  categoryMap,
  walletMap,
}: ActiveFilterChipsProps) {
  const { t } = useTranslation();

  const hasActiveFilters = filters.type !== 'all' ||
    filters.categories.length > 0 ||
    filters.wallets.length > 0 ||
    filters.minAmount !== '' ||
    filters.maxAmount !== '' ||
    filters.startDate !== '' ||
    filters.endDate !== '';

  if (!hasActiveFilters) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap gap-1.5"
    >
      {filters.type !== 'all' && (
        <button
          onClick={() => filterActions.setType('all')}
          className="flex items-center gap-1 px-2.5 py-1 bg-[var(--accent)]/10 text-[var(--accent)] rounded-full text-[11px] font-medium border border-[var(--accent)]/20 active:scale-95 transition-transform"
        >
          {filters.type === 'expense' ? t('Expense') : t('Adjustment')}
          <X size={11} />
        </button>
      )}
      
      {filters.categories.map(catId => {
        const cat = categoryMap[catId];
        if (!cat) return null;
        return (
          <button
            key={`cat-${catId}`}
            onClick={() => filterActions.setCategories(filters.categories.filter(c => c !== catId))}
            className="flex items-center gap-1 px-2.5 py-1 bg-[var(--accent)]/10 text-[var(--accent)] rounded-full text-[11px] font-medium border border-[var(--accent)]/20 active:scale-95 transition-transform"
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color || 'var(--accent)' }} />
            {cat.name}
            <X size={11} />
          </button>
        );
      })}
      
      {filters.wallets.map(wId => {
        const w = walletMap[wId];
        if (!w) return null;
        return (
          <button
            key={`wallet-${wId}`}
            onClick={() => filterActions.setWallets(filters.wallets.filter(f => f !== wId))}
            className="flex items-center gap-1 px-2.5 py-1 bg-[var(--accent)]/10 text-[var(--accent)] rounded-full text-[11px] font-medium border border-[var(--accent)]/20 active:scale-95 transition-transform"
          >
            {w.name}
            <X size={11} />
          </button>
        );
      })}
      
      {(filters.minAmount || filters.maxAmount) && (
        <button
          onClick={() => { filterActions.setMinAmount(''); filterActions.setMaxAmount(''); }}
          className="flex items-center gap-1 px-2.5 py-1 bg-[var(--accent)]/10 text-[var(--accent)] rounded-full text-[11px] font-medium border border-[var(--accent)]/20 active:scale-95 transition-transform"
        >
          Rp{filters.minAmount ? parseInt(filters.minAmount).toLocaleString('id-ID') : '0'}–{filters.maxAmount ? parseInt(filters.maxAmount).toLocaleString('id-ID') : '∞'}
          <X size={11} />
        </button>
      )}
      
      {(filters.startDate || filters.endDate) && (
        <button
          onClick={() => { filterActions.setStartDate(''); filterActions.setEndDate(''); }}
          className="flex items-center gap-1 px-2.5 py-1 bg-[var(--accent)]/10 text-[var(--accent)] rounded-full text-[11px] font-medium border border-[var(--accent)]/20 active:scale-95 transition-transform"
        >
          {filters.startDate || '…'} ~ {filters.endDate || '…'}
          <X size={11} />
        </button>
      )}
      
      <button
        onClick={filterActions.clearAllFilters}
        className="flex items-center gap-1 px-2.5 py-1 bg-[var(--bg)] text-[var(--text-secondary)] rounded-full text-[11px] font-medium border border-[var(--border)] hover:text-[var(--expense)] transition-colors active:scale-95"
      >
        <X size={11} /> {t('Reset')}
      </button>
    </motion.div>
  );
}
