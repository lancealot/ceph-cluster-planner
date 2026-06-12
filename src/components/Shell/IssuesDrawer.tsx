import { useEffect, useMemo, useState } from 'react';
import { useAllIssues } from '../../state/useAllIssues';
import type { ValidationSeverity } from '../../types/scenario';
import { SevDot } from './primitives';

type Filter = 'all' | ValidationSeverity;
const FILTERS: Filter[] = ['all', 'error', 'warning', 'info'];

export function IssuesDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const issues = useAllIssues();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filtered = useMemo(
    () => (filter === 'all' ? issues : issues.filter((i) => i.severity === filter)),
    [issues, filter]
  );

  const counts = useMemo(() => {
    const c: Record<ValidationSeverity, number> = { error: 0, warning: 0, info: 0 };
    for (const i of issues) c[i.severity]++;
    return c;
  }, [issues]);

  if (!open) return null;

  return (
    <div>
      <div className="drawer-scrim" onClick={onClose} />
      <div className="drawer" role="dialog" aria-label="Validation issues">
        <div className="drawer-hd">
          <span className="microlabel">
            Validation — {issues.length} total ({counts.error} errors · {counts.warning} warnings · {counts.info} info)
          </span>
          <div className="sev-chips grow">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={
                  'sev-chip' +
                  (filter === f
                    ? f === 'error'
                      ? ' err'
                      : f === 'warning'
                      ? ' warn'
                      : f === 'info'
                      ? ' info'
                      : ' warn'
                    : '')
                }
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <button className="btn sm" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="drawer-bd">
          {filtered.length === 0 ? (
            <div className="issue">
              <span className="dot ok" />
              <span className="scope">workspace</span>
              <span className="msg">No issues for this filter.</span>
            </div>
          ) : (
            filtered.map((i, idx) => (
              <div className="issue" key={`${i.scope}-${i.ref_id}-${i.code}-${idx}`}>
                <SevDot sev={i.severity} />
                <span className="scope">{i.scope} / {i.code}</span>
                <span className="msg">{i.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
