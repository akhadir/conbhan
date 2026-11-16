import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LedgerSection } from '../../src/components/ledger/LedgerSection';
import { ledgerEntries } from '../../src/lib/analytics';
import { analyticsFixture } from '../fixtures';

const entries = ledgerEntries(analyticsFixture());

describe('LedgerSection', () => {
  it('lists every transaction with signed credits and cleared history', () => {
    render(<LedgerSection entries={entries} />);
    expect(screen.getByText('+300 Credits')).toBeInTheDocument();
    expect(screen.getByText('−50 Credits')).toBeInTheDocument();
    expect(screen.getByText('+100 Credits')).toBeInTheDocument();
    expect(screen.getByText('Cleared')).toBeInTheDocument();
    // Goal 2 owns four ledger rows, so the title is expected more than once.
    expect(screen.getAllByText('Learn TypeScript')[0]).toBeInTheDocument();
  });

  it('groups month-wise with subtotals', async () => {
    const user = userEvent.setup();
    render(<LedgerSection entries={entries} />);
    await user.click(screen.getByRole('tab', { name: /month/i }));
    expect(screen.getByText('Nov 2026')).toBeInTheDocument();
    expect(screen.getByText('Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('Sep 2026')).toBeInTheDocument();
    expect(screen.getByText(/940 Credits/)).toBeInTheDocument();
  });

  it('groups category-wise and label-wise', async () => {
    const user = userEvent.setup();
    render(<LedgerSection entries={entries} />);
    await user.click(screen.getByRole('tab', { name: /category/i }));
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Study')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /label/i }));
    expect(screen.getByText('No label')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  it('shows a branded empty state', () => {
    render(<LedgerSection entries={[]} />);
    expect(screen.getByText(/no transactions yet/i)).toBeInTheDocument();
    expect(screen.getByText(/conbhan/i)).toBeInTheDocument();
  });
});
