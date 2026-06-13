import { useEffect, useRef, useState } from 'react';

/**
 * Number input that keeps a local draft string while focused so the user
 * can type freely (including transient invalid values like "12." or "0.0").
 * Commits to the parent on blur or Enter; reverts on Escape.
 *
 * For fields where the parent stores W but the input shows kW, supply a
 * scale (1000 = kW). value is in parent units; the input renders
 * value / scale and commits draft * scale back.
 */
export function NumericInput({
  value,
  onCommit,
  scale = 1,
  step = 1,
  min = 0,
  decimals,
  className = 'inp mono',
  ...rest
}: {
  value: number;
  onCommit: (next: number) => void;
  scale?: number;
  step?: number;
  min?: number;
  decimals?: number;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'step' | 'type'>) {
  const display = value / scale;
  const formatted = decimals != null ? display.toFixed(decimals) : `${display}`;
  const [draft, setDraft] = useState<string>(formatted);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(formatted);
  }, [formatted]);

  function commit() {
    const parsed = parseFloat(draft);
    if (Number.isFinite(parsed)) {
      const next = Math.max(min, parsed * scale);
      if (next !== value) onCommit(next);
    }
    setDraft(decimals != null ? (Math.max(min, (parseFloat(draft) || 0) * scale) / scale).toFixed(decimals) : draft);
  }

  return (
    <input
      {...rest}
      className={className}
      type="number"
      min={min}
      step={step}
      value={draft}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        focused.current = false;
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        else if (e.key === 'Escape') {
          setDraft(formatted);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
