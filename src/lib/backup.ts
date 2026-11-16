import { seedDefaults } from '../db/db';
import type { ConbhanDB } from '../db/db';
import type { BackupCounts } from '../db/repo';
import type { Category, Goal, Label, Snapshot, Transaction, TransactionType } from '../db/schema';
import { roundCredits } from './credits';
import { isValidISODate, toISODate } from './dates';

export interface BackupFile {
  app: 'Conbhan';
  version: 1;
  exportedAt: string;
  data: Snapshot;
}

export type ValidationResult = { ok: true; data: Snapshot } | { ok: false; errors: string[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isId = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;

const flag = (value: unknown): 0 | 1 => (value === 1 || value === true ? 1 : 0);

function clean(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function backupFilename(now: Date = new Date()): string {
  return `conbhan-backup-${toISODate(now)}.json`;
}

export function buildBackup(snapshot: Snapshot, now: Date = new Date()): BackupFile {
  return {
    app: 'Conbhan',
    version: 1,
    exportedAt: now.toISOString(),
    data: {
      categories: snapshot.categories,
      labels: snapshot.labels,
      goals: snapshot.goals,
      transactions: snapshot.transactions,
    },
  };
}

export function validateBackup(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(raw)) return { ok: false, errors: ['Backup must be a JSON object'] };
  if (raw.app !== 'Conbhan') errors.push('Not a Conbhan backup (expected app "Conbhan")');
  if (raw.version !== 1) errors.push('Unsupported backup version, expected version 1');

  const data = raw.data;
  if (!isRecord(data)) return { ok: false, errors: [...errors, 'Backup data is missing'] };

  const arrays: Record<'categories' | 'labels' | 'goals' | 'transactions', unknown[]> = {
    categories: [],
    labels: [],
    goals: [],
    transactions: [],
  };
  for (const key of Object.keys(arrays) as (keyof typeof arrays)[]) {
    if (!Array.isArray(data[key])) {
      errors.push(`Backup field "${key}" must be an array`);
      return { ok: false, errors };
    }
    arrays[key] = data[key] as unknown[];
  }

  const now = new Date().toISOString();
  const categoryIds = new Set<number>();
  const categoryNames = new Set<string>();
  const categories: Category[] = [];

  arrays.categories.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`Category ${index + 1} is not an object`);
      return;
    }
    const id = item.id;
    const name = typeof item.name === 'string' ? clean(item.name) : '';
    if (!isId(id)) errors.push(`Category ${index + 1} has an invalid id`);
    if (!name) errors.push(`Category ${index + 1} is missing a name`);
    if (isId(id)) {
      if (categoryIds.has(id)) errors.push(`Duplicate category id ${id}`);
      categoryIds.add(id);
    }
    if (name) {
      const key = name.toLowerCase();
      if (categoryNames.has(key)) errors.push(`Duplicate category name "${name}"`);
      categoryNames.add(key);
    }
    categories.push({
      id: id as number,
      name,
      isDefault: flag(item.isDefault),
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : now,
    });
  });

  const labelIds = new Set<number>();
  const labelNames = new Set<string>();
  const labels: Label[] = [];

  arrays.labels.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`Label ${index + 1} is not an object`);
      return;
    }
    const id = item.id;
    const name = typeof item.name === 'string' ? clean(item.name) : '';
    if (!isId(id)) errors.push(`Label ${index + 1} has an invalid id`);
    if (!name) errors.push(`Label ${index + 1} is missing a name`);
    if (isId(id)) {
      if (labelIds.has(id)) errors.push(`Duplicate label id ${id}`);
      labelIds.add(id);
    }
    if (name) {
      const key = name.toLowerCase();
      if (labelNames.has(key)) errors.push(`Duplicate label name "${name}"`);
      labelNames.add(key);
    }
    labels.push({
      id: id as number,
      name,
      color: typeof item.color === 'string' && item.color ? item.color : '#38bdf8',
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : now,
    });
  });

  const goals: Goal[] = [];
  const goalIds = new Set<number>();

  arrays.goals.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`Goal ${index + 1} is not an object`);
      return;
    }
    const id = item.id;
    const title = typeof item.title === 'string' ? clean(item.title) : '';
    if (!isId(id)) errors.push(`Goal ${index + 1} has an invalid id`);
    if (!title) errors.push(`Goal ${index + 1} is missing a title`);
    if (isId(id)) {
      if (goalIds.has(id)) errors.push(`Duplicate goal id ${id}`);
      goalIds.add(id);
    }

    let targetCredits: number | null = null;
    if (item.targetCredits !== null && item.targetCredits !== undefined) {
      if (typeof item.targetCredits !== 'number' || !Number.isFinite(item.targetCredits) || item.targetCredits <= 0) {
        errors.push(`Goal ${index + 1} has invalid target credits`);
      } else {
        targetCredits = roundCredits(item.targetCredits);
      }
    }

    let targetDate: string | null = null;
    if (item.targetDate !== null && item.targetDate !== undefined && item.targetDate !== '') {
      if (!isValidISODate(item.targetDate)) errors.push(`Goal ${index + 1} has an invalid target date`);
      else targetDate = item.targetDate;
    }

    if (!isId(item.categoryId)) errors.push(`Goal ${index + 1} has an invalid category`);
    const goalLabelIds = Array.isArray(item.labelIds) ? item.labelIds : null;
    if (!goalLabelIds || !goalLabelIds.every(isId)) errors.push(`Goal ${index + 1} has invalid labels`);

    let completedAt: string | null = null;
    if (item.completedAt !== null && item.completedAt !== undefined) {
      if (typeof item.completedAt !== 'string') errors.push(`Goal ${index + 1} has an invalid completion date`);
      else completedAt = item.completedAt;
    }

    goals.push({
      id: id as number,
      title,
      targetCredits,
      targetDate,
      categoryId: item.categoryId as number,
      labelIds: (goalLabelIds ?? []).filter(isId),
      isDefault: flag(item.isDefault),
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : now,
      completedAt,
    });
  });

  const transactions: Transaction[] = [];
  const transactionIds = new Set<number>();

  arrays.transactions.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`Transaction ${index + 1} is not an object`);
      return;
    }
    const id = item.id;
    if (!isId(id)) errors.push(`Transaction ${index + 1} has an invalid id`);
    if (isId(id)) {
      if (transactionIds.has(id)) errors.push(`Duplicate transaction id ${id}`);
      transactionIds.add(id);
    }
    if (!isId(item.goalId)) errors.push(`Transaction ${index + 1} has an invalid goal`);
    if (!isId(item.categoryId)) errors.push(`Transaction ${index + 1} has an invalid category`);
    if (typeof item.credits !== 'number' || !Number.isFinite(item.credits) || item.credits <= 0) {
      errors.push(`Transaction ${index + 1} must have credits greater than 0`);
    }
    const type = item.type === 'credit' || item.type === 'debit' ? item.type : null;
    if (!type) errors.push(`Transaction ${index + 1} has an invalid type`);
    if (!isValidISODate(item.transactionDate)) errors.push(`Transaction ${index + 1} has an invalid date`);

    transactions.push({
      id: id as number,
      goalId: item.goalId as number,
      categoryId: item.categoryId as number,
      credits: typeof item.credits === 'number' ? roundCredits(item.credits) : 0,
      type: (type ?? 'credit') as TransactionType,
      note: typeof item.note === 'string' ? item.note : '',
      isCleared: flag(item.isCleared),
      transactionDate: typeof item.transactionDate === 'string' ? item.transactionDate : '',
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : now,
    });
  });

  for (const goal of goals) {
    if (!categoryIds.has(goal.categoryId)) errors.push(`Goal "${goal.title}" references a missing category`);
    for (const labelId of goal.labelIds) {
      if (!labelIds.has(labelId)) errors.push(`Goal "${goal.title}" references a missing label`);
    }
  }
  for (const transaction of transactions) {
    if (!goalIds.has(transaction.goalId)) errors.push(`Transaction ${transaction.id ?? '?'} references a missing goal`);
    if (!categoryIds.has(transaction.categoryId)) {
      errors.push(`Transaction ${transaction.id ?? '?'} references a missing category`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: { categories, labels, goals, transactions } };
}

/** Validate and replace every store in one transaction. Never leaves a partial import behind. */
export async function importBackup(database: ConbhanDB, text: string): Promise<BackupCounts> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid backup JSON');
  }

  const result = validateBackup(raw);
  if (!result.ok) {
    throw new Error(`Invalid Conbhan backup: ${result.errors.slice(0, 5).join('; ')}`);
  }

  const { categories, labels, goals, transactions } = result.data;
  await database.transaction(
    'rw',
    database.categories,
    database.labels,
    database.goals,
    database.transactions,
    async () => {
      await database.categories.clear();
      await database.labels.clear();
      await database.goals.clear();
      await database.transactions.clear();

      await database.categories.bulkAdd(categories);
      await database.labels.bulkAdd(labels);
      await database.goals.bulkAdd(goals);
      await database.transactions.bulkAdd(transactions);

      await seedDefaults(database);
    },
  );

  return {
    categories: categories.length,
    labels: labels.length,
    goals: goals.length,
    transactions: transactions.length,
  };
}
