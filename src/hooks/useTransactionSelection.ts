import { useState, useCallback } from 'react';
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
  /** Select all given ids */
  selectAll: (ids: number[]) => void;
  /** Clear selection */
  deselectAll: () => void;
}

export function useTransactionSelection(t: (key: string) => string): UseTransactionSelectionResult {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
    setSelectedIds([]);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds([]);
  }, []);

  const toggleSelection = useCallback((id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, []);

  const isSelected = useCallback((id: number) => {
    return selectedIds.includes(id);
  }, [selectedIds]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0) return;

    const backups = await deleteTransactionsWithPairs(selectedIds);
    setSelectedIds([]);
    setIsSelectionMode(false);

    toast.add(`${backups.length} ${t('Transactions Deleted')}`, async () => {
      await restoreTransactions(backups);
    });
  }, [selectedIds, t]);

  const selectAll = useCallback((ids: number[]) => {
    setSelectedIds(ids);
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds([]);
  }, []);

  return {
    isSelectionMode,
    selectedIds,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelection,
    handleBulkDelete,
    isSelected,
    selectAll,
    deselectAll,
  };
}
