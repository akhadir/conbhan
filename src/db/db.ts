import Dexie, { type Table } from 'dexie';
import { DB_NAME, DEFAULT_CATEGORY_NAME, DEFAULT_GOAL_TITLE } from './schema';
import type { Category, Goal, Label, Transaction } from './schema';

export class ConbhanDB extends Dexie {
  categories!: Table<Category, number>;
  labels!: Table<Label, number>;
  goals!: Table<Goal, number>;
  transactions!: Table<Transaction, number>;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores({
      categories: '++id, &name, isDefault, createdAt',
      labels: '++id, &name, color, createdAt',
      goals: '++id, title, targetCredits, targetDate, categoryId, *labelIds, isDefault, createdAt',
      transactions: '++id, goalId, categoryId, credits, type, note, isCleared, transactionDate, createdAt',
    });
    this.on('populate', () => seedDefaults(this));
  }
}

/** Idempotently create the protected default category and catch-all goal. */
export async function seedDefaults(database: ConbhanDB): Promise<void> {
  const now = new Date().toISOString();

  const categories = await database.categories.toArray();
  let general =
    categories.find((category) => category.isDefault === 1) ??
    categories.find((category) => category.name.trim().toLowerCase() === DEFAULT_CATEGORY_NAME.toLowerCase());

  if (!general) {
    general = { name: DEFAULT_CATEGORY_NAME, isDefault: 1, createdAt: now };
    general.id = await database.categories.add(general);
  } else if (general.isDefault !== 1) {
    await database.categories.update(general.id!, { isDefault: 1 });
    general = { ...general, isDefault: 1 };
  }

  const goals = await database.goals.toArray();
  const defaultGoal = goals.find((goal) => goal.isDefault === 1);

  if (!defaultGoal) {
    await database.goals.add({
      title: DEFAULT_GOAL_TITLE,
      targetCredits: null,
      targetDate: null,
      categoryId: general.id!,
      labelIds: [],
      isDefault: 1,
      createdAt: now,
      completedAt: null,
    });
  } else if (defaultGoal.categoryId !== general.id && !categories.some((category) => category.id === defaultGoal.categoryId)) {
    await database.goals.update(defaultGoal.id!, { categoryId: general.id! });
  }
}

export async function ensureSeeded(database: ConbhanDB = db): Promise<void> {
  await database.transaction('rw', database.categories, database.goals, async () => {
    await seedDefaults(database);
  });
}

export const db = new ConbhanDB();
