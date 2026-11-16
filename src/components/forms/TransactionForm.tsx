import { useState } from 'react';
import type { Category, Goal, TransactionType } from '../../db/schema';
import { parseCredits } from '../../lib/credits';
import { isValidISODate, todayISO } from '../../lib/dates';
import { CategoryCombobox } from './CategoryCombobox';

export interface TransactionFormValues {
  goalId: number;
  type: TransactionType;
  credits: number;
  categoryName: string;
  transactionDate: string;
  note: string;
}

interface TransactionFormProps {
  goals: Goal[];
  categories: Category[];
  initial?: Partial<TransactionFormValues>;
  /** Overrides the edit-mode inference from `initial` (the app prefills new entries too). */
  editing?: boolean;
  onSubmit: (values: TransactionFormValues) => void | Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
}

interface FormErrors {
  goal?: string;
  credits?: string;
  date?: string;
}

export function TransactionForm({
  goals,
  categories,
  initial,
  editing,
  onSubmit,
  onCancel,
  submitting = false,
}: TransactionFormProps) {
  const categoryNameFor = (goalId: string | number) => {
    const goal = goals.find((candidate) => String(candidate.id) === String(goalId));
    return categories.find((category) => category.id === goal?.categoryId)?.name ?? '';
  };

  const [goalId, setGoalId] = useState(initial?.goalId ? String(initial.goalId) : '');
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'credit');
  const [credits, setCredits] = useState(initial?.credits !== undefined ? String(initial.credits) : '');
  const [categoryName, setCategoryName] = useState(
    initial?.categoryName ?? (initial?.goalId ? categoryNameFor(initial.goalId) : ''),
  );
  const [transactionDate, setTransactionDate] = useState(initial?.transactionDate ?? todayISO());
  const [note, setNote] = useState(initial?.note ?? '');
  const [errors, setErrors] = useState<FormErrors>({});
  const isEditing = editing ?? Boolean(initial);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FormErrors = {};

    if (!goalId) nextErrors.goal = 'Select a goal';

    const amount = parseCredits(credits);
    if (amount === null) nextErrors.credits = 'Credits must be greater than 0';

    const date = transactionDate.trim();
    if (!isValidISODate(date)) nextErrors.date = 'Date must be a valid date';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || amount === null) return;

    void onSubmit({
      goalId: Number(goalId),
      type,
      credits: amount,
      categoryName: categoryName.trim() || categoryNameFor(goalId),
      transactionDate: date,
      note: note.trim().replace(/\s+/g, ' '),
    });
  };

  return (
    <form className="form-grid" onSubmit={handleSubmit} noValidate>
      <div className="form-row">
        <label htmlFor="txn-goal">Goal</label>
        <select
          id="txn-goal"
          className="input"
          value={goalId}
          onChange={(event) => {
            const next = event.target.value;
            setGoalId(next);
            setCategoryName(next ? categoryNameFor(next) : '');
          }}
          aria-invalid={Boolean(errors.goal)}
        >
          <option value="">Choose a goal…</option>
          {goals.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.title}
            </option>
          ))}
        </select>
        {errors.goal && <p className="form-error">{errors.goal}</p>}
      </div>

      <div className="form-row form-row-split">
        <div>
          <label htmlFor="txn-type">Type</label>
          <select
            id="txn-type"
            className="input"
            value={type}
            onChange={(event) => setType(event.target.value as TransactionType)}
          >
            <option value="credit">Credit (+)</option>
            <option value="debit">Debit (−)</option>
          </select>
        </div>
        <div>
          <label htmlFor="txn-credits">Credits</label>
          <input
            id="txn-credits"
            className="input"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder="e.g. 50"
            value={credits}
            onChange={(event) => setCredits(event.target.value)}
            aria-invalid={Boolean(errors.credits)}
          />
        </div>
      </div>
      {errors.credits && <p className="form-error">{errors.credits}</p>}

      <div className="form-row">
        <label htmlFor="txn-category">Category</label>
        <CategoryCombobox
          id="txn-category"
          categories={categories}
          value={categoryName}
          onChange={setCategoryName}
        />
        <p className="form-hint">Defaults to the goal category; override it if this entry belongs elsewhere.</p>
      </div>

      <div className="form-row">
        <label htmlFor="txn-date">Date</label>
        <input
          id="txn-date"
          className="input"
          type="date"
          value={transactionDate}
          onChange={(event) => setTransactionDate(event.target.value)}
          aria-invalid={Boolean(errors.date)}
        />
        {errors.date && <p className="form-error">{errors.date}</p>}
      </div>

      <div className="form-row">
        <label htmlFor="txn-note">Note</label>
        <input
          id="txn-note"
          className="input"
          value={note}
          maxLength={200}
          placeholder="Optional details"
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {isEditing ? 'Save transaction' : 'Add transaction'}
        </button>
      </div>
    </form>
  );
}
