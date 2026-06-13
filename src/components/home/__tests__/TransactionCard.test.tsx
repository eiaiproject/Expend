import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TransactionCard } from '../TransactionCard';
import type { Transaction, Category, Wallet } from '../../../db/db';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

// Mock motion/react to avoid animation issues in tests
vi.mock('motion/react', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>, ref: React.Ref<HTMLDivElement>) => {
      return <div ref={ref} {...props}>{children}</div>;
    }),
  },
}));

describe('TransactionCard', () => {
  const mockCategory: Category = {
    id: 1,
    name: 'Food',
    icon: '🍔',
    color: '#EF4444',
  };

  const mockWallet: Wallet = {
    id: 1,
    name: 'Cash',
    currency: 'IDR',
    initialBalance: 0,
    lastUpdated: '2024-01-01',
  };

  const mockTransaction: Transaction = {
    id: 1,
    walletId: 1,
    categoryId: 1,
    date: '2024-01-15',
    description: 'Lunch at Warung',
    type: 'expense',
    amount: 45000,
  };

  const defaultProps = {
    tx: mockTransaction,
    categoryMap: { 1: mockCategory },
    walletMap: { 1: mockWallet },
    searchTerm: '',
    hideAmount: false,
    isSelectionMode: false,
    isSelected: false,
    isActionOpen: false,
    onSelect: vi.fn(),
    onClick: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onActionOpen: vi.fn(),
    onActionClose: vi.fn(),
  };

  it('renders transaction description correctly', () => {
    render(<TransactionCard {...defaultProps} />);
    expect(screen.getByText('Lunch at Warung')).toBeInTheDocument();
  });

  it('renders category name correctly', () => {
    render(<TransactionCard {...defaultProps} />);
    expect(screen.getByText(/Food/)).toBeInTheDocument();
  });

  it('renders wallet name correctly', () => {
    render(<TransactionCard {...defaultProps} />);
    expect(screen.getByText('Cash')).toBeInTheDocument();
  });

  it('renders amount correctly', () => {
    render(<TransactionCard {...defaultProps} />);
    expect(screen.getByText('45.000')).toBeInTheDocument();
  });

  it('shows minus sign for expense transactions', () => {
    render(<TransactionCard {...defaultProps} />);
    const minusSign = screen.getByText('-');
    expect(minusSign).toBeInTheDocument();
  });

  it('shows plus sign for income transactions', () => {
    const incomeTransaction: Transaction = {
      ...mockTransaction,
      type: 'balance_adjustment',
      amount: 100000,
    };
    render(<TransactionCard {...defaultProps} tx={incomeTransaction} />);
    const plusSign = screen.getByText('+');
    expect(plusSign).toBeInTheDocument();
  });

  it('hides amount when hideAmount is true', () => {
    render(<TransactionCard {...defaultProps} hideAmount={true} />);
    expect(screen.getByText('•••••')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    render(<TransactionCard {...defaultProps} />);
    fireEvent.click(screen.getByText('Lunch at Warung'));
    expect(defaultProps.onClick).toHaveBeenCalledTimes(1);
  });

  it('calls onSelect when in selection mode', () => {
    render(
      <TransactionCard
        {...defaultProps}
        isSelectionMode={true}
        isSelected={false}
      />
    );
    fireEvent.click(screen.getByText('Lunch at Warung'));
    expect(defaultProps.onSelect).toHaveBeenCalledWith(1);
  });

  it('shows selection indicator when isSelected is true', () => {
    render(
      <TransactionCard
        {...defaultProps}
        isSelectionMode={true}
        isSelected={true}
      />
    );
    const selectionIndicator = document.querySelector('.bg-\\[var\\(--accent\\)\\]');
    expect(selectionIndicator).toBeInTheDocument();
  });

  it('highlights search term when provided', () => {
    render(<TransactionCard {...defaultProps} searchTerm="Lunch" />);
    const markElement = screen.getByText('Lunch');
    expect(markElement.tagName).toBe('MARK');
  });

  it('renders notes when present', () => {
    const transactionWithNotes: Transaction = {
      ...mockTransaction,
      notes: 'With colleagues',
    };
    render(<TransactionCard {...defaultProps} tx={transactionWithNotes} />);
    expect(screen.getByText('With colleagues')).toBeInTheDocument();
  });

  it('has role button and tabIndex for keyboard accessibility', () => {
    render(<TransactionCard {...defaultProps} />);
    const card = screen.getByRole('button', { name: /Lunch at Warung/i });
    expect(card).toHaveAttribute('tabindex', '0');
  });

  it('calls onClick on Enter key press', () => {
    render(<TransactionCard {...defaultProps} />);
    const card = screen.getByRole('button', { name: /Lunch at Warung/i });
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(defaultProps.onClick).toHaveBeenCalled();
  });

  it('calls onActionClose on Escape when action is open', () => {
    render(<TransactionCard {...defaultProps} isActionOpen={true} />);
    const card = screen.getByRole('button', { name: /Lunch at Warung/i });
    fireEvent.keyDown(card, { key: 'Escape' });
    expect(defaultProps.onActionClose).toHaveBeenCalledTimes(1);
  });
});
