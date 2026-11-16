import type { Totals } from '../../lib/analytics';
import { formatCredits, roundCredits } from '../../lib/credits';

interface KpiCardsProps {
  totals: Totals;
  filtered?: boolean;
}

export function KpiCards({ totals, filtered = false }: KpiCardsProps) {
  return (
    <section className="kpi-wrap" aria-label="Key metrics">
      <div className="kpi-grid">
        <div className="kpi-card">
          <p className="kpi-label">Total active credits</p>
          <p className="kpi-value">{formatCredits(totals.activeCredits)}</p>
          <p className="kpi-note">Available to debit right now</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Total Credits of Active Goals</p>
          <p className="kpi-value">{formatCredits(totals.activeGoalsCredits)}</p>
          <p className="kpi-note">Combined credits across open goals</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Active goals</p>
          <p className="kpi-value">{totals.activeGoals} active</p>
          <p className="kpi-note">{totals.completedGoals} completed</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Overall completion</p>
          <p className="kpi-value">{`${roundCredits(totals.weightedCompletion)}%`}</p>
          <p className="kpi-note">
            {totals.reachedFixedGoals} of {totals.fixedGoals} targets reached
          </p>
        </div>
      </div>
      {filtered && <p className="filtered-flag">Filtered view — metrics reflect the current filters.</p>}
    </section>
  );
}
