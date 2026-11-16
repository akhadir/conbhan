import type { Snapshot } from '../../db/schema';
import type { DeadlineFilter, Filters } from '../../lib/analytics';
import { DEFAULT_FILTERS } from '../../lib/analytics';

interface FilterBarProps {
  snapshot: Snapshot;
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const DEADLINE_OPTIONS: { value: DeadlineFilter; label: string }[] = [
  { value: 'all', label: 'All goals' },
  { value: 'active', label: 'Active goals' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'due-today', label: 'Due today' },
  { value: 'no-date', label: 'No deadline' },
  { value: 'completed', label: 'Completed' },
];

export function FilterBar({ snapshot, filters, onChange }: FilterBarProps) {
  const toggleLabel = (id: number) => {
    const labelIds = filters.labelIds.includes(id)
      ? filters.labelIds.filter((existing) => existing !== id)
      : [...filters.labelIds, id];
    onChange({ ...filters, labelIds });
  };

  const isFiltered =
    filters.labelIds.length > 0 ||
    filters.categoryId !== null ||
    filters.deadline !== 'all' ||
    filters.search.trim().length > 0;

  return (
    <section className="filter-bar" aria-label="Filters">
      <div className="filter-search">
        <label htmlFor="filter-search">Search</label>
        <input
          id="filter-search"
          className="input"
          type="search"
          value={filters.search}
          placeholder="Search goals, categories, labels, notes…"
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
        />
      </div>

      <div className="filter-selects">
        <div>
          <label htmlFor="filter-category">Category</label>
          <select
            id="filter-category"
            className="input"
            value={filters.categoryId ?? ''}
            onChange={(event) =>
              onChange({ ...filters, categoryId: event.target.value ? Number(event.target.value) : null })
            }
          >
            <option value="">All categories</option>
            {snapshot.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-deadline">Deadline</label>
          <select
            id="filter-deadline"
            className="input"
            value={filters.deadline}
            onChange={(event) => onChange({ ...filters, deadline: event.target.value as DeadlineFilter })}
          >
            {DEADLINE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="filter-labels">
        <span className="filter-labels-title">Labels</span>
        <div className="filter-label-buttons">
          {snapshot.labels.map((label) => {
            const active = filters.labelIds.includes(label.id!);
            return (
              <button
                key={label.id}
                type="button"
                className={`chip chip-toggle${active ? ' is-active' : ''}`}
                style={{ borderColor: label.color }}
                aria-pressed={active}
                onClick={() => toggleLabel(label.id!)}
              >
                <span className="chip-dot" style={{ background: label.color }} />
                {label.name}
              </button>
            );
          })}
          {snapshot.labels.length === 0 && <span className="form-hint">No labels yet.</span>}
        </div>
      </div>

      <div className="filter-actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => onChange(DEFAULT_FILTERS)}
          disabled={!isFiltered}
        >
          Clear filters
        </button>
      </div>
    </section>
  );
}
