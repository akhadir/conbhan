import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilterBar } from '../../src/components/analytics/FilterBar';
import { DEFAULT_FILTERS } from '../../src/lib/analytics';
import { analyticsFixture } from '../fixtures';

const snapshot = analyticsFixture();

describe('FilterBar', () => {
  it('toggles labels on and off', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FilterBar snapshot={snapshot} filters={DEFAULT_FILTERS} onChange={onChange} />);
    const urgent = screen.getByRole('button', { name: 'Urgent' });
    expect(urgent).toHaveAttribute('aria-pressed', 'false');
    await user.click(urgent);
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_FILTERS, labelIds: [1] });
  });

  it('removes an active label', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FilterBar snapshot={snapshot} filters={{ ...DEFAULT_FILTERS, labelIds: [1] }} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Urgent' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_FILTERS, labelIds: [] });
  });

  it('filters by category and deadline status', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FilterBar snapshot={snapshot} filters={DEFAULT_FILTERS} onChange={onChange} />);
    await user.selectOptions(screen.getByLabelText(/category/i), '3');
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_FILTERS, categoryId: 3 });
    await user.selectOptions(screen.getByLabelText(/deadline/i), 'overdue');
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_FILTERS, deadline: 'overdue' });
  });

  it('searches and clears filters', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const filters = { ...DEFAULT_FILTERS, search: 'run', categoryId: 3 };
    render(<FilterBar snapshot={snapshot} filters={filters} onChange={onChange} />);
    expect(screen.getByLabelText(/search/i)).toHaveValue('run');
    await user.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(onChange).toHaveBeenLastCalledWith(DEFAULT_FILTERS);
  });
});
