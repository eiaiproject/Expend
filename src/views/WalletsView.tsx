import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Wallet } from '../db/db';
import { Wallet as WalletIcon, AlertCircle, Plus, Edit2, Check, X, Trash2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { confirm } from '../components/ConfirmDialog';
import { toast } from '../components/Toaster';
import { findPairedTransfer, assignTransferGroupId } from '../utils/transferUtils';
import { format, differenceInDays } from 'date-fns';
import { formatAmountLocal } from '../utils/formatUtils';
import { getTodayStr } from '../utils/dateUtils';
import { WALLET_STALE_DAYS, SPENDING_TREND_RECENT_DAYS, SPENDING_TREND_PREVIOUS_DAYS } from '../utils/constants';

export default function WalletsView() {
  const { t } = useTranslation();
  const [isAddWalletOpen, setIsAddWalletOpen] = useState(false);
  
  const wallets = useLiveQuery(() => db.wallets.toArray()) || [];

  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletBal, setNewWalletBal] = useState('');

  const handleAddWallet = async () => {
    if (!newWalletName.trim()) return;
    
    try {
      // Check for duplicate name
      const existing = wallets.find(w => w.name.toLowerCase() === newWalletName.trim().toLowerCase());
      if (existing) {
        toast.add(t('A wallet with this name already exists'));
        return;
      }

      const initialBalance = parseInt(newWalletBal.replace(/[^0-9]/g, ''), 10) || 0;
      
      await db.wallets.add({
        name: newWalletName.trim(),
        currency: 'IDR',
        initialBalance,
        lastUpdated: new Date().toISOString()
      });
      setNewWalletName('');
      setNewWalletBal('');
      setIsAddWalletOpen(false);
    } catch (err) {
      toast.add(t('Error adding wallet'));
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t('Wallets')}</h1>
        <button 
          onClick={() => setIsAddWalletOpen(true)}
          className="p-2 bg-[var(--accent)] text-white rounded-full shadow"
        >
          <Plus size={20} />
        </button>
      </div>

      {isAddWalletOpen && (
        <div className="bg-[var(--card)] p-4 rounded-xl border border-[var(--border)] shadow-sm space-y-4">
          <h2 className="font-bold">{t('New Wallet')}</h2>
          <input 
            type="text" 
            placeholder={t('Name')}
            value={newWalletName}
            onChange={(e) => setNewWalletName(e.target.value)}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2"
          />
          <input 
            type="text" 
            inputMode="numeric"
            placeholder={t('Initial Balance')}
            value={newWalletBal}
            onChange={(e) => {
               const val = e.target.value.replace(/[^0-9]/g, '');
               setNewWalletBal(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
            }}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 font-mono"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsAddWalletOpen(false)} className="px-4 py-2 text-[var(--text-secondary)]">{t('Cancel')}</button>
            <button onClick={handleAddWallet} className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg">{t('Save')}</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {wallets.map(wallet => {
          // Use pre-computed currentBalance from DB (set by transactionSaveService)
          const balance = wallet.currentBalance ?? wallet.initialBalance;
          const isStale = differenceInDays(new Date(), new Date(wallet.lastUpdated)) >= WALLET_STALE_DAYS;

          return (
             <WalletCard 
               key={wallet.id}
               wallet={wallet}
               balance={balance}
               isStale={isStale}
             />
          );
        })}
      </div>
    </div>
  );
}

interface WalletCardProps {
  wallet: Wallet;
  balance: number;
  isStale: boolean;
}

const WalletCard: React.FC<WalletCardProps> = ({ wallet, balance, isStale }) => {
  const { t } = useTranslation();
  const [isUpdating, setIsUpdating] = useState(false);
  const [absoluteBalance, setAbsoluteBalance] = useState('');
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(wallet.name);

  // Calculate spending trend using string-based date comparison
  const spendingTrend = useLiveQuery(async () => {
    const now = new Date();
    const todayStr = getTodayStr(now);
    const recentDaysAgoStr = getTodayStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - SPENDING_TREND_RECENT_DAYS));
    const previousDaysAgoStr = getTodayStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - SPENDING_TREND_PREVIOUS_DAYS));
    
    const txs = await db.transactions
      .where('walletId')
      .equals(wallet.id!)
      .and(t => t.date >= previousDaysAgoStr)
      .toArray();
    
    let recentSpent = 0;
    let previousSpent = 0;
    
    for (const tx of txs) {
      if (tx.type !== 'expense' && tx.type !== 'transfer_out') continue;
      const txDate = tx.date.split('T')[0]!;
      if (txDate >= recentDaysAgoStr && txDate <= todayStr) {
        recentSpent += tx.amount;
      } else if (txDate >= previousDaysAgoStr && txDate < recentDaysAgoStr) {
        previousSpent += tx.amount;
      }
    }
    
    if (previousSpent === 0) return null;
    
    const change = ((recentSpent - previousSpent) / previousSpent) * 100;
    return {
      recentSpent,
      previousSpent,
      change,
      isUp: change > 0
    };
  });

  const handleSaveName = async () => {
    if (!editName.trim()) {
      setIsEditingName(false);
      return;
    }
    if (editName.trim() !== wallet.name) {
      try {
        // Check for duplicate name
        const allWallets = await db.wallets.toArray();
        const duplicate = allWallets.find(w => w.id !== wallet.id && w.name.toLowerCase() === editName.trim().toLowerCase());
        if (duplicate) {
          toast.add(t('A wallet with this name already exists'));
          setIsEditingName(false);
          return;
        }
        await db.wallets.update(wallet.id!, { name: editName.trim() });
      } catch (err) {
        console.error('Failed to rename wallet:', err);
        toast.add(t('Error renaming wallet'));
      }
    }
    setIsEditingName(false);
  };

  const handleDelete = async () => {
    const confirmed = await confirm({ title: t('Delete Wallet'), message: t('Delete Wallet Confirmation'), variant: 'danger' });
    if (!confirmed) return;
    try {
      await db.transaction('rw', [db.transactions, db.wallets], async () => {
        // Find all transfer group IDs touching this wallet
        const walletTxs = await db.transactions
          .where('walletId')
          .equals(wallet.id!)
          .toArray();

        const transferGroupIds = new Set<string>();
        for (const tx of walletTxs) {
          if (tx.transferGroupId) {
            transferGroupIds.add(tx.transferGroupId);
          } else if (tx.type === 'transfer_in' || tx.type === 'transfer_out') {
            // Use shared helper to find paired transaction
            const pairedTx = await findPairedTransfer(tx);
            if (pairedTx?.id) {
              // Assign transferGroupId to both for future consistency
              const groupId = await assignTransferGroupId(tx, pairedTx);
              if (groupId) transferGroupIds.add(groupId);
            }
          }
        }

        // Delete all transactions in the wallet
        await db.transactions.where('walletId').equals(wallet.id!).delete();

        // Also delete paired transactions from OTHER wallets
        for (const groupId of transferGroupIds) {
          await db.transactions
            .where('transferGroupId')
            .equals(groupId)
            .and(t => t.walletId !== wallet.id!)
            .delete();
        }

        await db.wallets.delete(wallet.id!);
      });
    } catch (err) {
      console.error('Failed to delete wallet:', err);
      toast.add(t('Error deleting wallet'));
    }
  };

  const handleUpdate = async () => {
    const absBal = parseInt(absoluteBalance.replace(/[^0-9]/g, ''), 10);
    if (isNaN(absBal)) return;

    try {
      const difference = absBal - balance;
      if (difference !== 0) {
        await db.transactions.add({
          walletId: wallet.id!,
          categoryId: null,
          date: new Date().toISOString().split('T')[0] ?? '',
          description: t('Balance Update Description'),
          type: 'balance_adjustment',
          amount: difference
        });
      }

      await db.wallets.update(wallet.id!, {
        lastUpdated: new Date().toISOString()
      });

      setIsUpdating(false);
      setAbsoluteBalance('');
    } catch (err) {
      console.error('Failed to update balance:', err);
      toast.add(t('Error updating balance'));
    }
  };

  return (
    <div className={`bg-[var(--card)] rounded-[16px] p-5 shadow-sm border relative overflow-hidden ${isStale ? 'border-amber-500/30' : 'border-[var(--border)]'}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3 w-full">
          <div className="p-2 bg-[var(--bg)] rounded-lg text-[var(--accent)] shrink-0">
            <WalletIcon size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {isEditingName ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                    className="flex-1 min-w-0 bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-sm font-bold focus:outline-none focus:border-[var(--accent)]"
                    autoFocus
                  />
                  <button onClick={handleSaveName} className="p-1 text-green-500 hover:bg-green-500/10 rounded">
                    <Check size={18} />
                  </button>
                  <button onClick={() => { setEditName(wallet.name); setIsEditingName(false); }} className="p-1 text-red-500 hover:bg-red-500/10 rounded">
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold truncate">{wallet.name}</h3>
                  </div>
                  <div className="flex items-center">
                    <button 
                      onClick={() => setIsEditingName(true)} 
                      className="p-1 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all shrink-0"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={handleDelete} 
                      className="p-1 text-[var(--text-secondary)] hover:text-red-500 transition-all shrink-0 ml-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              {t('Last Update')}: {format(new Date(wallet.lastUpdated), 'dd MMM yyyy')}
              {isStale && (
                <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 text-amber-600 text-[10px] font-semibold rounded">
                  <AlertCircle size={10} />
                  {differenceInDays(new Date(), new Date(wallet.lastUpdated))}d {t('stale')}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <p className="font-mono text-2xl font-bold">
          Rp {formatAmountLocal(balance)}
        </p>
        {spendingTrend && (
          <div className="flex items-center gap-1.5 mt-1">
            {spendingTrend.isUp ? (
              <TrendingUp size={14} className="text-red-500" />
            ) : (
              <TrendingDown size={14} className="text-green-500" />
            )}
            <span className={`text-xs font-medium ${spendingTrend.isUp ? 'text-red-500' : 'text-green-500'}`}>
              {spendingTrend.isUp ? '+' : ''}{spendingTrend.change.toFixed(0)}%
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              {t('last 7 days')}
            </span>
          </div>
        )}
      </div>

      {isStale && !isUpdating && (
        <div className="mb-3 p-3 bg-amber-500/5 rounded-xl border border-amber-500/20">
          <p className="text-xs text-amber-700 font-medium text-center">
            {t('Stale Wallet Prompt', { days: differenceInDays(new Date(), new Date(wallet.lastUpdated)) })}
          </p>
        </div>
      )}

      {!isUpdating ? (
        <button 
          onClick={() => setIsUpdating(true)}
          className={`w-full py-2 rounded-lg font-medium border transition-all active:scale-95 ${
            isStale 
              ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600' 
              : 'bg-[var(--bg)] text-[var(--accent)] border-[var(--accent)]'
          }`}
        >
          {isStale ? t('Update Now') : t('Update Balance')}
        </button>
      ) : (
        <div className="space-y-3 mt-4 border-t border-[var(--border)] pt-4">
          <p className="text-sm font-medium">{t('Absolute Balance')}</p>
          <input 
            type="text" 
            inputMode="numeric"
            value={absoluteBalance}
            onChange={(e) => {
               const val = e.target.value.replace(/[^0-9]/g, '');
               setAbsoluteBalance(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
            }}
            placeholder={t('Balance Input Placeholder')}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 font-mono"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsUpdating(false)} className="px-4 py-2 text-[var(--text-secondary)]">{t('Cancel')}</button>
            <button onClick={handleUpdate} className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg">{t('Save')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
