import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConbhanDB } from '../../src/db/db';
import * as repo from '../../src/db/repo';

let db: ConbhanDB;
let n = 0;

beforeEach(async () => {
  db = new ConbhanDB(`ConbhanDbTest-${Date.now()}-${n++}`);
  await db.open();
});

afterEach(async () => {
  db.close();
  await db.delete();
});

async function newGoal(title = 'Run 100 km', targetCredits: number | null = 100) {
  return repo.createGoal({ title, targetCredits }, db);
}

describe('schema contract', () => {
  it('uses the ConbhanDB name and the required stores, indexes and unique constraints', () => {
    expect(new ConbhanDB().name).toBe('ConbhanDB');
    expect(db.tables.map((t) => t.name).sort()).toEqual(['categories', 'goals', 'labels', 'transactions']);

    const index = (tableName: string, name: string) => db.table(tableName).schema.indexes.find((i) => i.name === name);

    expect(index('categories', 'name')?.unique).toBe(true);
    expect(index('categories', 'isDefault')).toBeDefined();
    expect(index('labels', 'name')?.unique).toBe(true);
    expect(index('goals', 'labelIds')?.multi).toBe(true);
    expect(index('goals', 'labelIds')?.src).toBe('*labelIds');
    expect(index('goals', 'targetDate')).toBeDefined();
    expect(index('goals', 'categoryId')).toBeDefined();
    expect(index('goals', 'isDefault')).toBeDefined();
    for (const idx of ['goalId', 'categoryId', 'isCleared', 'transactionDate', 'type']) {
      expect(index('transactions', idx)).toBeDefined();
    }
    for (const table of db.tables) {
      expect(table.schema.primKey.keyPath).toBe('id');
      expect(table.schema.primKey.auto).toBe(true);
    }
  });
});

describe('seeding', () => {
  it('creates the General category and the General Credits default goal on first open', async () => {    const categories = await db.categories.toArray();
    expect(categories).toHaveLength(1);
    expect(categories[0]).toMatchObject({ name: 'General', isDefault: 1 });

    const goals = await db.goals.toArray();
    expect(goals).toHaveLength(1);
    expect(goals[0]).toMatchObject({
      title: 'General Credits',
      targetCredits: null,
      targetDate: null,
      isDefault: 1,
      categoryId: categories[0].id,
      labelIds: [],
    });
  });

  it('is idempotent and heals a database whose defaults were removed', async () => {
    await repo.ensureSeeded(db);
    await repo.ensureSeeded(db);
    expect(await db.categories.count()).toBe(1);
    expect(await db.goals.count()).toBe(1);

    await db.transactions.clear();
    await db.goals.clear();
    await db.categories.clear();

    await repo.ensureSeeded(db);
    expect(await db.categories.count()).toBe(1);
    expect(await db.goals.count()).toBe(1);
    expect((await db.goals.toArray())[0].title).toBe('General Credits');
  });
});

describe('runtime categories', () => {
  it('finds categories case-insensitively and creates missing ones', async () => {
    const study = await repo.findOrCreateCategory('Study', db);
    const again = await repo.findOrCreateCategory('  sTuDy ', db);
    expect(again.id).toBe(study.id);
    expect(await db.categories.count()).toBe(2);
    expect(study.isDefault).toBe(0);
  });

  it('rejects blank category names', async () => {
    await expect(repo.findOrCreateCategory('   ', db)).rejects.toThrow(/name/i);
    await expect(repo.findOrCreateCategory('', db)).rejects.toThrow(/name/i);
  });

  it('renames categories while keeping names unique', async () => {
    const study = await repo.findOrCreateCategory('Study', db);
    await repo.renameCategory(study.id!, 'Learning', db);
    expect((await db.categories.get(study.id!))!.name).toBe('Learning');
    await expect(repo.renameCategory(study.id!, 'general', db)).rejects.toThrow(/exists|unique/i);
  });

  it('blocks deleting the default or in-use category', async () => {
    const general = (await db.categories.toArray())[0];
    await expect(repo.deleteCategory(general.id!, db)).rejects.toThrow(/default/i);

    const study = await repo.findOrCreateCategory('Study', db);
    await repo.createGoal({ title: 'Learn', categoryId: study.id }, db);
    await expect(repo.deleteCategory(study.id!, db)).rejects.toThrow(/in use|used/i);

    const unused = await repo.findOrCreateCategory('Unused', db);
    await repo.deleteCategory(unused.id!, db);
    expect(await db.categories.get(unused.id!)).toBeUndefined();
  });
});

describe('runtime labels', () => {
  it('creates labels once and dedupes case-insensitively', async () => {
    const [urgent, year] = await repo.findOrCreateLabels(['Urgent', '2026'], db);
    expect(urgent.color).toBeTruthy();
    expect(year.color).toBeTruthy();

    const again = await repo.findOrCreateLabels([' urgent ', '2026'], db);
    expect(again.map((l) => l.id)).toEqual([urgent.id, year.id]);
    expect(await db.labels.count()).toBe(2);
  });

  it('renames and deletes labels with guards', async () => {
    const [urgent] = await repo.findOrCreateLabels(['Urgent'], db);
    await repo.renameLabel(urgent.id!, 'Critical', db);
    expect((await db.labels.get(urgent.id!))!.name).toBe('Critical');

    const [other] = await repo.findOrCreateLabels(['Other'], db);
    const goalId = await repo.createGoal({ title: 'Tagged', labelIds: [urgent.id!] }, db);
    await expect(repo.deleteLabel(urgent.id!, db)).rejects.toThrow(/in use|used/i);
    await repo.deleteLabel(other.id!, db);
    expect(await db.labels.get(other.id!)).toBeUndefined();
    expect((await db.goals.get(goalId))!.labelIds).toEqual([urgent.id]);
  });
});

describe('goals', () => {
  it('requires a title and trims it', async () => {
    await expect(repo.createGoal({ title: '   ' }, db)).rejects.toThrow(/title/i);
    const id = await repo.createGoal({ title: '  Read 12 books  ' }, db);
    expect((await db.goals.get(id))!.title).toBe('Read 12 books');
  });

  it('assigns the default category and unlimited target when omitted', async () => {
    const id = await repo.createGoal({ title: 'Open ended' }, db);
    const goal = (await db.goals.get(id))!;
    const general = (await db.categories.toArray())[0];
    expect(goal.categoryId).toBe(general.id);
    expect(goal.targetCredits).toBeNull();
    expect(goal.targetDate).toBeNull();
    expect(goal.labelIds).toEqual([]);
    expect(goal.isDefault).toBe(0);
    expect(goal.completedAt).toBeNull();
  });

  it('stores fixed targets, dates and multiple labels', async () => {
    const [urgent, year] = await repo.findOrCreateLabels(['Urgent', '2026'], db);
    const id = await repo.createGoal(
      { title: 'Learn TS', targetCredits: 1000, targetDate: '2027-01-01', labelIds: [urgent.id!, year.id!] },
      db,
    );
    const goal = (await db.goals.get(id))!;
    expect(goal.targetCredits).toBe(1000);
    expect(goal.targetDate).toBe('2027-01-01');
    expect(goal.labelIds).toEqual([urgent.id, year.id]);
  });

  it('rejects invalid targets, dates, categories and labels', async () => {
    await expect(repo.createGoal({ title: 'Zero', targetCredits: 0 }, db)).rejects.toThrow(/target/i);
    await expect(repo.createGoal({ title: 'Negative', targetCredits: -5 }, db)).rejects.toThrow(/target/i);
    await expect(repo.createGoal({ title: 'Bad date', targetDate: '2026-02-30' }, db)).rejects.toThrow(/date/i);
    await expect(repo.createGoal({ title: 'Bad cat', categoryId: 999 }, db)).rejects.toThrow(/category/i);
    await expect(repo.createGoal({ title: 'Bad label', labelIds: [999] }, db)).rejects.toThrow(/label/i);
  });

  it('updates editable fields and normalizes the target', async () => {
    const id = await newGoal();
    const study = await repo.findOrCreateCategory('Study', db);
    await repo.updateGoal(id, { title: 'Run 200 km', targetCredits: 200, targetDate: '2027-02-01', categoryId: study.id }, db);
    const goal = (await db.goals.get(id))!;
    expect(goal).toMatchObject({ title: 'Run 200 km', targetCredits: 200, targetDate: '2027-02-01', categoryId: study.id });

    await repo.updateGoal(id, { title: 'Run forever', targetCredits: null, targetDate: null }, db);
    expect((await db.goals.get(id))!.targetCredits).toBeNull();
    expect((await db.goals.get(id))!.targetDate).toBeNull();
  });

  it('marks goals completed and reopens them', async () => {
    const id = await newGoal();
    await repo.markGoalCompleted(id, true, db);
    expect((await db.goals.get(id))!.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    await repo.markGoalCompleted(id, false, db);
    expect((await db.goals.get(id))!.completedAt).toBeNull();
  });

  it('blocks deleting the default goal or a goal with history', async () => {
    const def = (await db.goals.toArray())[0];
    await expect(repo.deleteGoal(def.id!, db)).rejects.toThrow(/default/i);

    const id = await newGoal();
    await repo.addTransaction({ goalId: id, credits: 5, type: 'credit', transactionDate: '2026-11-16' }, db);
    await expect(repo.deleteGoal(id, db)).rejects.toThrow(/transaction|history|clear/i);
    await repo.clearGoal(id, db);
    await expect(repo.deleteGoal(id, db)).rejects.toThrow(/transaction|history/i);
  });

  it('deletes a goal with no transactions', async () => {
    const id = await newGoal();
    await repo.deleteGoal(id, db);
    expect(await db.goals.get(id)).toBeUndefined();
  });
});

describe('transactions', () => {
  it('adds credits and debits and computes the active balance', async () => {
    const id = await newGoal();
    const general = (await db.categories.toArray())[0];
    await repo.addTransaction({ goalId: id, credits: 40, type: 'credit', transactionDate: '2026-11-01' }, db);
    await repo.addTransaction({ goalId: id, credits: 10, type: 'debit', transactionDate: '2026-11-02' }, db);
    expect(await repo.activeBalance(id, db)).toBe(30);

    const txns = await db.transactions.toArray();
    expect(txns).toHaveLength(2);
    expect(txns[0]).toMatchObject({ categoryId: general.id, isCleared: 0, note: '' });
  });

  it('defaults to the goal category but allows an override', async () => {
    const id = await newGoal();
    const study = await repo.findOrCreateCategory('Study', db);
    await repo.addTransaction({ goalId: id, credits: 5, type: 'credit', categoryId: study.id, transactionDate: '2026-11-16' }, db);
    const txn = (await db.transactions.toArray())[0];
    expect(txn.categoryId).toBe(study.id);
  });

  it('validates amounts, goals, categories and dates', async () => {
    const id = await newGoal();
    await expect(repo.addTransaction({ goalId: id, credits: 0, type: 'credit', transactionDate: '2026-11-16' }, db)).rejects.toThrow(
      /credit/i,
    );
    await expect(repo.addTransaction({ goalId: id, credits: -3, type: 'credit', transactionDate: '2026-11-16' }, db)).rejects.toThrow(
      /credit/i,
    );
    await expect(repo.addTransaction({ goalId: 999, credits: 5, type: 'credit', transactionDate: '2026-11-16' }, db)).rejects.toThrow(
      /goal/i,
    );
    await expect(
      repo.addTransaction({ goalId: id, credits: 5, type: 'credit', categoryId: 999, transactionDate: '2026-11-16' }, db),
    ).rejects.toThrow(/category/i);
    await expect(repo.addTransaction({ goalId: id, credits: 5, type: 'credit', transactionDate: 'nope' }, db)).rejects.toThrow(
      /date/i,
    );
    await expect(
      repo.addTransaction({ goalId: id, credits: 5, type: 'transfer' as never, transactionDate: '2026-11-16' }, db),
    ).rejects.toThrow(/type/i);
  });

  it('refuses a debit larger than the active balance', async () => {
    const id = await newGoal();
    await repo.addTransaction({ goalId: id, credits: 30, type: 'credit', transactionDate: '2026-11-01' }, db);
    await expect(repo.addTransaction({ goalId: id, credits: 31, type: 'debit', transactionDate: '2026-11-02' }, db)).rejects.toThrow(
      /balance|exceed/i,
    );
    await repo.addTransaction({ goalId: id, credits: 30, type: 'debit', transactionDate: '2026-11-02' }, db);
    expect(await repo.activeBalance(id, db)).toBe(0);
  });

  it('updates and deletes transactions, re-checking the balance', async () => {
    const id = await newGoal();
    await repo.addTransaction({ goalId: id, credits: 100, type: 'credit', transactionDate: '2026-11-01' }, db);
    const debitId = await repo.addTransaction(
      { goalId: id, credits: 30, type: 'debit', transactionDate: '2026-11-02' },
      db,
    );
    await expect(repo.updateTransaction(debitId, { goalId: id, credits: 200, type: 'debit', transactionDate: '2026-11-02' }, db)).rejects.toThrow(
      /balance|exceed/i,
    );
    await repo.updateTransaction(debitId, { goalId: id, credits: 50, type: 'debit', transactionDate: '2026-11-03', note: '  food ' }, db);
    expect(await repo.activeBalance(id, db)).toBe(50);
    const updated = (await db.transactions.get(debitId))!;
    expect(updated).toMatchObject({ credits: 50, type: 'debit', transactionDate: '2026-11-03', note: 'food' });

    await repo.deleteTransaction(debitId, db);
    expect(await repo.activeBalance(id, db)).toBe(100);
    expect(await db.transactions.count()).toBe(1);
  });
});

describe('soft clearing', () => {
  it('resets the active balance without deleting history', async () => {
    const id = await newGoal();
    await repo.addTransaction({ goalId: id, credits: 40, type: 'credit', transactionDate: '2026-11-01' }, db);
    await repo.addTransaction({ goalId: id, credits: 10, type: 'debit', transactionDate: '2026-11-02' }, db);

    expect(await repo.clearGoal(id, db)).toBe(2);
    expect(await repo.activeBalance(id, db)).toBe(0);
    expect(await db.transactions.count()).toBe(2);
    expect((await db.transactions.toArray()).every((t) => t.isCleared === 1)).toBe(true);
    expect(await repo.clearGoal(id, db)).toBe(0);
  });

  it('only clears the target goal and keeps new credits active', async () => {
    const a = await newGoal('A');
    const b = await newGoal('B');
    await repo.addTransaction({ goalId: a, credits: 10, type: 'credit', transactionDate: '2026-11-01' }, db);
    await repo.addTransaction({ goalId: b, credits: 20, type: 'credit', transactionDate: '2026-11-01' }, db);

    await repo.clearGoal(a, db);
    expect(await repo.activeBalance(a, db)).toBe(0);
    expect(await repo.activeBalance(b, db)).toBe(20);

    await repo.addTransaction({ goalId: a, credits: 5, type: 'credit', transactionDate: '2026-11-16' }, db);
    expect(await repo.activeBalance(a, db)).toBe(5);
    expect(await db.transactions.where('goalId').equals(a).count()).toBe(2);
  });
});

describe('snapshot and reset', () => {
  it('returns every store in one snapshot', async () => {
    const id = await newGoal();
    await repo.addTransaction({ goalId: id, credits: 5, type: 'credit', transactionDate: '2026-11-16' }, db);
    const snapshot = await repo.getSnapshot(db);
    expect(snapshot.categories).toHaveLength(1);
    expect(snapshot.labels).toHaveLength(0);
    expect(snapshot.goals).toHaveLength(2);
    expect(snapshot.transactions).toHaveLength(1);
  });

  it('resets all data back to the defaults', async () => {
    const id = await newGoal();
    await repo.findOrCreateLabels(['Urgent'], db);
    await repo.addTransaction({ goalId: id, credits: 5, type: 'credit', transactionDate: '2026-11-16' }, db);

    await repo.resetAllData(db);
    expect(await db.categories.count()).toBe(1);
    expect(await db.labels.count()).toBe(0);
    expect(await db.goals.count()).toBe(1);
    expect(await db.transactions.count()).toBe(0);
    expect((await db.goals.toArray())[0].isDefault).toBe(1);
  });
});
