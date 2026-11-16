import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GoalCard } from '../../src/components/goals/GoalCard';
import type { GoalStats } from '../../src/lib/analytics';
import { makeCategory, makeGoal, makeLabel } from '../fixtures';

function makeStat(overrides: Partial<GoalStats> = {}): GoalStats {
  return {
    goal: makeGoal({
      id: 2,
      title: 'Learn TypeScript',
      categoryId: 2,
      targetCredits: 1000,
      targetDate: '2027-01-01',
      labelIds: [1, 2],
    }),
    category: makeCategory(2, 'Study'),
    labels: [makeLabel(1, 'Urgent'), makeLabel(2, '2026')],
    active: 750,
    earned: 900,
    net: 850,
    cleared: 100,
    target: 1000,
    txCount: 4,
    progressPct: 75,
    barPct: 75,
    pace: {
      daysLeft: 46,
      overdue: false,
      dueToday: false,
      complete: false,
      remaining: 650,
      daily: 14.13,
      weekly: 98.91,
      monthly: 423.91,
    },
    deadline: 'upcoming',
    milestone: null,
    ...overrides,
  };
}

function renderCard(stat: GoalStats, overrides: Partial<React.ComponentProps<typeof GoalCard>> = {}) {
  const handlers = {
    onAddCredits: vi.fn(),
    onEdit: vi.fn(),
    onClear: vi.fn(),
    onToggleComplete: vi.fn(),
    onDelete: vi.fn(),
  };
  render(<GoalCard stat={stat} {...handlers} {...overrides} />);
  return { user: userEvent.setup(), ...handlers };
}

describe('GoalCard', () => {
  it('shows progress, category, labels and required pace', () => {
    renderCard(makeStat());
    expect(screen.getByText('Learn TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Study')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.getByText('2026')).toBeInTheDocument();
    expect(screen.getByText('750 / 1,000 Credits — 75%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
    expect(screen.getByText('46 days left')).toBeInTheDocument();
    expect(screen.getByText(/\+14\.13 Credits\/day/)).toBeInTheDocument();
    expect(screen.getByText(/1 Jan 2027/)).toBeInTheDocument();
  });

  it('shows an overdue badge', () => {
    renderCard(
      makeStat({
        deadline: 'overdue',
        pace: {
          daysLeft: -15,
          overdue: true,
          dueToday: false,
          complete: false,
          remaining: 60,
          daily: 60,
          weekly: 420,
          monthly: 1800,
        },
      }),
    );
    expect(screen.getByText(/overdue/i)).toBeInTheDocument();
  });

  it('renders unlimited goals with milestone progress', () => {
    renderCard(
      makeStat({
        goal: makeGoal({ id: 1, title: 'General Credits', categoryId: 1, isDefault: 1 }),
        category: makeCategory(1, 'General', 1),
        labels: [],
        active: 25,
        earned: 25,
        net: 25,
        cleared: 0,
        target: null,
        txCount: 1,
        progressPct: null,
        barPct: null,
        pace: null,
        deadline: 'no-date',
        milestone: { reached: 0, next: 100, toNext: 75, progressPct: 25 },
      }),
    );
    expect(screen.getByText(/25 Credits accumulated/i)).toBeInTheDocument();
    expect(screen.getByText(/next milestone/i)).toBeInTheDocument();
    expect(screen.getByText(/100 Credits/i)).toBeInTheDocument();
  });

  it('cannot delete a goal with transaction history but can clear it', async () => {
    const { user, onClear, onDelete } = renderCard(makeStat());
    expect(screen.getByRole('button', { name: /^delete/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /clear goal/i }));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('allows deleting a goal with no history', async () => {
    const { user, onDelete } = renderCard(makeStat({ txCount: 0, active: 0, earned: 0, net: 0, cleared: 0, progressPct: 0, barPct: 0 }));
    const del = screen.getByRole('button', { name: /^delete/i });
    expect(del).toBeEnabled();
    await user.click(del);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('marks a goal completed and reopens it', async () => {
    const { user, onToggleComplete } = renderCard(makeStat());
    await user.click(screen.getByRole('button', { name: /mark completed/i }));
    expect(onToggleComplete).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }), true);
  });

  it('shows the completed state', async () => {
    const { user, onToggleComplete } = renderCard(
      makeStat({
        goal: makeGoal({
          id: 2,
          title: 'Learn TypeScript',
          categoryId: 2,
          targetCredits: 1000,
          completedAt: '2026-11-10T09:00:00.000Z',
        }),
        deadline: 'completed',
        progressPct: 100,
        barPct: 100,
      }),
    );
    expect(screen.getByText(/completed/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /reopen/i }));
    expect(onToggleComplete).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }), false);
  });
});
