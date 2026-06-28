import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Search, ArrowLeft, Filter, TrendingUp, ShoppingBag, Calendar, Wallet } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';
import { format } from 'date-fns';
import { cn } from '../utils/cn';
import { getPayeeStatsFromTransactions, filterTransactionsByPayee, PayeeStats } from '../services/payeeService';
import { TransactionCard } from '../components/home/TransactionCard';
import { EmptyState } from '../components/EmptyState';

export default function PayeesView() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPayee, setSelectedPayee] = useState<PayeeStats | null>(null);

  const payees = useLiveQuery(async () => {
    return await getPayeeStatsFromTransactions();
  }, []);

  const filteredPayees = useMemo(() => {
    if (!payees) return [];
    if (!searchQuery.trim()) return payees;
    const lower = searchQuery.toLowerCase();
    return payees.filter(p => p.name.toLowerCase().includes(lower));
  }, [payees, searchQuery]);

  const selectedPayeeTransactions = useLiveQuery(async () => {
    if (!selectedPayee) return [];
    return await filterTransactionsByPayee(selectedPayee.name);
  }, [selectedPayee]);

  if (selectedPayee) {
    return (
      <div className="p-4 space-y-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSelectedPayee(null)}
            className="p-2 bg-[var(--card)] border border-[var(--border)] rounded-full text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
            aria-label={t('Back')}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold">{selectedPayee.name}</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              {t('Transactions history')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[var(--card)] p-4 rounded-2xl border border-[var(--border)] space-y-1">
            <p className="text-xs text-[var(--text-secondary)] uppercase font-bold tracking-wider">{t('Total Spent')}</p>
            <p className="text-xl font-mono font-bold text-red-500">{formatCurrency(selectedPayee.totalExpense)}</p>
          </div>
          <div className="bg-[var(--card)] p-4 rounded-2xl border border-[var(--border)] space-y-1">
            <p className="text-xs text-[var(--text-secondary)] uppercase font-bold tracking-wider">{t('Count')}</p>
            <p className="text-xl font-mono font-bold">{selectedPayee.transactionCount} {t('Txs')}</p>
          </div>
          <div className="bg-[var(--card)] p-4 rounded-2xl border border-[var(--border)] space-y-1">
            <p className="text-xs text-[var(--text-secondary)] uppercase font-bold tracking-wider">{t('Average')}</p>
            <p className="text-xl font-mono font-bold">{formatCurrency(selectedPayee.averageAmount)}</p>
          </div>
          <div className="bg-[var(--card)] p-4 rounded-2xl border border-[var(--border)] space-y-1">
            <p className="text-xs text-[var(--text-secondary)] uppercase font-bold tracking-wider">{t('Last Date')}</p>
            <p className="text-sm font-medium">{format(new Date(selectedPayee.lastTransactionDate), 'dd MMM yyyy')}</p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-bold">{t('History')}</h3>
          {selectedPayeeTransactions && selectedPayeeTransactions.length > 0 ? (
            <div className="space-y-2">
              {selectedPayeeTransactions.map(tx => (
                <TransactionCard
                  key={tx.id}
                  tx={tx}
                  categoryMap={{}} // Simplified for history view
                  walletMap={{}} // Simplified for history view
                  searchTerm=""
                  hideAmount={false}
                  isSelectionMode={false}
                  isSelected={false}
                  isActionOpen={false}
                  onSelect={() => {}}
                  onClick={() => {}}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  onActionOpen={() => {}}
                  onActionClose={() => {}}
                />
              ))}
            </div>
          ) : (
            <EmptyState 
            title={t('No transactions found')} 
            description={t('No transactions found for this merchant')}
          />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t('Recipients & Merchants')}</h1>
      </div>

      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] transition-colors" size={18} />
        <input 
          type="text" 
          placeholder={t('Search Merchant')} 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all"
        />
      </div>

      <div className="space-y-3">
        {filteredPayees.length === 0 ? (
          <EmptyState 
            icon={<ShoppingBag size={48} className="opacity-20" />}
            title={t('No Merchants Found')} 
            description={t('Add some expense transactions to see your merchants here.')}
          />
        ) : (
          filteredPayees.map(payee => (
            <button
              key={payee.name}
              onClick={() => setSelectedPayee(payee)}
              className="w-full flex items-center justify-between p-4 bg-[var(--card)] border border-[var(--border)] rounded-2xl hover:border-[var(--accent)] transition-all active:scale-[0.98] text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--bg)] rounded-xl text-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-white transition-colors">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <p className="font-bold">{payee.name}</p>
                  <p className="text-xs text-[var(--text-secondary]">
                    {payee.transactionCount} {t('Txs')} • {t('Avg')} {formatCurrency(payee.averageAmount)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-red-500">{formatCurrency(payee.totalExpense)}</p>
                <p className="text-[10px] text-[var(--text-secondary)] uppercase font-bold">{t('Total Spent')}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
