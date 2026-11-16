import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionForm } from '../../src/components/forms/TransactionForm';
import { analyticsFixture } from '../fixtures';

const { categories, goals } = analyticsFixture();

function setup(initial?: Parameters<typeof TransactionForm>[0]['initial']) {
  const onSubmit = vi.fn();
  render(
    <TransactionForm
      goals={goals}
      categories={categories}
      initial={initial}
      onSubmit={onSubmit}
      onCancel={vi.fn()}
    />,
  );
  return { user: userEvent.setup(), onSubmit };
}

beforeEach(() => {
  vi.setSystemTime(new Date(2026, 10, 16, 10, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TransactionForm', () => {
  it('defaults the date to today and auto-fills the goal category', async () => {
    const { user } = setup();
    expect(screen.getByLabelText(/^date/i)).toHaveValue('2026-11-16');
    await user.selectOptions(screen.getByLabelText(/^goal/i), '3');
    expect(screen.getByRole('combobox', { name: /category/i })).toHaveValue('Health');
    await user.selectOptions(screen.getByLabelText(/^goal/i), '2');
    expect(screen.getByRole('combobox', { name: /category/i })).toHaveValue('Study');
  });

  it('logs a credit transaction', async () => {
    const { user, onSubmit } = setup();
    await user.selectOptions(screen.getByLabelText(/^goal/i), '3');
    await user.type(screen.getByLabelText(/^credits/i), '40');
    await user.type(screen.getByLabelText(/note/i), '  Morning run  ');
    await user.click(screen.getByRole('button', { name: /add transaction/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      goalId: 3,
      type: 'credit',
      credits: 40,
      categoryName: 'Health',
      transactionDate: '2026-11-16',
      note: 'Morning run',
    });
  });

  it('supports debits and a category override', async () => {
    const { user, onSubmit } = setup();
    await user.selectOptions(screen.getByLabelText(/^goal/i), '2');
    await user.selectOptions(screen.getByLabelText(/^type/i), 'debit');
    await user.type(screen.getByLabelText(/^credits/i), '50');
    const category = screen.getByRole('combobox', { name: /category/i });
    await user.clear(category);
    await user.type(category, 'Health');
    await user.click(await screen.findByRole('option', { name: 'Health' }));
    await user.click(screen.getByRole('button', { name: /add transaction/i }));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ goalId: 2, type: 'debit', credits: 50, categoryName: 'Health' });
  });

  it('can create a category on the fly', async () => {
    const { user, onSubmit } = setup();
    await user.selectOptions(screen.getByLabelText(/^goal/i), '1');
    await user.type(screen.getByLabelText(/^credits/i), '10');
    const category = screen.getByRole('combobox', { name: /category/i });
    await user.clear(category);
    await user.type(category, 'Bonus');
    await user.click(await screen.findByRole('option', { name: /create "?bonus"?/i }));
    await user.click(screen.getByRole('button', { name: /add transaction/i }));
    expect(onSubmit.mock.calls[0][0].categoryName).toBe('Bonus');
  });

  it('requires a goal and a positive amount', async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole('button', { name: /add transaction/i }));
    expect(await screen.findByText(/select a goal/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.selectOptions(screen.getByLabelText(/^goal/i), '1');
    await user.type(screen.getByLabelText(/^credits/i), '0');
    await user.click(screen.getByRole('button', { name: /add transaction/i }));
    expect(await screen.findByText(/greater than 0/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('prefills an existing transaction for editing', async () => {
    const { user, onSubmit } = setup({
      goalId: 2,
      type: 'debit',
      credits: 50,
      categoryName: 'Study',
      transactionDate: '2026-11-02',
      note: 'Books',
    });
    expect(screen.getByLabelText(/^goal/i)).toHaveValue('2');
    expect(screen.getByLabelText(/^type/i)).toHaveValue('debit');
    expect(screen.getByLabelText(/^credits/i)).toHaveValue(50);
    fireEvent.change(screen.getByLabelText(/^date/i), { target: { value: '2026-11-04' } });
    await user.click(screen.getByRole('button', { name: /save transaction/i }));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      goalId: 2,
      type: 'debit',
      credits: 50,
      categoryName: 'Study',
      transactionDate: '2026-11-04',
      note: 'Books',
    });
  });
});
