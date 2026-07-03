import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Search, ArrowLeft, ShoppingBag, Edit2, X } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';
import { displayDateMedium } from '../utils/dateUtils';
import { getPayeeStatsFromTransactions, filterTransactionsByPayee, PayeeStats } from '../services/payeeService';
import { TransactionCard } from '../components/home/TransactionCard';
import { EmptyState } from '../components/EmptyState';
import { toast } from '../components/Toaster';

export default function PayeesView() {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPayee, setSelectedPayee] = useState<PayeeStats | null>(null);
  const [renamingPayee, setRenamingPayee] = useState<PayeeStats | null>(null);
  const [newPayeeName, setNewPayeeName] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const payees = useLiveQuery(async () => {
    return await getPayeeStatsFromTransactions();
  }, []);

  const filteredPayees = useMemo(() => {
    if (!payees) return [];
    if (!searchQuery.trim()) return payees;
    const lower = searchQuery.toLowerCase();
    return payees.filter(p => p.name.toLowerCase().includes(lower));
  }, [payees, searchQuery]);

  useEffect(() => {
    if (renamingPayee && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingPayee]);

  const handleRename = async () => {
    if (!renamingPayee || !newPayeeName.trim()) return;
    const oldName = renamingPayee.name;
    const trimmedName = newPayeeName.trim();
    
    if (oldName === trimmedName) {
      setRenamingPayee(null);
      return;
    }

    await db.transactions
      .where('description')
      .equals(oldName)
      .modify({ description: trimmedName });
    
    toast.add(t('Renamed to') + ' ' + trimmedName);
    setRenamingPayee(null);
    setSelectedPayee(null);
  };

  const selectedPayeeTransactions = useLiveQuery(async () => {
    if (!selectedPayee) return [];
    return await filterTransactionsByPayee(selectedPayee.name);
  }, [selectedPayee]);

  // Detail view
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
            <p className="text-sm font-medium">{displayDateMedium(selectedPayee.lastTransactionDate, i18n.language)}</p>
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
                  categoryMap={{}}
                  walletMap={{}}
                  searchTerm=""
                  hideAmount={false}
                  isSelectionMode={false}
                  isSelected={false}
                  onSelect={() => {}}
                  onClick={() => {}}
                  onEdit={() => {}}
                  onDelete={() => {}}
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

        <button
          onClick={() => {
            setRenamingPayee(selectedPayee);
            setNewPayeeName(selectedPayee.name);
          }}
          className="w-full flex items-center justify-center gap-2 p-4 bg-[var(--card)] border border-[var(--border)] rounded-[16px] hover:border-[var(--accent)]/40 transition-colors"
        >
          <Edit2 size={18} />
          <span className="font-medium">{t('Rename')}</span>
        </button>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
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
          className="w-full pl-10 pr-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
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
              className="w-full flex items-center justify-between p-4 bg-[var(--card)] border border-[var(--border)] rounded-[16px] hover:border-[var(--accent)]/40 transition-[border-color,box-shadow] active:scale-[0.98] text-left group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-[var(--bg)] rounded-xl text-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-white transition-colors">
                  <ShoppingBag size={20} aria-hidden="true" />
                </div>
                <div>
                  <p className="font-bold">{payee.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {payee.transactionCount} {t('Txs')} • {t('Avg')} {formatCurrency(payee.averageAmount)}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono font-bold text-[var(--expense)]">{formatCurrency(payee.totalExpense)}</p>
                <p className="text-[10px] text-[var(--text-secondary)] uppercase font-bold">{t('Total Spent')}</p>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Rename Dialog */}
      {renamingPayee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--card)] w-full max-w-sm rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{t('Rename')}</h3>
              <button onClick={() => setRenamingPayee(null)} className="p-1 rounded-full hover:bg-[var(--bg)]">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              {t('All transactions with')} <span className="font-bold">{renamingPayee.name}</span> {t('will be renamed')}
            </p>
            <input
              ref={renameInputRef}
              type="text"
              value={newPayeeName}
              onChange={(e) => setNewPayeeName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setRenamingPayee(null)}
                className="flex-1 py-3 rounded-xl border border-[var(--border)] font-medium hover:bg-[var(--bg)] transition-colors"
              >
                {t('Cancel')}
              </button>
              <button
                onClick={handleRename}
                disabled={!newPayeeName.trim()}
                className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-white font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {t('Rename')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
