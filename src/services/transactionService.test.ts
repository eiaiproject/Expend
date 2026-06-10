import { describe, it, expect } from 'vitest';
import { buildCategoryMap, buildWalletMap } from './transactionService';
import { Category, Wallet } from '../db/db';

describe('buildCategoryMap', () => {
  it('returns empty object for empty array', () => {
    expect(buildCategoryMap([])).toEqual({});
  });

  it('maps categories by id', () => {
    const cats: Category[] = [
      { id: 1, name: 'Food', icon: '🍔', color: '#ff0000' },
      { id: 2, name: 'Transport', icon: '🚗', color: '#00ff00' },
    ];
    const map = buildCategoryMap(cats);
    expect(map[1]?.name).toBe('Food');
    expect(map[2]?.name).toBe('Transport');
    expect(map[3]).toBeUndefined();
  });

  it('skips categories without id', () => {
    const cats: Category[] = [
      { id: 1, name: 'Food', icon: '🍔', color: '#ff0000' },
      { name: 'NoId', icon: '❓', color: '#ccc' } as Category,
    ];
    const map = buildCategoryMap(cats);
    expect(Object.keys(map)).toHaveLength(1);
  });
});

describe('buildWalletMap', () => {
  it('returns empty object for empty array', () => {
    expect(buildWalletMap([])).toEqual({});
  });

  it('maps wallets by id', () => {
    const wallets: Wallet[] = [
      { id: 1, name: 'Cash', currency: 'IDR', initialBalance: 0, lastUpdated: '2024-01-01' },
      { id: 2, name: 'Bank', currency: 'IDR', initialBalance: 1000, lastUpdated: '2024-01-01' },
    ];
    const map = buildWalletMap(wallets);
    expect(map[1]?.name).toBe('Cash');
    expect(map[2]?.name).toBe('Bank');
  });

  it('skips wallets without id', () => {
    const wallets: Wallet[] = [
      { id: 1, name: 'Cash', currency: 'IDR', initialBalance: 0, lastUpdated: '2024-01-01' },
      { name: 'NoId', currency: 'IDR', initialBalance: 0, lastUpdated: '2024-01-01' } as Wallet,
    ];
    const map = buildWalletMap(wallets);
    expect(Object.keys(map)).toHaveLength(1);
  });
});
