import { useEffect, useRef, useState } from 'react';
import { format_usd } from '../../calc/units';

interface Props {
  value: number;
  onSave: (price_usd: number) => void;
  modified?: boolean;
}

export function EditablePrice({ value, onSave, modified }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit() {
    if (Number.isFinite(draft) && draft >= 0 && draft !== value) {
      onSave(draft);
    }
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className={`text-right px-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 w-full ${
          modified ? 'text-sky-700 dark:text-sky-300 font-medium' : ''
        }`}
        title={modified ? 'Overrides the bundled price' : 'Click to edit'}
      >
        {format_usd(value)}
        {modified ? ' *' : ''}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      type="number"
      min={0}
      step={0.01}
      value={draft}
      onChange={(e) => setDraft(parseFloat(e.target.value) || 0)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        else if (e.key === 'Escape') setEditing(false);
      }}
      className="border rounded px-1 py-0.5 text-sm w-24 text-right bg-white dark:bg-slate-800 dark:border-slate-600"
    />
  );
}
