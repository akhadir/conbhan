import { ensureSeeded, seedDefaults } from './db';
import { db } from './db';
import type { ConbhanDB } from './db';
import type { Category, Goal, Label, Snapshot, TransactionType } from './schema';
import { roundCredits } from '../lib/credits';
import { isValidISODate } from '../lib/dates';
import { labelColor } from '../lib/colors';

export { ensureSeeded };

export interface GoalInput {
  title: string;
  targetCredits?: number | null;
  targetDate?: string | null;
  categoryId?: number | null;
  labelIds?: number[];
}

export interface TransactionInput {
  goalId: number;
  credits: number;
  type: TransactionType;
  categoryId?: number | null;
  note?: string;
  transactionDate: string;
}

export interface BackupCounts {
  categories: number;
  labels: number;
  goals: number;
  transactions: number;
}

function fail(message: string): never {
  throw new Error(message);
}

function nowISO(): string {
  return new Date().toISOString();
}

function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function cleanTitle(value: string): string {
  const title = cleanName(value ?? '');
  if (!title) fail('Title is required');
  return title;
}

function normalizeTarget(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value <= 0) fail('Target credits must be greater than 0');
  return roundCredits(value);
}

function normalizeDate(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = value.trim();
  if (!date) return null;
  if (!isValidISODate(date)) fail('Target date must be a valid YYYY-MM-DD date');
  return date;
}

async function resolveCategory(categoryId: number | null | undefined, database: ConbhanDB): Promise<Category> {
  if (categoryId === null || categoryId === undefined) {
    const defaultCategory = await database.categories.filter((category) => category.isDefault === 1).first();
    if (!defaultCategory) fail('Default category is missing');
    return defaultCategory;
  }
  const category = await database.categories.get(categoryId);
  if (!category) fail('Category does not exist');
  return category;
}

async function resolveLabelIds(labelIds: number[], database: ConbhanDB): Promise<number[]> {
  if (!Array.isArray(labelIds) || labelIds.length === 0) return [];
  const unique = Array.from(new Set(labelIds));
  const labels = await database.labels.bulkGet(unique);
  if (labels.some((label) => !label)) fail('Label does not exist');
  return unique;
}

function validateTransactionFields(input: TransactionInput, goal: Goal): {
  credits: number;
  type: TransactionType;
  transactionDate: string;
  note: string;
} {
  if (input.type !== 'credit' && input.type !== 'debit') fail('Transaction type must be credit or debit');
  const credits = roundCredits(Number(input.credits));
  if (!Number.isFinite(credits) || credits <= 0) fail('Credits must be greater than 0');
  if (!isValidISODate(input.transactionDate)) fail('Transaction date must be a valid YYYY-MM-DD date');
  void goal;
  return {
    credits,
    type: input.type,
    transactionDate: input.transactionDate,
    note: cleanName(input.note ?? ''),
  };
}

export async function findOrCreateCategory(name: string, database: ConbhanDB = db): Promise<Category> {
  const cleaned = cleanName(name);
  if (!cleaned) fail('Category name is required');

  return database.transaction('rw', database.categories, async () => {
    const existing = await database.categories.toArray();
    const found = existing.find((category) => category.name.toLowerCase() === cleaned.toLowerCase());
    if (found) return found;

    const category: Category = { name: cleaned, isDefault: 0, createdAt: nowISO() };
    const id = await database.categories.add(category);
    return { ...category, id };
  });
}

export async function findOrCreateLabels(names: string[], database: ConbhanDB = db): Promise<Label[]> {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = cleanName(raw ?? '');
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(name);
  }
  if (unique.length === 0) return [];

  return database.transaction('rw', database.labels, async () => {
    const existing = await database.labels.toArray();
    const byName = new Map(existing.map((label) => [label.name.toLowerCase(), label]));
    const result: Label[] = [];

    for (const name of unique) {
      const found = byName.get(name.toLowerCase());
      if (found) {
        result.push(found);
        continue;
      }
      const label: Label = { name, color: labelColor(name), createdAt: nowISO() };
      label.id = await database.labels.add(label);
      byName.set(name.toLowerCase(), label);
      result.push(label);
    }

    return result;
  });
}

export async function getSnapshot(database: ConbhanDB = db): Promise<Snapshot> {
  const [categories, labels, goals, transactions] = await Promise.all([
    database.categories.toArray(),
    database.labels.toArray(),
    database.goals.toArray(),
    database.transactions.toArray(),
  ]);
  return { categories, labels, goals, transactions };
}

export async function createGoal(input: GoalInput, database: ConbhanDB = db): Promise<number> {
  const title = cleanTitle(input.title);
  const targetCredits = normalizeTarget(input.targetCredits);
  const targetDate = normalizeDate(input.targetDate);
  const category = await resolveCategory(input.categoryId, database);
  const labelIds = await resolveLabelIds(input.labelIds ?? [], database);

  return database.goals.add({
    title,
    targetCredits,
    targetDate,
    categoryId: category.id!,
    labelIds,
    isDefault: 0,
    createdAt: nowISO(),
    completedAt: null,
  });
}

export async function updateGoal(id: number, input: Partial<GoalInput>, database: ConbhanDB = db): Promise<void> {
  const goal = await database.goals.get(id);
  if (!goal) fail('Goal does not exist');

  const title = input.title === undefined ? goal.title : cleanTitle(input.title);
  const targetCredits =
    input.targetCredits === undefined ? goal.targetCredits : normalizeTarget(input.targetCredits);
  const targetDate = input.targetDate === undefined ? goal.targetDate : normalizeDate(input.targetDate);

  let categoryId = goal.categoryId;
  if (input.categoryId !== undefined) {
    categoryId = (await resolveCategory(input.categoryId, database)).id!;
  }
  const labelIds = input.labelIds === undefined ? goal.labelIds : await resolveLabelIds(input.labelIds, database);

  await database.goals.update(id, { title, targetCredits, targetDate, categoryId, labelIds });
}

export async function markGoalCompleted(id: number, completed: boolean, database: ConbhanDB = db): Promise<void> {
  const goal = await database.goals.get(id);
  if (!goal) fail('Goal does not exist');
  await database.goals.update(id, { completedAt: completed ? nowISO() : null });
}

export async function activeBalance(goalId: number, database: ConbhanDB = db): Promise<number> {
  const transactions = await database.transactions.where('goalId').equals(goalId).toArray();
  const total = transactions
    .filter((transaction) => transaction.isCleared === 0)
    .reduce((sum, transaction) => sum + (transaction.type === 'credit' ? transaction.credits : -transaction.credits), 0);
  return roundCredits(total);
}

export async function clearGoal(id: number, database: ConbhanDB = db): Promise<number> {
  return database.transaction('rw', database.goals, database.transactions, async () => {
    const goal = await database.goals.get(id);
    if (!goal) fail('Goal does not exist');

    const active = await database.transactions
      .where('goalId')
      .equals(id)
      .filter((transaction) => transaction.isCleared === 0)
      .toArray();

    await Promise.all(active.map((transaction) => database.transactions.update(transaction.id!, { isCleared: 1 })));
    return active.length;
  });
}

export async function deleteGoal(id: number, database: ConbhanDB = db): Promise<void> {
  return database.transaction('rw', database.goals, database.transactions, async () => {
    const goal = await database.goals.get(id);
    if (!goal) fail('Goal does not exist');
    if (goal.isDefault === 1) fail('The default goal cannot be deleted');

    const history = await database.transactions.where('goalId').equals(id).count();
    if (history > 0) fail('Goals with transaction history cannot be deleted. Clear or complete them instead.');
    await database.goals.delete(id);
  });
}

export async function addTransaction(input: TransactionInput, database: ConbhanDB = db): Promise<number> {
  return database.transaction('rw', database.goals, database.categories, database.transactions, async () => {
    const goal = await database.goals.get(input.goalId);
    if (!goal) fail('Goal does not exist');

    const fields = validateTransactionFields(input, goal);
    const categoryId =
      input.categoryId === null || input.categoryId === undefined
        ? goal.categoryId
        : (await resolveCategory(input.categoryId, database)).id!;

    if (fields.type === 'debit') {
      const balance = await activeBalance(goal.id!, database);
      if (fields.credits > balance) fail('Debit exceeds the available credit balance');
    }

    return database.transactions.add({
      goalId: goal.id!,
      categoryId,
      credits: fields.credits,
      type: fields.type,
      note: fields.note,
      isCleared: 0,
      transactionDate: fields.transactionDate,
      createdAt: nowISO(),
    });
  });
}

export async function updateTransaction(
  id: number,
  input: TransactionInput,
  database: ConbhanDB = db,
): Promise<void> {
  return database.transaction('rw', database.goals, database.categories, database.transactions, async () => {
    const existing = await database.transactions.get(id);
    if (!existing) fail('Transaction does not exist');

    const goal = await database.goals.get(input.goalId);
    if (!goal) fail('Goal does not exist');

    const fields = validateTransactionFields(input, goal);
    const categoryId =
      input.categoryId === null || input.categoryId === undefined
        ? goal.categoryId
        : (await resolveCategory(input.categoryId, database)).id!;

    if (fields.type === 'debit' && existing.isCleared === 0) {
      const siblings = await database.transactions.where('goalId').equals(goal.id!).toArray();
      const balance = siblings
        .filter((transaction) => transaction.id !== id && transaction.isCleared === 0)
        .reduce((sum, transaction) => sum + (transaction.type === 'credit' ? transaction.credits : -transaction.credits), 0);
      if (fields.credits > roundCredits(balance)) fail('Debit exceeds the available credit balance');
    }

    await database.transactions.update(id, {
      goalId: goal.id!,
      categoryId,
      credits: fields.credits,
      type: fields.type,
      note: fields.note,
      transactionDate: fields.transactionDate,
    });
  });
}

export async function deleteTransaction(id: number, database: ConbhanDB = db): Promise<void> {
  await database.transactions.delete(id);
}

export async function renameCategory(id: number, name: string, database: ConbhanDB = db): Promise<void> {
  const cleaned = cleanName(name);
  if (!cleaned) fail('Category name is required');

  return database.transaction('rw', database.categories, async () => {
    const category = await database.categories.get(id);
    if (!category) fail('Category does not exist');
    const duplicate = await database.categories
      .filter((other) => other.id !== id && other.name.toLowerCase() === cleaned.toLowerCase())
      .first();
    if (duplicate) fail('A category with this name already exists');
    await database.categories.update(id, { name: cleaned });
  });
}

export async function deleteCategory(id: number, database: ConbhanDB = db): Promise<void> {
  return database.transaction('rw', database.categories, database.goals, database.transactions, async () => {
    const category = await database.categories.get(id);
    if (!category) fail('Category does not exist');
    if (category.isDefault === 1) fail('The default category cannot be deleted');

    const goalCount = await database.goals.where('categoryId').equals(id).count();
    const transactionCount = await database.transactions.where('categoryId').equals(id).count();
    if (goalCount + transactionCount > 0) fail('Category is in use and cannot be deleted');
    await database.categories.delete(id);
  });
}

export async function renameLabel(id: number, name: string, database: ConbhanDB = db): Promise<void> {
  const cleaned = cleanName(name);
  if (!cleaned) fail('Label name is required');

  return database.transaction('rw', database.labels, async () => {
    const label = await database.labels.get(id);
    if (!label) fail('Label does not exist');
    const duplicate = await database.labels
      .filter((other) => other.id !== id && other.name.toLowerCase() === cleaned.toLowerCase())
      .first();
    if (duplicate) fail('A label with this name already exists');
    await database.labels.update(id, { name: cleaned });
  });
}

export async function deleteLabel(id: number, database: ConbhanDB = db): Promise<void> {
  return database.transaction('rw', database.labels, database.goals, async () => {
    const label = await database.labels.get(id);
    if (!label) fail('Label does not exist');
    const usage = await database.goals.where('labelIds').equals(id).count();
    if (usage > 0) fail('Label is in use and cannot be deleted');
    await database.labels.delete(id);
  });
}

export async function resetAllData(database: ConbhanDB = db): Promise<void> {
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
      await seedDefaults(database);
    },
  );
}

export async function initializeDatabase(database: ConbhanDB = db): Promise<void> {
  await database.open();
  await ensureSeeded(database);
}
