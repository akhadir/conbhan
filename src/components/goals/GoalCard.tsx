import type { GoalStats } from '../../lib/analytics';
import { formatAmount, formatCredits, formatPercent, formatSignedCredits } from '../../lib/credits';
import { formatDate } from '../../lib/dates';
import type { Goal } from '../../db/schema';

interface GoalCardProps {
  stat: GoalStats;
  onAddCredits: (goal: Goal) => void;
  onEdit: (goal: Goal) => void;
  onClear: (goal: Goal) => void;
  onToggleComplete: (goal: Goal, completed: boolean) => void;
  onDelete: (goal: Goal) => void;
}

const DEADLINE_LABELS: Record<string, string> = {
  completed: 'Completed',
  overdue: 'Overdue',
  'due-today': 'Due today',
  reached: 'Target reached',
  upcoming: 'On track',
  'no-date': 'No deadline',
};

export function GoalCard({ stat, onAddCredits, onEdit, onClear, onToggleComplete, onDelete }: GoalCardProps) {
  const { goal, category, labels, active, target, progressPct, barPct, pace, deadline, milestone } = stat;
  const isCompleted = Boolean(goal.completedAt);
  const isDefault = goal.isDefault === 1;
  const canDelete = !isDefault && stat.txCount === 0;
  const deadlineLabel = isCompleted ? DEADLINE_LABELS.completed : DEADLINE_LABELS[deadline];

  return (
    <article className={`goal-card${isCompleted ? ' is-completed' : ''}${isDefault ? ' is-default' : ''}`}>
      <header className="goal-head">
        <div className="goal-title-wrap">
          <h3 className="goal-title">{goal.title}</h3>
          <div className="goal-meta">
            {category && <span className="badge">{category.name}</span>}
            {deadlineLabel && (
              <span className={`badge badge-${deadline}${isCompleted ? ' badge-completed' : ''}`}>{deadlineLabel}</span>
            )}
            {labels.map((label) => (
              <span key={label.id} className="chip chip-static" style={{ borderColor: label.color }}>
                <span className="chip-dot" style={{ background: label.color }} />
                {label.name}
              </span>
            ))}
          </div>
        </div>
      </header>

      {target !== null ? (
        <div className="goal-progress">
          <p className="goal-progress-label">
            {formatAmount(active)} / {formatCredits(target)} — {formatPercent(progressPct ?? 0)}
          </p>
          <div
            className="progress-track"
            role="progressbar"
            aria-label={`${goal.title} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={barPct ?? 0}
          >
            <span className="progress-fill" style={{ width: `${barPct ?? 0}%` }} />
          </div>
          {pace && !isCompleted && (
            <p className="goal-pace">
              <span>{pace.daysLeft > 0 ? `${pace.daysLeft} days left` : pace.daysLeft === 0 ? 'Due today' : `${Math.abs(pace.daysLeft)} days late`}</span>
              <span className="goal-pace-rate">
                Required: {formatSignedCredits(pace.daily, 'credit')}/day
              </span>
            </p>
          )}
          {goal.targetDate && !isCompleted && <p className="goal-date">Due {formatDate(goal.targetDate)}</p>}
        </div>
      ) : (
        <div className="goal-progress">
          <p className="goal-progress-label">{formatCredits(active)} accumulated</p>
          {milestone && (
            <>
              <div
                className="progress-track"
                role="progressbar"
                aria-label={`${goal.title} next milestone`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={milestone.progressPct}
              >
                <span className="progress-fill" style={{ width: `${milestone.progressPct}%` }} />
              </div>
              <p className="goal-pace">
                <span>Next milestone: {formatCredits(milestone.next)}</span>
                <span className="goal-pace-rate">{formatCredits(milestone.toNext)} to go</span>
              </p>
            </>
          )}
        </div>
      )}

      <footer className="goal-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onAddCredits(goal)}>
          Add credits
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(goal)}>
          Edit
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onClear(goal)}>
          Clear goal
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onToggleComplete(goal, !isCompleted)}>
          {isCompleted ? 'Reopen' : 'Mark completed'}
        </button>
        {!isDefault && (
          <button
            type="button"
            className="btn btn-danger btn-sm"
            disabled={!canDelete}
            title={canDelete ? 'Delete this goal' : 'Goals with transaction history cannot be deleted'}
            onClick={() => onDelete(goal)}
          >
            Delete
          </button>
        )}
      </footer>
    </article>
  );
}
