import { describe, expect, it } from 'vitest';
import { deadlineStatus, goalPace, milestoneInfo, MILESTONE_STEP } from '../../src/lib/pace';
import { makeGoal } from '../fixtures';

const TODAY = '2026-11-16';

describe('goalPace', () => {
  it('spreads remaining credits over the days left', () => {
    expect(goalPace(350, 1000, '2027-01-01', TODAY)).toEqual({
      daysLeft: 46,
      overdue: false,
      dueToday: false,
      complete: false,
      remaining: 650,
      daily: 14.13,
      weekly: 98.91,
      monthly: 423.91,
    });
  });

  it('asks for the full remaining amount once overdue or due today', () => {
    expect(goalPace(10, 100, '2026-11-01', TODAY)).toMatchObject({
      daysLeft: -15,
      overdue: true,
      dueToday: false,
      remaining: 90,
      daily: 90,
      weekly: 630,
      monthly: 2700,
    });
    expect(goalPace(50, 100, TODAY, TODAY)).toMatchObject({
      daysLeft: 0,
      overdue: false,
      dueToday: true,
      remaining: 50,
      daily: 50,
    });
  });

  it('returns null for completed, open-ended and unlimited goals', () => {
    expect(goalPace(1000, 1000, '2027-01-01', TODAY)).toBeNull();
    expect(goalPace(400, 1000, null, TODAY)).toBeNull();
    expect(goalPace(400, null, '2027-01-01', TODAY)).toBeNull();
    expect(goalPace(0, null, null, TODAY)).toBeNull();
  });

  it('rounds each rate at the end, derived from the same remaining/day ratio', () => {
    const pace = goalPace(0, 100, '2026-11-19', TODAY)!;
    expect(pace.daily).toBe(33.33);
    expect(pace.weekly).toBe(233.33);
    expect(pace.monthly).toBe(1000);
  });
});

describe('deadlineStatus', () => {
  it('classifies completed, reached, overdue, due today, upcoming and open goals', () => {
    expect(deadlineStatus(makeGoal({ id: 1, title: 'a', categoryId: 1, completedAt: '2026-11-10' }), 10, TODAY)).toBe(
      'completed',
    );
    expect(deadlineStatus(makeGoal({ id: 1, title: 'a', categoryId: 1 }), 10, TODAY)).toBe('no-date');
    expect(
      deadlineStatus(makeGoal({ id: 1, title: 'a', categoryId: 1, targetCredits: 10, targetDate: '2026-12-01' }), 10, TODAY),
    ).toBe('reached');
    expect(
      deadlineStatus(makeGoal({ id: 1, title: 'a', categoryId: 1, targetCredits: 20, targetDate: '2026-11-01' }), 10, TODAY),
    ).toBe('overdue');
    expect(
      deadlineStatus(makeGoal({ id: 1, title: 'a', categoryId: 1, targetCredits: 20, targetDate: TODAY }), 10, TODAY),
    ).toBe('due-today');
    expect(
      deadlineStatus(makeGoal({ id: 1, title: 'a', categoryId: 1, targetCredits: 20, targetDate: '2026-12-01' }), 10, TODAY),
    ).toBe('upcoming');
  });
});

describe('milestones', () => {
  it('tracks the next 100-credit milestone for unlimited goals', () => {
    expect(MILESTONE_STEP).toBe(100);
    expect(milestoneInfo(0)).toEqual({ reached: 0, next: 100, toNext: 100, progressPct: 0 });
    expect(milestoneInfo(250)).toEqual({ reached: 2, next: 300, toNext: 50, progressPct: 50 });
    expect(milestoneInfo(100)).toEqual({ reached: 1, next: 200, toNext: 100, progressPct: 0 });
    expect(milestoneInfo(999.5).toNext).toBe(0.5);
  });
});
