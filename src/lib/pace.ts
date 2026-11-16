import { roundCredits } from './credits';
import { daysBetween } from './dates';
import type { Goal } from '../db/schema';

export const MILESTONE_STEP = 100;

export interface GoalPace {
  daysLeft: number;
  overdue: boolean;
  dueToday: boolean;
  complete: boolean;
  remaining: number;
  daily: number;
  weekly: number;
  monthly: number;
}

export interface MilestoneInfo {
  reached: number;
  next: number;
  toNext: number;
  progressPct: number;
}

export type DeadlineStatus = 'completed' | 'no-date' | 'reached' | 'overdue' | 'due-today' | 'upcoming';

/**
 * Required credit rate for a fixed goal with a deadline.
 * Rates are all derived from the same unrounded remaining/days ratio, then rounded once.
 * Returns null when there is nothing to pace (complete, unlimited or open-ended).
 */
export function goalPace(
  active: number,
  target: number | null,
  targetDate: string | null,
  today: string,
): GoalPace | null {
  if (target === null || targetDate === null) return null;
  if (active >= target) return null;

  const daysLeft = daysBetween(today, targetDate);
  const remaining = roundCredits(target - active);
  const perDay = remaining / Math.max(daysLeft, 1);

  return {
    daysLeft,
    overdue: daysLeft < 0,
    dueToday: daysLeft === 0,
    complete: false,
    remaining,
    daily: roundCredits(perDay),
    weekly: roundCredits(perDay * 7),
    monthly: roundCredits(perDay * 30),
  };
}

export function deadlineStatus(goal: Goal, active: number, today: string): DeadlineStatus {
  if (goal.completedAt) return 'completed';
  if (!goal.targetDate) return 'no-date';
  if (goal.targetCredits !== null && active >= goal.targetCredits) return 'reached';

  const daysLeft = daysBetween(today, goal.targetDate);
  if (daysLeft < 0) return 'overdue';
  if (daysLeft === 0) return 'due-today';
  return 'upcoming';
}

export function milestoneInfo(active: number): MilestoneInfo {
  const reached = Math.floor(roundCredits(active) / MILESTONE_STEP);
  const next = (reached + 1) * MILESTONE_STEP;
  return {
    reached,
    next,
    toNext: roundCredits(next - active),
    progressPct: roundCredits(((active % MILESTONE_STEP) / MILESTONE_STEP) * 100),
  };
}
