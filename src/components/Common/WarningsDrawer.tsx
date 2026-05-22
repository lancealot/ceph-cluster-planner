import { useMemo, useState } from 'react';
import type { ValidationIssue, ValidationSeverity } from '../../types/scenario';
import { WarningsList } from './WarningsList';

interface Props {
  issues: ValidationIssue[];
}

const FILTERS: Array<'all' | ValidationSeverity> = ['all', 'error', 'warning', 'info'];

export function WarningsDrawer({ issues }: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');

  const counts = useMemo(() => {
    const c: Record<ValidationSeverity, number> = { error: 0, warning: 0, info: 0 };
    for (const i of issues) c[i.severity]++;
    return c;
  }, [issues]);

  const filtered = useMemo(
    () => (filter === 'all' ? issues : issues.filter((i) => i.severity === filter)),
    [issues, filter]
  );

  return (
    <footer className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-2 text-sm flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-700"
        aria-expanded={open}
      >
        <span className="font-medium">
          Validation:{' '}
          <span className="text-rose-700 dark:text-rose-300">{counts.error} errors</span> ·{' '}
          <span className="text-amber-700 dark:text-amber-300">{counts.warning} warnings</span>
          {counts.info > 0 ? <> · <span className="text-sky-700 dark:text-sky-300">{counts.info} info</span></> : null}
        </span>
        <span aria-hidden>{open ? '▼' : '▲'}</span>
      </button>
      {open ? (
        <div className="p-3 border-t border-slate-200 dark:border-slate-700 max-h-72 overflow-y-auto">
          <div className="mb-2 flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`text-xs px-2 py-1 rounded ${
                  filter === f ? 'bg-slate-900 text-white' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <WarningsList issues={filtered} empty="No issues across the workspace." />
        </div>
      ) : null}
    </footer>
  );
}
