import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/db';
import * as repo from './db/repo';
import type { Category, Goal, Label } from './db/schema';
import {
  DEFAULT_FILTERS,
  buildCategoryStats,
  buildGoalStats,
  buildLabelStats,
  computeTotals,
  dailyTrend,
  filterSnapshot,
  ledgerEntries,
  monthlyTrend,
} from './lib/analytics';
import type { Filters } from './lib/analytics';
import { backupFilename, buildBackup, importBackup, validateBackup } from './lib/backup';
import { todayISO } from './lib/dates';
import { formatCredits } from './lib/credits';
import { GoalCard } from './components/goals/GoalCard';
import { KpiCards } from './components/analytics/KpiCards';
import { FilterBar } from './components/analytics/FilterBar';
import { CategoryBreakdown } from './components/analytics/CategoryBreakdown';
import { LabelBreakdown } from './components/analytics/LabelBreakdown';
import { TrendChart } from './components/analytics/TrendChart';
import { LedgerSection } from './components/ledger/LedgerSection';
import { GoalForm } from './components/forms/GoalForm';
import type { GoalFormValues } from './components/forms/GoalForm';
import { TransactionForm } from './components/forms/TransactionForm';
import type { TransactionFormValues } from './components/forms/TransactionForm';
import { Modal } from './components/ui/Modal';
import { DataMenu } from './components/ui/DataMenu';
import { ManageDialog } from './components/data/ManageDialog';

type DialogState =
  | { kind: 'goal'; goal?: Goal }
  | { kind: 'txn'; goal?: Goal }
  | { kind: 'clear'; goal: Goal }
  | { kind: 'delete'; goal: Goal }
  | { kind: 'import' }
  | { kind: 'reset' }
  | { kind: 'manage' }
  | null;

interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error';
}

type ImportPreview =
  | { text: string; counts: { categories: number; labels: number; goals: number; transactions: number } }
  | { text: string; errors: string[] };

function downloadFile(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export default function App() {
  const snapshot = useLiveQuery(() => repo.getSnapshot(db), [], undefined);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark';
    return window.localStorage.getItem('conbhan-theme') ?? 'dark';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('conbhan-theme', theme);
  }, [theme]);

  const pushToast = (message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4500);
  };

  const today = todayISO();
  const filteredSnapshot = useMemo(
    () => (snapshot ? filterSnapshot(snapshot, filters, today) : undefined),
    [snapshot, filters, today],
  );

  const stats = useMemo(
    () => (filteredSnapshot ? buildGoalStats(filteredSnapshot, today) : []),
    [filteredSnapshot, today],
  );
  const totals = useMemo(() => computeTotals(stats), [stats]);
  const categoryStats = useMemo(
    () => (filteredSnapshot ? buildCategoryStats(filteredSnapshot, stats) : []),
    [filteredSnapshot, stats],
  );
  const labelStats = useMemo(
    () => (filteredSnapshot ? buildLabelStats(filteredSnapshot, stats) : []),
    [filteredSnapshot, stats],
  );
  const daily = useMemo(
    () => (filteredSnapshot ? dailyTrend(filteredSnapshot.transactions, today, 30) : []),
    [filteredSnapshot, today],
  );
  const monthly = useMemo(
    () => (filteredSnapshot ? monthlyTrend(filteredSnapshot.transactions, today, 6) : []),
    [filteredSnapshot, today],
  );
  const entries = useMemo(() => (filteredSnapshot ? ledgerEntries(filteredSnapshot) : []), [filteredSnapshot]);

  const hasFilters =
    filters.labelIds.length > 0 ||
    filters.categoryId !== null ||
    filters.deadline !== 'all' ||
    filters.search.trim().length > 0;

  const closeDialog = () => {
    setDialog(null);
    setImportPreview(null);
  };

  const categoryName = (id: number | null | undefined) =>
    snapshot?.categories.find((category) => category.id === id)?.name ?? '';

  const labelNames = (ids: number[]) =>
    ids
      .map((id) => snapshot?.labels.find((label) => label.id === id)?.name)
      .filter((name): name is string => Boolean(name));

  const exportBackup = async () => {
    try {
      const current = await repo.getSnapshot(db);
      downloadFile(backupFilename(), JSON.stringify(buildBackup(current), null, 2));
      pushToast('Backup exported');
    } catch (error) {
      pushToast(errorMessage(error), 'error');
    }
  };

  const handleGoalSubmit = async (values: GoalFormValues) => {
    if (dialog?.kind !== 'goal') return;
    setSubmitting(true);
    try {
      const category = values.categoryName ? await repo.findOrCreateCategory(values.categoryName, db) : null;
      const labels = await repo.findOrCreateLabels(values.labelNames, db);
      const labelIds = labels.map((label) => label.id!);

      if (dialog.goal) {
        await repo.updateGoal(
          dialog.goal.id!,
          {
            title: values.title,
            targetCredits: values.targetCredits,
            targetDate: values.targetDate,
            categoryId: category?.id ?? null,
            labelIds,
          },
          db,
        );
        pushToast('Goal updated');
      } else {
        await repo.createGoal(
          {
            title: values.title,
            targetCredits: values.targetCredits,
            targetDate: values.targetDate,
            categoryId: category?.id ?? null,
            labelIds,
          },
          db,
        );
        pushToast('Goal created');
      }
      closeDialog();
    } catch (error) {
      pushToast(errorMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransactionSubmit = async (values: TransactionFormValues) => {
    if (dialog?.kind !== 'txn') return;
    setSubmitting(true);
    try {
      const category = await repo.findOrCreateCategory(values.categoryName, db);
      await repo.addTransaction(
        {
          goalId: values.goalId,
          credits: values.credits,
          type: values.type,
          categoryId: category.id,
          note: values.note,
          transactionDate: values.transactionDate,
        },
        db,
      );
      pushToast(values.type === 'credit' ? 'Credits added' : 'Debit recorded');
      closeDialog();
    } catch (error) {
      pushToast(errorMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = async (goal: Goal) => {
    try {
      const cleared = await repo.clearGoal(goal.id!, db);
      pushToast(cleared > 0 ? `${plural(cleared, 'entry', 'entries')} cleared — history kept` : 'Nothing to clear');
      closeDialog();
    } catch (error) {
      pushToast(errorMessage(error), 'error');
    }
  };

  const handleDelete = async (goal: Goal) => {
    try {
      await repo.deleteGoal(goal.id!, db);
      pushToast('Goal deleted');
      closeDialog();
    } catch (error) {
      pushToast(errorMessage(error), 'error');
    }
  };

  const handleToggleComplete = async (goal: Goal, completed: boolean) => {
    try {
      await repo.markGoalCompleted(goal.id!, completed, db);
      pushToast(completed ? 'Goal marked completed' : 'Goal reopened');
    } catch (error) {
      pushToast(errorMessage(error), 'error');
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setImportPreview({ text, errors: ['The selected file is not valid JSON.'] });
        return;
      }
      const result = validateBackup(parsed);
      if (result.ok) {
        setImportPreview({
          text,
          counts: {
            categories: result.data.categories.length,
            labels: result.data.labels.length,
            goals: result.data.goals.length,
            transactions: result.data.transactions.length,
          },
        });
      } else {
        setImportPreview({ text, errors: result.errors });
      }
    } catch (error) {
      setImportPreview({ text: '', errors: [errorMessage(error)] });
    }
  };

  const handleImport = async () => {
    if (!importPreview || 'errors' in importPreview) return;
    setSubmitting(true);
    try {
      const current = await repo.getSnapshot(db);
      downloadFile(`conbhan-safety-backup-${today}.json`, JSON.stringify(buildBackup(current), null, 2));
      const counts = await importBackup(db, importPreview.text);
      pushToast(`Imported ${plural(counts.goals, 'goal')} and ${plural(counts.transactions, 'transaction')}`);
      closeDialog();
    } catch (error) {
      pushToast(errorMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    setSubmitting(true);
    try {
      await repo.resetAllData(db);
      setFilters(DEFAULT_FILTERS);
      pushToast('All data reset');
      closeDialog();
    } catch (error) {
      pushToast(errorMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRenameCategory = async (category: Category, name: string) => {
    try {
      await repo.renameCategory(category.id!, name, db);
      pushToast('Category renamed');
    } catch (error) {
      pushToast(errorMessage(error), 'error');
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    try {
      await repo.deleteCategory(category.id!, db);
      pushToast('Category deleted');
    } catch (error) {
      pushToast(errorMessage(error), 'error');
    }
  };

  const handleRenameLabel = async (label: Label, name: string) => {
    try {
      await repo.renameLabel(label.id!, name, db);
      pushToast('Label renamed');
    } catch (error) {
      pushToast(errorMessage(error), 'error');
    }
  };

  const handleDeleteLabel = async (label: Label) => {
    try {
      await repo.deleteLabel(label.id!, db);
      pushToast('Label deleted');
    } catch (error) {
      pushToast(errorMessage(error), 'error');
    }
  };

  if (!snapshot) {
    return (
      <div className="app-shell">
        <header className="app-header">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              C
            </span>
            <h1>Conbhan</h1>
          </div>
        </header>
        <main className="app-main">
          <p className="loading">Loading your credits…</p>
        </main>
      </div>
    );
  }

  const editGoalInitial = (goal: Goal) => ({
    title: goal.title,
    targetCredits: goal.targetCredits,
    targetDate: goal.targetDate,
    categoryName: categoryName(goal.categoryId),
    labelNames: labelNames(goal.labelIds),
  });

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            C
          </span>
          <div>
            <h1>Conbhan</h1>
            <p className="brand-tagline">Credit goals, progress and analytics — offline, in your browser.</p>
          </div>
        </div>
        <div className="app-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <DataMenu
            onExport={() => void exportBackup()}
            onImport={() => {
              setImportPreview(null);
              setDialog({ kind: 'import' });
            }}
            onManage={() => setDialog({ kind: 'manage' })}
            onReset={() => setDialog({ kind: 'reset' })}
          />
          <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: 'goal' })}>
            New goal
          </button>
        </div>
      </header>

      <main className="app-main">
        <KpiCards totals={totals} filtered={hasFilters} />

        <section className="panel" aria-label="Goals">
          <header className="panel-head">
            <div>
              <h2>Goals</h2>
              <p className="panel-subtitle">
                {plural(stats.length, 'goal')} in view · {formatCredits(totals.activeCredits)} active
              </p>
            </div>
          </header>

          <FilterBar snapshot={snapshot} filters={filters} onChange={setFilters} />

          {stats.length === 0 ? (
            <div className="empty-state">
              <p className="empty-title">No goals match these filters</p>
              <p>Clear the filters or create a new goal to get started.</p>
            </div>
          ) : (
            <div className="goals-grid">
              {stats.map((stat) => (
                <GoalCard
                  key={stat.goal.id}
                  stat={stat}
                  onAddCredits={(goal) => setDialog({ kind: 'txn', goal })}
                  onEdit={(goal) => setDialog({ kind: 'goal', goal })}
                  onClear={(goal) => setDialog({ kind: 'clear', goal })}
                  onToggleComplete={(goal, completed) => void handleToggleComplete(goal, completed)}
                  onDelete={(goal) => setDialog({ kind: 'delete', goal })}
                />
              ))}
            </div>
          )}
        </section>

        <section className="analytics-grid" aria-label="Analytics">
          <CategoryBreakdown rows={categoryStats} />
          <LabelBreakdown rows={labelStats} />
        </section>

        <section className="analytics-grid" aria-label="Trends">
          <TrendChart title="Daily trend" points={daily} granularity="day" />
          <TrendChart title="Monthly trend" points={monthly} granularity="month" />
        </section>

        <LedgerSection entries={entries} />
      </main>

      <footer className="app-footer">
        <p>
          Conbhan stores everything in this browser only. Export a JSON backup to move your credits between devices.
        </p>
      </footer>

      {dialog?.kind === 'goal' && (
        <Modal title={dialog.goal ? 'Edit Goal' : 'New Goal'} onClose={closeDialog}>
          <GoalForm
            key={dialog.goal?.id ?? 'new'}
            categories={snapshot.categories}
            labels={snapshot.labels}
            initial={dialog.goal ? editGoalInitial(dialog.goal) : undefined}
            onSubmit={handleGoalSubmit}
            onCancel={closeDialog}
            submitting={submitting}
          />
        </Modal>
      )}

      {dialog?.kind === 'txn' && (
        <Modal title="Add Credits" onClose={closeDialog} wide>
          <TransactionForm
            goals={dialog.goal ? [dialog.goal, ...snapshot.goals.filter((goal) => goal.id !== dialog.goal?.id)] : snapshot.goals}
            categories={snapshot.categories}
            editing={false}
            initial={
              dialog.goal
                ? {
                    goalId: dialog.goal.id,
                    categoryName: categoryName(dialog.goal.categoryId),
                    transactionDate: today,
                  }
                : undefined
            }
            onSubmit={handleTransactionSubmit}
            onCancel={closeDialog}
            submitting={submitting}
          />
        </Modal>
      )}

      {dialog?.kind === 'clear' && (
        <Modal title="Clear Goal" onClose={closeDialog}>
          <div className="form-grid">
            <p>
              Clearing <strong>{dialog.goal.title}</strong> resets its active balance to zero.
            </p>
            <p className="form-hint">
              Every credit and debit stays in your history and analytics — nothing is deleted.
            </p>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={closeDialog}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void handleClear(dialog.goal)}>
                Clear goal
              </button>
            </div>
          </div>
        </Modal>
      )}

      {dialog?.kind === 'delete' && (
        <Modal title="Delete Goal" onClose={closeDialog}>
          <div className="form-grid">
            <p>
              Delete <strong>{dialog.goal.title}</strong>? This cannot be undone.
            </p>
            <p className="form-hint">Goals with transaction history are protected — clear or complete them instead.</p>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={closeDialog}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={() => void handleDelete(dialog.goal)}>
                Delete goal
              </button>
            </div>
          </div>
        </Modal>
      )}

      {dialog?.kind === 'import' && (
        <Modal title="Import Backup" onClose={closeDialog} wide>
          <div className="form-grid">
            <div className="form-row">
              <label htmlFor="import-file">Import backup file</label>
              <input
                id="import-file"
                className="input"
                type="file"
                accept=".json,application/json"
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
            </div>

            {importPreview && 'counts' in importPreview && (
              <div className="import-preview">
                <p>
                  Ready to import <strong>{plural(importPreview.counts.goals, 'goal')}</strong>,{' '}
                  {plural(importPreview.counts.transactions, 'transaction')},{' '}
                  {plural(importPreview.counts.categories, 'category', 'categories')} and{' '}
                  {plural(importPreview.counts.labels, 'label')}.
                </p>
                <p className="form-hint">
                  This replaces all current data. A safety backup downloads automatically first.
                </p>
              </div>
            )}

            {importPreview && 'errors' in importPreview && (
              <div className="form-error-block">
                <p>This file cannot be imported:</p>
                <ul>
                  {importPreview.errors.slice(0, 6).map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={closeDialog} disabled={submitting}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={!importPreview || 'errors' in importPreview || submitting}
                onClick={() => void handleImport()}
              >
                Replace all data
              </button>
            </div>
          </div>
        </Modal>
      )}

      {dialog?.kind === 'reset' && (
        <Modal title="Reset All Data" onClose={closeDialog}>
          <div className="form-grid">
            <p>Delete every goal, label, category and transaction and return to a clean start?</p>
            <p className="form-hint">Export a backup first if you might want this data later.</p>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={closeDialog} disabled={submitting}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={() => void handleReset()} disabled={submitting}>
                Reset data
              </button>
            </div>
          </div>
        </Modal>
      )}

      {dialog?.kind === 'manage' && (
        <Modal title="Manage Categories & Labels" onClose={closeDialog} wide>
          <ManageDialog
            categories={snapshot.categories}
            labels={snapshot.labels}
            onRenameCategory={handleRenameCategory}
            onDeleteCategory={handleDeleteCategory}
            onRenameLabel={handleRenameLabel}
            onDeleteLabel={handleDeleteLabel}
          />
        </Modal>
      )}

      {toasts.length > 0 && (
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast${toast.tone === 'error' ? ' toast-error' : ''}`}>
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

