import { useState } from 'react';
import type { Label } from '../../db/schema';
import { labelColor } from '../../lib/colors';

interface LabelMultiSelectProps {
  labels: Label[];
  value: string[];
  onChange: (names: string[]) => void;
  id?: string;
}

/** Multi-select chip input that creates labels on the fly. */
export function LabelMultiSelect({ labels, value, onChange, id }: LabelMultiSelectProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const colorFor = (name: string) =>
    labels.find((label) => label.name.toLowerCase() === name.toLowerCase())?.color ?? labelColor(name);

  const add = (raw: string) => {
    const name = raw.trim().replace(/\s+/g, ' ');
    if (!name) return;
    if (!value.some((existing) => existing.toLowerCase() === name.toLowerCase())) {
      onChange([...value, name]);
    }
    setQuery('');
  };

  const remove = (name: string) => onChange(value.filter((existing) => existing !== name));

  const suggestions = labels
    .filter((label) => !value.some((existing) => existing.toLowerCase() === label.name.toLowerCase()))
    .filter((label) => (query ? label.name.toLowerCase().includes(query.toLowerCase()) : true))
    .slice(0, 6);

  return (
    <div className="label-select">
      <div className="label-select-box" onClick={() => document.getElementById(id ?? 'label-input')?.focus()}>
        {value.map((name) => (
          <span key={name} className="chip chip-removable" style={{ borderColor: colorFor(name) }}>
            <span className="chip-dot" style={{ background: colorFor(name) }} />
            {name}
            <button
              type="button"
              className="chip-remove"
              aria-label={`Remove ${name}`}
              onClick={(event) => {
                event.stopPropagation();
                remove(name);
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id ?? 'label-input'}
          className="label-select-input"
          aria-label="Add label"
          placeholder={value.length === 0 ? 'Type a label and press Enter' : 'Add another label…'}
          value={query}
          autoComplete="off"
          onFocus={() => setFocused(true)}
          onBlur={() => {
            window.setTimeout(() => setFocused(false), 120);
            if (query.trim()) add(query);
          }}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              add(query);
            } else if (event.key === 'Backspace' && query === '' && value.length > 0) {
              remove(value[value.length - 1]);
            }
          }}
        />
      </div>
      {focused && query.trim().length > 0 && suggestions.length > 0 && (
        <ul role="listbox" aria-label="Label suggestions" className="combobox-list static">
          {suggestions.map((label) => (
            <li
              key={label.id}
              role="option"
              aria-selected={false}
              className="combobox-option"
              onMouseDown={(event) => {
                event.preventDefault();
                add(label.name);
              }}
            >
              <span className="chip-dot" style={{ background: label.color }} />
              {label.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
