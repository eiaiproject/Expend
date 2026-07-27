import React from 'react';
import { useTranslation } from 'react-i18next';
import { TransactionCard } from './TransactionCard';
import type { Transaction } from '../../db/db';

interface TransactionGroupItem {
  labelKey: string;
  count: number;
  transactions: Transaction[];
}

interface TransactionGroupProps {
  group: TransactionGroupItem;
  categoryMap: Record<number, import('../../db/db').Category>;
  walletMap: Record<number, import('../../db/db').Wallet>;
  searchTerm: string;
  hideAmount: boolean;
  isSelectionMode: boolean;
  isSelected: (id: number) => boolean;
  toggleSelection: (id: number) => void;
  setSelectedTx: (tx: Transaction | null) => void;
  handleEdit: (tx: Transaction) => void;
  handleDelete: (tx: Transaction) => void;
}

export function TransactionGroup({
  group,
  categoryMap,
  walletMap,
  searchTerm,
  hideAmount,
  isSelectionMode,
  isSelected,
  toggleSelection,
  setSelectedTx,
  handleEdit,
  handleDelete,
}: TransactionGroupProps) {
  const { t } = useTranslation();
  const groupId = group.labelKey.replace('home.group', '').toLowerCase();

  return (
    <section key={group.labelKey} aria-labelledby={`tx-group-${groupId}`}>
      <h3
        id={`tx-group-${groupId}`}
        className="sticky top-0 z-10 bg-[var(--bg)] pt-1 pb-2 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider"
      >
        {t(group.labelKey, { count: group.count })}
      </h3>
      <div className="space-y-2">
        {group.transactions.map(tx => (
          <TransactionCard
            key={tx.id}
            tx={tx}
            categoryMap={categoryMap}
            walletMap={walletMap}
            searchTerm={searchTerm}
            hideAmount={hideAmount}
            isSelectionMode={isSelectionMode}
            isSelected={isSelected(tx.id!)}
            onSelect={toggleSelection}
            onClick={() => setSelectedTx(tx)}
            onEdit={() => handleEdit(tx)}
            onDelete={() => handleDelete(tx)}
            onViewDetail={() => setSelectedTx(tx)}
          />
        ))}
      </div>
    </section>
  );
}