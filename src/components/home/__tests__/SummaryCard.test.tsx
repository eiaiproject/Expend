import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SummaryCard } from '../SummaryCard';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

describe('SummaryCard', () => {
  const defaultProps = {
    isLoading: false,
    walletsTotal: 5000000,
    totalExpense: 1500000,
    expensePeriod: 'month' as const,
    onToggleExpensePeriod: vi.fn(),
    dailySummary: { today: 150000, yesterday: 85000 },
    smartInsight: null,
    hideAmount: false,
  };

  it('renders balance correctly', () => {
    render(<SummaryCard {...defaultProps} />);
    expect(screen.getByText('Balance')).toBeInTheDocument();
    expect(screen.getByText('Rp 5.000.000')).toBeInTheDocument();
  });

  it('renders total expenses correctly', () => {
    render(<SummaryCard {...defaultProps} />);
    expect(screen.getByText('Total Expenses')).toBeInTheDocument();
    expect(screen.getByText('Rp 1.500.000')).toBeInTheDocument();
  });

  it('renders daily summary', () => {
    render(<SummaryCard {...defaultProps} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    expect(screen.getByText('Rp 150.000')).toBeInTheDocument();
    expect(screen.getByText('Rp 85.000')).toBeInTheDocument();
  });

  it('hides amounts when hideAmount is true', () => {
    render(<SummaryCard {...defaultProps} hideAmount={true} />);
    expect(screen.getAllByText('•••••').length).toBeGreaterThan(0);
  });

  it('shows loading skeleton when isLoading is true', () => {
    render(<SummaryCard {...defaultProps} isLoading={true} />);
    // Skeleton elements should be present
    const skeletons = document.querySelectorAll('.skeleton-shimmer');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows spending insight when provided', () => {
    const insight = {
      text: 'Budget alert: Food exceeded budget!',
      type: 'warning' as const,
      color: 'text-red-100',
    };
    render(<SummaryCard {...defaultProps} smartInsight={insight} />);
    expect(screen.getByText('Budget alert: Food exceeded budget!')).toBeInTheDocument();
  });

  it('calculates percentage difference correctly', () => {
    render(<SummaryCard {...defaultProps} />);
    // Today is 150000, yesterday is 85000
    // Diff = (150000 - 85000) / 85000 * 100 = 76%
    expect(screen.getByText('+76%')).toBeInTheDocument();
    expect(screen.getByText('vs yesterday')).toBeInTheDocument();
  });

  it('shows "Same as yesterday" when amounts are equal', () => {
    render(
      <SummaryCard
        {...defaultProps}
        dailySummary={{ today: 100000, yesterday: 100000 }}
      />
    );
    expect(screen.getByText('Same as yesterday')).toBeInTheDocument();
  });
});
