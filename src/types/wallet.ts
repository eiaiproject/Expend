/**
 * Shared wallet types.
 */

export type SpendingTrend = {
  recentSpent: number;
  previousSpent: number;
  change: number;
  isUp: boolean;
} | null;
