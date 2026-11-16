import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTERS,
  buildCategoryStats,
  buildGoalStats,
  buildLabelStats,
  computeTotals,
  dailyTrend,
  filterSnapshot,
  groupLedger,
  ledgerEntries,
  monthlyTrend,
} from '../../src/lib/analytics';
import { analyticsFixture } from '../fixtures';

const TODAY = '2026-11-16';
const snapshot = analyticsFixture();
const stats = buildGoalStats(snapshot, TODAY);

const byId = (id: number) => stats.find((s) => s.goal.id === id)!;

describe('goal stats', () => {
  it('separates active, cleared and all-time credits', () => {
    const learn = byId(2);
    expect(learn.active).toBe(750);
    expect(learn.earned).toBe(900);
    expect(learn.net).toBe(850);
    expect(learn.cleared).toBe(100);
    expect(learn.target).toBe(1000);
    expect(learn.progressPct).toBe(75);
    // txCount always includes cleared rows so history-dependent delete guards stay correct.
    expect(learn.txCount).toBe(4);
  });

  it('handles unlimited, complete, overdue and upcoming goals', () => {
    expect(byId(1).target).toBeNull();
    expect(byId(1).progressPct).toBeNull();
    expect(byId(1).milestone).toMatchObject({ reached: 0, next: 100, toNext: 75, progressPct: 25 });
    expect(byId(4).progressPct).toBe(100);
    expect(byId(3).deadline).toBe('overdue');
    expect(byId(2).deadline).toBe('upcoming');
    expect(byId(4).deadline).toBe('completed');
    expect(byId(3).pace?.daily).toBe(60);
  });

  it('attaches the goal category and label objects', () => {
    expect(byId(2).category?.name).toBe('Study');
    expect(byId(2).labels.map((l) => l.name)).toEqual(['Urgent', '2026']);
    expect(byId(1).labels).toEqual([]);
    expect(byId(4).category?.name).toBe('Study');
  });

  it('caps the progress bar at 100% but keeps the raw percentage', () => {
    const over = buildGoalStats(
      {
        ...snapshot,
        transactions: [
          ...snapshot.transactions,
          {
            id: 99,
            goalId: 3,
            categoryId: 3,
            credits: 500,
            type: 'credit',
            note: '',
            isCleared: 0,
            transactionDate: '2026-11-05',
            createdAt: '2026-11-05T12:00:00.000Z',
          },
        ],
      },
      TODAY,
    ).find((s) => s.goal.id === 3)!;
    expect(over.active).toBe(540);
    expect(over.progressPct).toBe(540);
    expect(over.barPct).toBe(100);
  });
});

describe('totals', () => {
  // Active = every non-default goal not explicitly marked completed (even if its target was reached).
  // Completion = credit-weighted progress over fixed-target goals; goalCompletionRate = reached / fixed.
  const totals = computeTotals(stats);

  it('computes credit totals including cleared and completed goals', () => {
    expect(totals.activeCredits).toBe(827);
    expect(totals.allTimeEarned).toBe(977);
    expect(totals.allTimeNet).toBe(927);
    expect(totals.clearedCredits).toBe(100);
  });

  it('computes active and completed goal counts', () => {
    expect(totals.activeGoals).toBe(2);
    expect(totals.completedGoals).toBe(1);
    expect(totals.fixedGoals).toBe(3);
    expect(totals.reachedFixedGoals).toBe(1);
  });

  it('computes credit-weighted and count-based completion', () => {
    expect(totals.weightedCompletion).toBe(72.12);
    expect(totals.goalCompletionRate).toBe(33.33);
  });

  it('computes the combined credits held by active goals', () => {
    // Active goals: Learn TypeScript (750) + Run 100 km (40) = 790.
    // The permanent default goal and the completed goal are excluded.
    expect(totals.activeGoalsCredits).toBe(790);
  });
});

describe('category breakdown', () => {
  const rows = buildCategoryStats(snapshot, stats);

  it('aggregates active and all-time credits by transaction category', () => {
    expect(rows.map((r) => [r.category.name, r.active, r.earned])).toEqual([
      ['General', 25, 25],
      ['Study', 262, 412],
      ['Health', 540, 540],
    ]);
  });

  it('reports transaction counts, goal counts and share of active credits', () => {
    const study = rows.find((r) => r.category.name === 'Study')!;
    expect(study.txnCount).toBe(4);
    expect(study.goalCount).toBe(2);
    expect(study.sharePct).toBe(31.68);
    const health = rows.find((r) => r.category.name === 'Health')!;
    expect(health.sharePct).toBe(65.3);
  });

  it('keeps cleared transactions in the all-time column only', () => {
    const study = rows.find((r) => r.category.name === 'Study')!;
    expect(study.earned).toBe(412);
    expect(study.active).toBe(262);
    expect(study.cleared).toBe(100);
  });
});

describe('label breakdown', () => {
  const rows = buildLabelStats(snapshot, stats);

  it('aggregates through every label on a goal', () => {
    expect(rows.map((r) => [r.label.name, r.active, r.earned, r.goalCount])).toEqual([
      ['Urgent', 750, 900, 1],
      ['2026', 790, 940, 2],
    ]);
  });

  it('counts a transaction once per label, including cleared rows', () => {
    const urgent = rows.find((r) => r.label.name === 'Urgent')!;
    const year = rows.find((r) => r.label.name === '2026')!;
    expect(urgent.txnCount).toBe(4);
    expect(year.txnCount).toBe(5);
  });
});

describe('trends', () => {
  it('builds a zero-filled day-wise trend', () => {
    const rows = dailyTrend(snapshot.transactions, TODAY, 30);
    expect(rows).toHaveLength(30);
    expect(rows[0].key).toBe('2026-10-18');
    const nov1 = rows.find((r) => r.key === '2026-11-01')!;
    expect(nov1.earned).toBe(340);
    expect(nov1.net).toBe(340);
    expect(rows.find((r) => r.key === '2026-11-02')!.earned).toBe(0);
    expect(rows.find((r) => r.key === '2026-11-02')!.net).toBe(-50);
    expect(rows.find((r) => r.key === '2026-11-03')!.earned).toBe(100);
    expect(rows.find((r) => r.key === '2026-11-10')!.earned).toBe(500);
  });

  it('builds a zero-filled month-wise trend', () => {
    const rows = monthlyTrend(snapshot.transactions, TODAY, 3);
    expect(rows.map((r) => r.key)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(rows.map((r) => r.earned)).toEqual([25, 12, 940]);
    expect(rows.map((r) => r.net)).toEqual([25, 12, 890]);
  });
});

describe('ledger grouping', () => {
  const entries = ledgerEntries(snapshot);

  it('joins goals, categories and labels onto transactions', () => {
    const t7 = entries.find((e) => e.txn.id === 7)!;
    expect(t7.goal?.title).toBe('Learn TypeScript');
    expect(t7.category?.name).toBe('Health');
    expect(t7.labels.map((l) => l.name)).toEqual(['Urgent', '2026']);
    expect(entries[0].txn.id).toBe(7);
  });

  it('groups day-wise with subtotals, newest first', () => {
    const groups = groupLedger(entries, 'day');
    expect(groups.map((g) => g.key)).toEqual([
      '2026-11-10',
      '2026-11-03',
      '2026-11-02',
      '2026-11-01',
      '2026-10-05',
      '2026-09-15',
    ]);
    expect(groups[0].label).toBe('10 Nov 2026');
    const nov1 = groups.find((g) => g.key === '2026-11-01')!;
    expect(nov1.entries).toHaveLength(2);
    expect(nov1.earned).toBe(340);
  });

  it('groups month-wise', () => {
    const groups = groupLedger(entries, 'month');
    expect(groups.map((g) => [g.key, g.label, g.entries.length])).toEqual([
      ['2026-11', 'Nov 2026', 5],
      ['2026-10', 'Oct 2026', 1],
      ['2026-09', 'Sep 2026', 1],
    ]);
  });

  it('groups category-wise by the transaction category, highest first', () => {
    const groups = groupLedger(entries, 'category');
    expect(groups.map((g) => [g.label, g.earned, g.entries.length])).toEqual([
      ['Health', 540, 2],
      ['Study', 412, 4],
      ['General', 25, 1],
    ]);
  });

  it('groups label-wise, including a no-label bucket', () => {
    const groups = groupLedger(entries, 'label');
    // Cleared rows are included, and each label counts the transaction once per goal label.
    expect(groups.map((g) => [g.label, g.earned, g.entries.length])).toEqual([
      ['2026', 940, 5],
      ['Urgent', 900, 4],
      ['No label', 37, 2],
    ]);
  });
});

describe('filtering', () => {
  it('filters goals and their transactions by label', () => {
    const filtered = filterSnapshot(snapshot, { ...DEFAULT_FILTERS, labelIds: [1] }, TODAY);
    expect(filtered.goals.map((g) => g.id)).toEqual([2]);
    expect(filtered.transactions.map((t) => t.id)).toEqual([1, 2, 3, 7]);
  });

  it('matches any of several labels', () => {
    const filtered = filterSnapshot(snapshot, { ...DEFAULT_FILTERS, labelIds: [1, 2] }, TODAY);
    expect(filtered.goals.map((g) => g.id)).toEqual([2, 3]);
  });

  // The global category filter narrows goals by goal.categoryId; ledger category grouping follows
  // transaction.categoryId, which can differ when a transaction overrides its goal category.
  it('filters by goal category', () => {
    const filtered = filterSnapshot(snapshot, { ...DEFAULT_FILTERS, categoryId: 3 }, TODAY);
    expect(filtered.goals.map((g) => g.id)).toEqual([3]);
    expect(filtered.transactions).toHaveLength(1);
  });

  it('filters by deadline status', () => {
    expect(filterSnapshot(snapshot, { ...DEFAULT_FILTERS, deadline: 'overdue' }, TODAY).goals.map((g) => g.id)).toEqual([3]);
    expect(filterSnapshot(snapshot, { ...DEFAULT_FILTERS, deadline: 'completed' }, TODAY).goals.map((g) => g.id)).toEqual([4]);
    expect(filterSnapshot(snapshot, { ...DEFAULT_FILTERS, deadline: 'upcoming' }, TODAY).goals.map((g) => g.id)).toEqual([2]);
    expect(filterSnapshot(snapshot, { ...DEFAULT_FILTERS, deadline: 'no-date' }, TODAY).goals.map((g) => g.id)).toEqual([1]);
    expect(filterSnapshot(snapshot, { ...DEFAULT_FILTERS, deadline: 'active' }, TODAY).goals.map((g) => g.id)).toEqual([1, 2, 3]);
  });

  it('searches titles, category names, label names and notes', () => {
    expect(filterSnapshot(snapshot, { ...DEFAULT_FILTERS, search: 'run' }, TODAY).goals.map((g) => g.id)).toEqual([3]);
    expect(filterSnapshot(snapshot, { ...DEFAULT_FILTERS, search: 'health' }, TODAY).goals.map((g) => g.id)).toEqual([3]);
    expect(filterSnapshot(snapshot, { ...DEFAULT_FILTERS, search: 'urgent' }, TODAY).goals.map((g) => g.id)).toEqual([2]);
    expect(filterSnapshot(snapshot, { ...DEFAULT_FILTERS, search: 'sprint bonus' }, TODAY).goals.map((g) => g.id)).toEqual([2]);
    expect(filterSnapshot(snapshot, { ...DEFAULT_FILTERS, search: '  ' }, TODAY).goals).toHaveLength(4);
  });

  it('combines filters and never mutates the source snapshot', () => {
    const filtered = filterSnapshot(snapshot, { ...DEFAULT_FILTERS, labelIds: [2], categoryId: 2 }, TODAY);
    expect(filtered.goals.map((g) => g.id)).toEqual([2]);
    expect(filtered.categories).toHaveLength(3);
    expect(snapshot.transactions).toHaveLength(7);
  });
});
