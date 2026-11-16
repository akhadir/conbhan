import { useState } from 'react';
import type { Category, Label } from '../../db/schema';
import { parseCredits } from '../../lib/credits';
import { isValidISODate } from '../../lib/dates';
import { CategoryCombobox } from './CategoryCombobox';
import { LabelMultiSelect } from './LabelMultiSelect';

export interface GoalFormValues {
  title: string;
  targetCredits: number | null;
  targetDate: string | null;
  /** Blank means "use the default category" (General). */
  categoryName: string;
  labelNames: string[];
}

interface GoalFormProps {
  categories: Category[];
  labels: Label[];
  initial?: Partial<GoalFormValues>;
  onSubmit: (values: GoalFormValues) => void | Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
}

interface FormErrors {
  title?: string;
  targetCredits?: string;
  targetDate?: string;
}

export function GoalForm({ categories, labels, initial, onSubmit, onCancel, submitting = false }: GoalFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [target, setTarget] = useState(
    initial?.targetCredits === null || initial?.targetCredits === undefined ? '' : String(initial.targetCredits),
  );
  const [unlimited, setUnlimited] = useState(initial ? initial.targetCredits === null : false);
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? '');
  const [categoryName, setCategoryName] = useState(initial?.categoryName ?? '');
  const [labelNames, setLabelNames] = useState<string[]>(initial?.labelNames ?? []);
  const [errors, setErrors] = useState<FormErrors>({});
  const isEditing = Boolean(initial);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FormErrors = {};

    const trimmedTitle = title.trim().replace(/\s+/g, ' ');
    if (!trimmedTitle) nextErrors.title = 'Title is required';

    let targetCredits: number | null = null;
    if (!unlimited) {
      if (target.trim()) {
        targetCredits = parseCredits(target);
        if (targetCredits === null) nextErrors.targetCredits = 'Target credits must be greater than 0';
      }
    }

    const date = targetDate.trim();
    if (date && !isValidISODate(date)) nextErrors.targetDate = 'Target date must be a valid date';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    void onSubmit({
      title: trimmedTitle,
      targetCredits,
      targetDate: date || null,
      categoryName: categoryName.trim(),
      labelNames,
    });
  };

  return (
    <form className="form-grid" onSubmit={handleSubmit} noValidate>
      <div className="form-row">
        <label htmlFor="goal-title">Title</label>
        <input
          id="goal-title"
          className="input"
          value={title}
          autoFocus
          placeholder="e.g. Learn TypeScript"
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={Boolean(errors.title)}
        />
        {errors.title && <p className="form-error">{errors.title}</p>}
      </div>

      <div className="form-row">
        <label htmlFor="goal-category">Category</label>
        <CategoryCombobox id="goal-category" categories={categories} value={categoryName} onChange={setCategoryName} />
        <p className="form-hint">Pick an existing category or type a new one.</p>
      </div>

      <div className="form-row">
        <label htmlFor="goal-target">Target credits</label>
        <input
          id="goal-target"
          className="input"
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={unlimited ? '' : target}
          disabled={unlimited}
          placeholder={unlimited ? 'Unlimited' : 'e.g. 1000'}
          onChange={(event) => setTarget(event.target.value)}
          aria-invalid={Boolean(errors.targetCredits)}
        />
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={unlimited}
            onChange={(event) => {
              setUnlimited(event.target.checked);
              if (event.target.checked) setTarget('');
            }}
          />
          No limit — just accumulate credits
        </label>
        {errors.targetCredits && <p className="form-error">{errors.targetCredits}</p>}
      </div>

      <div className="form-row">
        <label htmlFor="goal-date">Target date</label>
        <input
          id="goal-date"
          className="input"
          type="date"
          value={targetDate}
          onChange={(event) => setTargetDate(event.target.value)}
          aria-invalid={Boolean(errors.targetDate)}
        />
        <p className="form-hint">Optional. Leave blank for an open-ended goal.</p>
        {errors.targetDate && <p className="form-error">{errors.targetDate}</p>}
      </div>

      <div className="form-row">
        <label htmlFor="goal-labels">Labels</label>
        <LabelMultiSelect id="goal-labels" labels={labels} value={labelNames} onChange={setLabelNames} />
        <p className="form-hint">Optional. Press Enter to add each label.</p>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {isEditing ? 'Save goal' : 'Create goal'}
        </button>
      </div>
    </form>
  );
}
