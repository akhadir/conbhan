import { useState } from 'react';
import type { Category, Label } from '../../db/schema';

interface ManageDialogProps {
  categories: Category[];
  labels: Label[];
  onRenameCategory: (category: Category, name: string) => Promise<void>;
  onDeleteCategory: (category: Category) => Promise<void>;
  onRenameLabel: (label: Label, name: string) => Promise<void>;
  onDeleteLabel: (label: Label) => Promise<void>;
}

function RenameRow({
  name,
  onRename,
  onDelete,
  canDelete,
}: {
  name: string;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
  canDelete: boolean;
}) {
  const [value, setValue] = useState(name);

  return (
    <li className="manage-row">
      <input className="input input-sm" value={value} aria-label={`Rename ${name}`} onChange={(event) => setValue(event.target.value)} />
      <div className="manage-actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={!value.trim() || value.trim() === name}
          onClick={() => void onRename(value.trim())}
        >
          Rename
        </button>
        <button type="button" className="btn btn-danger btn-sm" disabled={!canDelete} onClick={() => void onDelete()}>
          Delete
        </button>
      </div>
    </li>
  );
}

export function ManageDialog({
  categories,
  labels,
  onRenameCategory,
  onDeleteCategory,
  onRenameLabel,
  onDeleteLabel,
}: ManageDialogProps) {
  return (
    <div className="manage-grid">
      <section>
        <h3>Categories</h3>
        <ul className="manage-list">
          {categories.map((category) => (
            <RenameRow
              key={category.id}
              name={category.name}
              canDelete={category.isDefault !== 1}
              onRename={(name) => onRenameCategory(category, name)}
              onDelete={() => onDeleteCategory(category)}
            />
          ))}
        </ul>
      </section>
      <section>
        <h3>Labels</h3>
        {labels.length === 0 ? (
          <p className="form-hint">Labels appear here after you add them to a goal.</p>
        ) : (
          <ul className="manage-list">
            {labels.map((label) => (
              <RenameRow
                key={label.id}
                name={label.name}
                canDelete
                onRename={(name) => onRenameLabel(label, name)}
                onDelete={() => onDeleteLabel(label)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
