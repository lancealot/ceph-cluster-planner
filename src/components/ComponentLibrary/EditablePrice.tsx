import { useEffect, useRef, useState } from 'react';
import { format_usd as fmtUsd } from '../../calc/units';

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
    if (Number.isFinite(draft) && draft >= 0 && draft !== value) onSave(draft);
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
        className="btn"
        style={{
          padding: '2px 6px',
          minHeight: 0,
          color: modified ? 'var(--accent)' : 'var(--text)',
          fontFamily: "'IBM Plex Mono', monospace",
          fontVariantNumeric: 'tabular-nums',
          background: 'transparent',
          border: '1px solid transparent',
        }}
        title={modified ? 'Overrides the bundled price' : 'Click to edit'}
      >
        {fmtUsd(value)}
        {modified ? ' *' : ''}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      className="inp mono"
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
      style={{ width: '110px', textAlign: 'right', padding: '4px 8px' }}
    />
  );
}
