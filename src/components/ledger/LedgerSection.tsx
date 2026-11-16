import { useState } from 'react';
import type { LedgerEntry, LedgerGroupMode } from '../../lib/analytics';
import { groupLedger } from '../../lib/analytics';
import { formatCredits, formatSignedCredits } from '../../lib/credits';
import { formatDate } from '../../lib/dates';

interface LedgerSectionProps {
  entries: LedgerEntry[];
}

const TABS: { mode: LedgerGroupMode; label: string }[] = [
  { mode: 'day', label: 'Day' },
  { mode: 'month', label: 'Month' },
  { mode: 'category', label: 'Category' },
  { mode: 'label', label: 'Label' },
];

export function LedgerSection({ entries }: LedgerSectionProps) {
  const [mode, setMode] = useState<LedgerGroupMode>('day');
  const groups = groupLedger(entries, mode);

  return (
    <section className="panel ledger" role="region" aria-label="Transaction ledger">
      <header className="panel-head ledger-head">
        <div>
          <h2>Transaction ledger</h2>
          <p className="panel-subtitle">Every credit and debit, cleared history included.</p>
        </div>
        <div className="segmented" role="tablist" aria-label="Group ledger by">
          {TABS.map((tab) => (
            <button
              key={tab.mode}
              type="button"
              role="tab"
              aria-selected={mode === tab.mode}
              className={`segment${mode === tab.mode ? ' is-active' : ''}`}
              onClick={() => setMode(tab.mode)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {entries.length === 0 ? (
        <div className="empty-state">
          <p className="empty-title">No transactions yet</p>
          <p>Conbhan will keep every credit, debit and cleared entry here.</p>
        </div>
      ) : (
        <div className="ledger-groups">
          {groups.map((group) => (
            <div key={group.key} className="ledger-group">
              <div className="ledger-group-head">
                <h3>{group.label}</h3>
                <span className="ledger-group-total">
                  {formatCredits(group.earned)} earned <span aria-hidden="true">·</span>{' '}
                  {group.net < 0 ? '−' : ''}
                  {formatCredits(Math.abs(group.net))} net
                </span>
              </div>
              <ul className="ledger-list">
                {group.entries.map((entry) => (
                  <li key={`${group.key}-${entry.txn.id}`} className="ledger-row">
                    <div className="ledger-main">
                      <span className="ledger-goal">{entry.goal?.title ?? 'Unknown goal'}</span>
                      {mode !== 'category' && entry.category && (
                        <span className="badge badge-quiet">{entry.category.name}</span>
                      )}
                      {mode !== 'label' &&
                        entry.labels.map((label) => (
                          <span key={label.id} className="chip chip-static chip-xs" style={{ borderColor: label.color }}>
                            <span className="chip-dot" style={{ background: label.color }} />
                            {label.name}
                          </span>
                        ))}
                      {entry.txn.isCleared === 1 && <span className="badge badge-cleared">Cleared</span>}
                      {entry.txn.note && <span className="ledger-note">{entry.txn.note}</span>}
                    </div>
                    <div className="ledger-side">
                      <span className="ledger-date">{formatDate(entry.txn.transactionDate)}</span>
                      <strong className={entry.txn.type === 'debit' ? 'amount-debit' : 'amount-credit'}>
                        {formatSignedCredits(entry.txn.credits, entry.txn.type)}
                      </strong>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
