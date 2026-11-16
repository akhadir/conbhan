import { useEffect, useId, useRef, useState } from 'react';
import type { Category } from '../../db/schema';

interface CategoryComboboxProps {
  categories: Category[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  id?: string;
  autoFocus?: boolean;
}

/** Single-select combobox that lets the user pick or type a brand-new category. */
export function CategoryCombobox({
  categories,
  value,
  onChange,
  label = 'Category',
  id,
  autoFocus = false,
}: CategoryComboboxProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const query = value.trim();
  const filtered = categories.filter((category) => category.name.toLowerCase().includes(query.toLowerCase()));
  const exact = categories.some((category) => category.name.toLowerCase() === query.toLowerCase());
  const canCreate = query.length > 0 && !exact;

  const choose = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        className="input"
        value={value}
        placeholder="General (default)"
        autoFocus={autoFocus}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            return;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            if (!open) {
              setOpen(true);
            } else if (canCreate) {
              choose(query);
            } else if (filtered.length > 0) {
              choose(filtered[0].name);
            }
          }
        }}
      />
      {open && (filtered.length > 0 || canCreate) && (
        <ul id={listId} role="listbox" aria-label={`${label} options`} className="combobox-list">
          {filtered.map((category) => (
            <li
              key={category.id}
              role="option"
              aria-selected={category.name.toLowerCase() === query.toLowerCase()}
              className="combobox-option"
              onMouseDown={(event) => {
                event.preventDefault();
                choose(category.name);
              }}
            >
              <span>{category.name}</span>
              {category.isDefault === 1 && <span className="combobox-hint">default</span>}
            </li>
          ))}
          {canCreate && (
            <li
              role="option"
              aria-selected={false}
              className="combobox-option combobox-create"
              onMouseDown={(event) => {
                event.preventDefault();
                choose(query);
              }}
            >
              Create &quot;{query}&quot;
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
