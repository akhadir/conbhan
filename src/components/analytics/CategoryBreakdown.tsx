import type { CategoryStat } from '../../lib/analytics';
import { formatCredits, formatPercent } from '../../lib/credits';

interface CategoryBreakdownProps {
  rows: CategoryStat[];
}

export function CategoryBreakdown({ rows }: CategoryBreakdownProps) {
  const visible = rows.filter((row) => row.txnCount > 0 || row.goalCount > 0);

  return (
    <section className="panel" aria-label="Category breakdown">
      <header className="panel-head">
        <div>
          <h2>By category</h2>
          <p className="panel-subtitle">Active credits grouped by each transaction&rsquo;s category.</p>
        </div>
      </header>
      {visible.length === 0 ? (
        <p className="breakdown-empty">No category activity yet.</p>
      ) : (
        <ul className="breakdown-list">
          {visible.map((row) => (
            <li key={row.category.id} className="breakdown-row">
              <div className="breakdown-top">
                <span className="breakdown-name">{row.category.name}</span>
                <span className="breakdown-values">
                  <strong>{formatCredits(row.active)}</strong>
                  <span className="breakdown-share">{formatPercent(row.sharePct)}</span>
                </span>
              </div>
              <div className="breakdown-bar" aria-hidden="true">
                <span className="breakdown-fill" style={{ width: `${Math.min(100, row.sharePct)}%` }} />
              </div>
              <p className="breakdown-meta">
                {formatCredits(row.earned)} earned · {row.txnCount} {row.txnCount === 1 ? 'entry' : 'entries'} ·{' '}
                {row.goalCount} {row.goalCount === 1 ? 'goal' : 'goals'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
