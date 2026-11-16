import type { Category, Goal, Label, Snapshot, Transaction } from '../db/schema';
import { roundCredits } from './credits';
import { formatDate, formatMonth, lastNDays, lastNMonths, monthKey } from './dates';
import { deadlineStatus, goalPace, milestoneInfo } from './pace';
import type { DeadlineStatus, GoalPace, MilestoneInfo } from './pace';

export type DeadlineFilter = 'all' | 'active' | 'upcoming' | 'overdue' | 'due-today' | 'no-date' | 'completed';

export interface Filters {
  labelIds: number[];
  categoryId: number | null;
  deadline: DeadlineFilter;
  search: string;
}

export const DEFAULT_FILTERS: Filters = {
  labelIds: [],
  categoryId: null,
  deadline: 'all',
  search: '',
};

export interface GoalStats {
  goal: Goal;
  category?: Category;
  labels: Label[];
  active: number;
  earned: number;
  net: number;
  cleared: number;
  target: number | null;
  txCount: number;
  progressPct: number | null;
  barPct: number | null;
  pace: GoalPace | null;
  deadline: DeadlineStatus;
  milestone: MilestoneInfo | null;
}

export interface Totals {
  activeCredits: number;
  allTimeEarned: number;
  allTimeNet: number;
  clearedCredits: number;
  activeGoals: number;
  completedGoals: number;
  fixedGoals: number;
  reachedFixedGoals: number;
  weightedCompletion: number;
  goalCompletionRate: number;
}

export interface CategoryStat {
  category: Category;
  active: number;
  earned: number;
  net: number;
  cleared: number;
  txnCount: number;
  goalCount: number;
  sharePct: number;
}

export interface LabelStat {
  label: Label;
  active: number;
  earned: number;
  net: number;
  cleared: number;
  txnCount: number;
  goalCount: number;
  sharePct: number;
}

export interface TrendPoint {
  key: string;
  earned: number;
  net: number;
}

export interface LedgerEntry {
  txn: Transaction;
  goal?: Goal;
  category?: Category;
  labels: Label[];
}

export interface LedgerGroup {
  key: string;
  label: string;
  entries: LedgerEntry[];
  earned: number;
  net: number;
}

export type LedgerGroupMode = 'day' | 'month' | 'category' | 'label';

function signed(transaction: Transaction): number {
  return transaction.type === 'credit' ? transaction.credits : -transaction.credits;
}

function sumSigned(transactions: Transaction[]): number {
  return roundCredits(transactions.reduce((sum, transaction) => sum + signed(transaction), 0));
}

function sumEarned(transactions: Transaction[]): number {
  return roundCredits(
    transactions
      .filter((transaction) => transaction.type === 'credit')
      .reduce((sum, transaction) => sum + transaction.credits, 0),
  );
}

export function buildGoalStats(snapshot: Snapshot, today: string): GoalStats[] {
  const categories = new Map(snapshot.categories.map((category) => [category.id!, category]));
  const labels = new Map(snapshot.labels.map((label) => [label.id!, label]));
  const byGoal = new Map<number, Transaction[]>();

  for (const transaction of snapshot.transactions) {
    const list = byGoal.get(transaction.goalId) ?? [];
    list.push(transaction);
    byGoal.set(transaction.goalId, list);
  }

  return snapshot.goals.map((goal) => {
    const transactions = byGoal.get(goal.id!) ?? [];
    const activeTransactions = transactions.filter((transaction) => transaction.isCleared === 0);
    const active = sumSigned(activeTransactions);
    const target = goal.targetCredits;
    const progressPct = target !== null && target > 0 ? roundCredits((active / target) * 100) : null;

    return {
      goal,
      category: categories.get(goal.categoryId),
      labels: goal.labelIds.map((id) => labels.get(id)).filter((label): label is Label => Boolean(label)),
      active,
      earned: sumEarned(transactions),
      net: sumSigned(transactions),
      cleared: sumSigned(transactions.filter((transaction) => transaction.isCleared === 1)),
      target,
      txCount: transactions.length,
      progressPct,
      barPct: progressPct === null ? null : Math.min(100, Math.max(0, progressPct)),
      pace: goalPace(active, target, goal.targetDate, today),
      deadline: deadlineStatus(goal, active, today),
      milestone: target === null ? milestoneInfo(active) : null,
    };
  });
}

export function computeTotals(stats: GoalStats[]): Totals {
  const activeCredits = roundCredits(stats.reduce((sum, stat) => sum + stat.active, 0));
  const allTimeEarned = roundCredits(stats.reduce((sum, stat) => sum + stat.earned, 0));
  const allTimeNet = roundCredits(stats.reduce((sum, stat) => sum + stat.net, 0));
  const clearedCredits = roundCredits(stats.reduce((sum, stat) => sum + stat.cleared, 0));

  const candidates = stats.filter((stat) => stat.goal.isDefault !== 1);
  const completedGoals = candidates.filter((stat) => Boolean(stat.goal.completedAt)).length;
  const activeGoals = candidates.length - completedGoals;

  const fixed = candidates.filter((stat) => stat.target !== null && stat.target > 0);
  const fixedGoals = fixed.length;
  const reachedFixedGoals = fixed.filter((stat) => stat.active >= (stat.target ?? 0)).length;
  const targetTotal = fixed.reduce((sum, stat) => sum + (stat.target ?? 0), 0);
  const progressTotal = fixed.reduce((sum, stat) => sum + Math.min(stat.active, stat.target ?? 0), 0);

  return {
    activeCredits,
    allTimeEarned,
    allTimeNet,
    clearedCredits,
    activeGoals,
    completedGoals,
    fixedGoals,
    reachedFixedGoals,
    weightedCompletion: targetTotal > 0 ? roundCredits((progressTotal / targetTotal) * 100) : 0,
    goalCompletionRate: fixedGoals > 0 ? roundCredits((reachedFixedGoals / fixedGoals) * 100) : 0,
  };
}

export function buildCategoryStats(snapshot: Snapshot, stats: GoalStats[]): CategoryStat[] {
  const byCategory = new Map<number, Transaction[]>();
  for (const transaction of snapshot.transactions) {
    const list = byCategory.get(transaction.categoryId) ?? [];
    list.push(transaction);
    byCategory.set(transaction.categoryId, list);
  }

  const goalCounts = new Map<number, number>();
  for (const stat of stats) {
    goalCounts.set(stat.goal.categoryId, (goalCounts.get(stat.goal.categoryId) ?? 0) + 1);
  }

  const rows = snapshot.categories.map((category) => {
    const transactions = byCategory.get(category.id!) ?? [];
    const active = sumSigned(transactions.filter((transaction) => transaction.isCleared === 0));
    return {
      category,
      active,
      earned: sumEarned(transactions),
      net: sumSigned(transactions),
      cleared: sumSigned(transactions.filter((transaction) => transaction.isCleared === 1)),
      txnCount: transactions.length,
      goalCount: goalCounts.get(category.id!) ?? 0,
      sharePct: 0,
    };
  });

  const totalActive = rows.reduce((sum, row) => sum + row.active, 0);
  return rows.map((row) => ({
    ...row,
    sharePct: totalActive > 0 ? roundCredits((row.active / totalActive) * 100) : 0,
  }));
}

export function buildLabelStats(snapshot: Snapshot, stats: GoalStats[]): LabelStat[] {
  const rows = snapshot.labels.map((label) => {
    const matching = stats.filter((stat) => stat.goal.labelIds.includes(label.id!));
    const active = roundCredits(matching.reduce((sum, stat) => sum + stat.active, 0));
    return {
      label,
      active,
      earned: roundCredits(matching.reduce((sum, stat) => sum + stat.earned, 0)),
      net: roundCredits(matching.reduce((sum, stat) => sum + stat.net, 0)),
      cleared: roundCredits(matching.reduce((sum, stat) => sum + stat.cleared, 0)),
      txnCount: matching.reduce((sum, stat) => sum + stat.txCount, 0),
      goalCount: matching.length,
      sharePct: 0,
    };
  });

  const totalActive = rows.reduce((sum, row) => sum + row.active, 0);
  return rows.map((row) => ({
    ...row,
    sharePct: totalActive > 0 ? roundCredits((row.active / totalActive) * 100) : 0,
  }));
}

function trend(txns: Transaction[], keys: string[], keyOf: (transaction: Transaction) => string): TrendPoint[] {
  const buckets = new Map(keys.map((key) => [key, { earned: 0, net: 0 }]));

  for (const transaction of txns) {
    const bucket = buckets.get(keyOf(transaction));
    if (!bucket) continue;
    if (transaction.type === 'credit') bucket.earned += transaction.credits;
    bucket.net += signed(transaction);
  }

  return keys.map((key) => {
    const bucket = buckets.get(key)!;
    return { key, earned: roundCredits(bucket.earned), net: roundCredits(bucket.net) };
  });
}

export function dailyTrend(txns: Transaction[], endISO: string, days: number): TrendPoint[] {
  return trend(txns, lastNDays(endISO, days), (transaction) => transaction.transactionDate);
}

export function monthlyTrend(txns: Transaction[], endISO: string, months: number): TrendPoint[] {
  return trend(txns, lastNMonths(endISO, months), (transaction) => monthKey(transaction.transactionDate));
}

export function ledgerEntries(snapshot: Snapshot): LedgerEntry[] {
  const goals = new Map(snapshot.goals.map((goal) => [goal.id!, goal]));
  const categories = new Map(snapshot.categories.map((category) => [category.id!, category]));
  const labels = new Map(snapshot.labels.map((label) => [label.id!, label]));

  return [...snapshot.transactions]
    .sort((a, b) => {
      if (a.transactionDate !== b.transactionDate) return a.transactionDate < b.transactionDate ? 1 : -1;
      return (b.id ?? 0) - (a.id ?? 0);
    })
    .map((txn) => {
      const goal = goals.get(txn.goalId);
      return {
        txn,
        goal,
        category: categories.get(txn.categoryId),
        labels: (goal?.labelIds ?? [])
          .map((id) => labels.get(id))
          .filter((label): label is Label => Boolean(label)),
      };
    });
}

export function groupLedger(entries: LedgerEntry[], mode: LedgerGroupMode): LedgerGroup[] {
  const groups = new Map<string, LedgerGroup>();

  const add = (key: string, label: string, entry: LedgerEntry) => {
    let group = groups.get(key);
    if (!group) {
      group = { key, label, entries: [], earned: 0, net: 0 };
      groups.set(key, group);
    }
    group.entries.push(entry);
    if (entry.txn.type === 'credit') group.earned += entry.txn.credits;
    group.net += signed(entry.txn);
  };

  for (const entry of entries) {
    if (mode === 'day') add(entry.txn.transactionDate, formatDate(entry.txn.transactionDate), entry);
    else if (mode === 'month') {
      const key = monthKey(entry.txn.transactionDate);
      add(key, formatMonth(key), entry);
    } else if (mode === 'category') {
      add(String(entry.txn.categoryId), entry.category?.name ?? 'Uncategorised', entry);
    } else if (entry.labels.length === 0) {
      add('none', 'No label', entry);
    } else {
      for (const label of entry.labels) add(String(label.id), label.name, entry);
    }
  }

  const result = [...groups.values()].map((group) => ({
    ...group,
    earned: roundCredits(group.earned),
    net: roundCredits(group.net),
  }));
  if (mode === 'day' || mode === 'month') {
    result.sort((a, b) => (a.key < b.key ? 1 : -1));
  } else {
    result.sort((a, b) => b.earned - a.earned || a.label.localeCompare(b.label));
  }
  return result;
}

/**
 * Narrows goals (and their transactions) for the dashboard.
 * Global category filtering uses goal.categoryId; category ledger grouping uses transaction.categoryId.
 */
export function filterSnapshot(snapshot: Snapshot, filters: Filters, today: string): Snapshot {
  const stats = buildGoalStats(snapshot, today);
  const statById = new Map(stats.map((stat) => [stat.goal.id!, stat]));
  const categoryById = new Map(snapshot.categories.map((category) => [category.id!, category]));
  const labelById = new Map(snapshot.labels.map((label) => [label.id!, label]));
  const notesByGoal = new Map<number, string>();
  for (const transaction of snapshot.transactions) {
    const current = notesByGoal.get(transaction.goalId) ?? '';
    notesByGoal.set(transaction.goalId, `${current} ${transaction.note}`);
  }

  const search = filters.search.trim().toLowerCase();
  const goals = snapshot.goals.filter((goal) => {
    if (filters.labelIds.length > 0 && !filters.labelIds.some((id) => goal.labelIds.includes(id))) return false;
    if (filters.categoryId !== null && goal.categoryId !== filters.categoryId) return false;

    const stat = statById.get(goal.id!)!;
    if (filters.deadline === 'active' && goal.completedAt) return false;
    if (!['all', 'active'].includes(filters.deadline) && stat.deadline !== filters.deadline) return false;

    if (search) {
      const haystack = [
        goal.title,
        categoryById.get(goal.categoryId)?.name ?? '',
        ...goal.labelIds.map((id) => labelById.get(id)?.name ?? ''),
        notesByGoal.get(goal.id!) ?? '',
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const goalIds = new Set(goals.map((goal) => goal.id!));
  return {
    ...snapshot,
    goals,
    transactions: snapshot.transactions.filter((transaction) => goalIds.has(transaction.goalId)),
  };
}
