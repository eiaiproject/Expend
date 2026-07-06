import { useState, useCallback, useMemo } from 'react';
import { Transaction } from '../db/db';
import { deleteTransactionsWithPairs, restoreTransactions } from '../services/deleteTransactionService';
import { toast } from '../components/Toaster';

export interface UseTransactionSelectionResult {
  isSelectionMode: boolean;
  selectedIds: number[];
  enterSelectionMode: () => void;
  exitSelectionMode: () => void;
  toggleSelection: (id: number) => void;
  handleBulkDelete: () => Promise<void>;
  isSelected: (id: number) => boolean;
}

export function useTransactionSelection(t: (key: string) => string): UseTransactionSelectionResult {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
    setSelectedIds([]);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds([]);
  }, []);

  const toggleSelection = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return Array.from(next);
    });
  }, []);

  const isSelected = useCallback((id: number) => {
    return selectedIdSet.has(id);
  }, [selectedIdSet]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0) return;

    const backups = await deleteTransactionsWithPairs(selectedIds);
    setSelectedIds([]);
    setIsSelectionMode(false);

    toast.add(`${backups.length} ${t('Transactions Deleted')}`, async () => {
      await restoreTransactions(backups);
    });
  }, [selectedIds, t]);

  return {
    isSelectionMode,
    selectedIds,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelection,
    handleBulkDelete,
    isSelected,
  };
}
