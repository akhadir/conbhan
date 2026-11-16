export interface Category {
  id?: number;
  name: string;
  isDefault: 0 | 1;
  createdAt: string;
}

export interface Label {
  id?: number;
  name: string;
  color: string;
  createdAt: string;
}

export interface Goal {
  id?: number;
  title: string;
  /** null means an unlimited goal that only accumulates credits. */
  targetCredits: number | null;
  /** Local ISO date (YYYY-MM-DD) or null for open-ended goals. */
  targetDate: string | null;
  categoryId: number;
  labelIds: number[];
  isDefault: 0 | 1;
  createdAt: string;
  /** Set when the user marks the goal completed; history is preserved. */
  completedAt?: string | null;
}

export type TransactionType = 'credit' | 'debit';

export interface Transaction {
  id?: number;
  goalId: number;
  categoryId: number;
  /** Positive magnitude; direction comes from `type`. */
  credits: number;
  type: TransactionType;
  note: string;
  isCleared: 0 | 1;
  /** Local ISO date (YYYY-MM-DD). */
  transactionDate: string;
  createdAt: string;
}

export interface Snapshot {
  categories: Category[];
  labels: Label[];
  goals: Goal[];
  transactions: Transaction[];
}

export const DB_NAME = 'ConbhanDB';
export const DEFAULT_CATEGORY_NAME = 'General';
export const DEFAULT_GOAL_TITLE = 'General Credits';
