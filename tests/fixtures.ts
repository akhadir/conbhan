import type { Category, Goal, Label, Snapshot, Transaction } from '../src/db/schema';

const createdAt = '2026-10-01T00:00:00.000Z';

export function makeCategory(id: number, name: string, isDefault: 0 | 1 = 0): Category {
  return { id, name, isDefault, createdAt };
}

export function makeLabel(id: number, name: string, color = '#38bdf8'): Label {
  return { id, name, color, createdAt };
}

export function makeGoal(partial: Partial<Goal> & { id: number; title: string; categoryId: number }): Goal {
  return {
    targetCredits: null,
    targetDate: null,
    labelIds: [],
    isDefault: 0,
    createdAt,
    completedAt: null,
    ...partial,
  };
}

export function makeTransaction(
  partial: Partial<Transaction> & { id: number; goalId: number; categoryId: number; credits: number; transactionDate: string },
): Transaction {
  return {
    type: 'credit',
    note: '',
    isCleared: 0,
    createdAt: `${partial.transactionDate}T12:00:00.000Z`,
    ...partial,
  };
}

/**
 * Shared analytics fixture.
 *
 * Goals:  1 General Credits (default, unlimited, cat 1)
 *         2 Learn TypeScript (cat 2, target 1000, due 2027-01-01, labels 1+2)
 *         3 Run 100 km (cat 3, target 100, due 2026-11-01, label 2)  -> overdue
 *         4 Read 12 books (cat 2, target 12, completed, no labels)
 *
 * Transactions:
 *   t1 goal2 cat2 +300  2026-11-01 active
 *   t2 goal2 cat2  -50  2026-11-02 active (debit)
 *   t3 goal2 cat2 +100  2026-11-03 cleared
 *   t4 goal3 cat3  +40  2026-11-01 active
 *   t5 goal4 cat2  +12  2026-10-05 active (completed goal)
 *   t6 goal1 cat1  +25  2026-09-15 active
 *   t7 goal2 cat3 +500  2026-11-10 active (category override)
 */
export function analyticsFixture(): Snapshot {
  return {
    categories: [makeCategory(1, 'General', 1), makeCategory(2, 'Study'), makeCategory(3, 'Health')],
    labels: [makeLabel(1, 'Urgent'), makeLabel(2, '2026', '#f472b6')],
    goals: [
      makeGoal({ id: 1, title: 'General Credits', categoryId: 1, isDefault: 1 }),
      makeGoal({
        id: 2,
        title: 'Learn TypeScript',
        categoryId: 2,
        targetCredits: 1000,
        targetDate: '2027-01-01',
        labelIds: [1, 2],
        createdAt,
      }),
      makeGoal({
        id: 3,
        title: 'Run 100 km',
        categoryId: 3,
        targetCredits: 100,
        targetDate: '2026-11-01',
        labelIds: [2],
      }),
      makeGoal({
        id: 4,
        title: 'Read 12 books',
        categoryId: 2,
        targetCredits: 12,
        completedAt: '2026-11-10T09:00:00.000Z',
      }),
    ],
    transactions: [
      makeTransaction({ id: 1, goalId: 2, categoryId: 2, credits: 300, transactionDate: '2026-11-01' }),
      makeTransaction({ id: 2, goalId: 2, categoryId: 2, credits: 50, type: 'debit', transactionDate: '2026-11-02' }),
      makeTransaction({
        id: 3,
        goalId: 2,
        categoryId: 2,
        credits: 100,
        isCleared: 1,
        transactionDate: '2026-11-03',
      }),
      makeTransaction({ id: 4, goalId: 3, categoryId: 3, credits: 40, transactionDate: '2026-11-01' }),
      makeTransaction({ id: 5, goalId: 4, categoryId: 2, credits: 12, transactionDate: '2026-10-05' }),
      makeTransaction({ id: 6, goalId: 1, categoryId: 1, credits: 25, transactionDate: '2026-09-15' }),
      makeTransaction({ id: 7, goalId: 2, categoryId: 3, credits: 500, note: 'Sprint bonus', transactionDate: '2026-11-10' }),
    ],
  };
}
