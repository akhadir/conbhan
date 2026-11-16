import type { LabelStat } from '../../lib/analytics';
import { formatCredits, formatPercent } from '../../lib/credits';

interface LabelBreakdownProps {
  rows: LabelStat[];
}

export function LabelBreakdown({ rows }: LabelBreakdownProps) {
  const visible = rows.filter((row) => row.txnCount > 0 || row.goalCount > 0);

  return (
    <section className="panel" aria-label="Label breakdown">
      <header className="panel-head">
        <div>
          <h2>By label</h2>
          <p className="panel-subtitle">Credits rolled up through every label on a goal.</p>
        </div>
      </header>
      {visible.length === 0 ? (
        <p className="breakdown-empty">Add labels to goals to see this breakdown.</p>
      ) : (
        <ul className="breakdown-list">
          {visible.map((row) => (
            <li key={row.label.id} className="breakdown-row">
              <div className="breakdown-top">
                <span className="breakdown-name">
                  <span className="chip-dot" style={{ background: row.label.color }} />
                  {row.label.name}
                </span>
                <span className="breakdown-values">
                  <strong>{formatCredits(row.active)}</strong>
                  <span className="breakdown-share">{formatPercent(row.sharePct)}</span>
                </span>
              </div>
              <div className="breakdown-bar" aria-hidden="true">
                <span
                  className="breakdown-fill"
                  style={{ width: `${Math.min(100, row.sharePct)}%`, background: row.label.color }}
                />
              </div>
              <p className="breakdown-meta">
                {formatCredits(row.earned)} earned · {row.goalCount} {row.goalCount === 1 ? 'goal' : 'goals'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
