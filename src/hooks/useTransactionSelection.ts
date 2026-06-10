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
  selectAll: (ids: number[]) => void;
  handleBulkDelete: () => Promise<void>;
  isSelected: (id: number) => boolean;
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
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  }, []);

  const selectAll = useCallback((ids: number[]) => {
    setSelectedIds(ids);
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

  return {
    isSelectionMode,
    selectedIds,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelection,
    selectAll,
    handleBulkDelete,
    isSelected,
  };
}
