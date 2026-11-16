import { useEffect, useRef, useState } from 'react';

interface DataMenuProps {
  onExport: () => void;
  onImport: () => void;
  onReset: () => void;
  onManage: () => void;
}

export function DataMenu({ onExport, onImport, onReset, onManage }: DataMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="data-menu" ref={containerRef}>
      <button
        type="button"
        className="btn btn-ghost"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Data
      </button>
      {open && (
        <div className="menu" role="menu" aria-label="Data options">
          <button type="button" role="menuitem" className="menu-item" onClick={() => run(onExport)}>
            Export backup
          </button>
          <button type="button" role="menuitem" className="menu-item" onClick={() => run(onImport)}>
            Import backup
          </button>
          <button type="button" role="menuitem" className="menu-item" onClick={() => run(onManage)}>
            Manage categories &amp; labels
          </button>
          <button type="button" role="menuitem" className="menu-item menu-item-danger" onClick={() => run(onReset)}>
            Reset all data
          </button>
        </div>
      )}
    </div>
  );
}
