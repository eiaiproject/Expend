import { useState, useCallback } from 'react';

export interface SortConfig {
  field: string;
  order: 'asc' | 'desc';
}

export interface UseTransactionSortResult {
  sortConfig: SortConfig;
  toggleSortOrder: () => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  setSortField: (field: string) => void;
}

export function useTransactionSort(
  initialField = 'date',
  initialOrder: 'asc' | 'desc' = 'desc'
): UseTransactionSortResult {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: initialField,
    order: initialOrder,
  });

  const toggleSortOrder = useCallback(() => {
    setSortConfig(prev => ({
      ...prev,
      order: prev.order === 'desc' ? 'asc' : 'desc',
    }));
  }, []);

  const setSortOrder = useCallback((order: 'asc' | 'desc') => {
    setSortConfig(prev => ({ ...prev, order }));
  }, []);

  const setSortField = useCallback((field: string) => {
    setSortConfig(prev => ({ ...prev, field }));
  }, []);

  return {
    sortConfig,
    toggleSortOrder,
    setSortOrder,
    setSortField,
  };
}
