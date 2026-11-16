import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GoalForm } from '../../src/components/forms/GoalForm';
import { makeCategory, makeLabel } from '../fixtures';

const categories = [makeCategory(1, 'General', 1), makeCategory(2, 'Study')];
const labels = [makeLabel(1, 'Urgent'), makeLabel(2, '2026')];

function setup(initial?: Parameters<typeof GoalForm>[0]['initial']) {
  const onSubmit = vi.fn();
  render(
    <GoalForm categories={categories} labels={labels} initial={initial} onSubmit={onSubmit} onCancel={vi.fn()} />,
  );
  return { user: userEvent.setup(), onSubmit };
}

describe('GoalForm', () => {
  it('requires a title', async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole('button', { name: /create goal/i }));
    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a fixed goal with category and multiple labels', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText(/^title/i), '  Learn TypeScript  ');
    await user.type(screen.getByLabelText(/target credits/i), '1000');
    fireEvent.change(screen.getByLabelText(/target date/i), { target: { value: '2027-01-01' } });

    const category = screen.getByRole('combobox', { name: /category/i });
    await user.click(category);
    await user.type(category, 'Study');
    await user.click(await screen.findByRole('option', { name: 'Study' }));

    const labelInput = screen.getByLabelText(/add label/i);
    await user.type(labelInput, 'Urgent{Enter}');
    await user.type(labelInput, '2026{Enter}');
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.getByText('2026')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /create goal/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      title: 'Learn TypeScript',
      targetCredits: 1000,
      targetDate: '2027-01-01',
      categoryName: 'Study',
      labelNames: ['Urgent', '2026'],
    });
  });

  it('creates a brand-new category from the combobox', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText(/^title/i), 'New category goal');
    const category = screen.getByRole('combobox', { name: /category/i });
    await user.click(category);
    await user.type(category, 'Language');
    await user.click(await screen.findByRole('option', { name: /create "?language"?/i }));
    await user.click(screen.getByRole('button', { name: /create goal/i }));
    expect(onSubmit.mock.calls[0][0].categoryName).toBe('Language');
  });

  it('supports unlimited goals', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText(/^title/i), 'Open ended');
    await user.click(screen.getByLabelText(/no limit/i));
    expect(screen.getByLabelText(/target credits/i)).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /create goal/i }));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ title: 'Open ended', targetCredits: null });
  });

  it('rejects a zero target', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText(/^title/i), 'Zero goal');
    await user.type(screen.getByLabelText(/target credits/i), '0');
    await user.click(screen.getByRole('button', { name: /create goal/i }));
    expect(await screen.findByText(/greater than 0/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('removes a label chip before submitting', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText(/^title/i), 'Chip test');
    const labelInput = screen.getByLabelText(/add label/i);
    await user.type(labelInput, 'Urgent{Enter}');
    await user.click(screen.getByRole('button', { name: /remove urgent/i }));
    expect(screen.queryByText('Urgent')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /create goal/i }));
    expect(onSubmit.mock.calls[0][0].labelNames).toEqual([]);
  });

  it('prefills for editing', async () => {
    const { user, onSubmit } = setup({
      title: 'Run 100 km',
      targetCredits: 100,
      targetDate: '2026-11-01',
      categoryName: 'Study',
      labelNames: ['Urgent'],
    });
    expect(screen.getByLabelText(/^title/i)).toHaveValue('Run 100 km');
    expect(screen.getByLabelText(/target credits/i)).toHaveValue(100);
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save goal/i }));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      title: 'Run 100 km',
      targetCredits: 100,
      targetDate: '2026-11-01',
      categoryName: 'Study',
      labelNames: ['Urgent'],
    });
  });
});
