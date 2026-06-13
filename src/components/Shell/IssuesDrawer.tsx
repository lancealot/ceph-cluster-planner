import { useEffect, useMemo, useRef, useState } from 'react';
import { useAllIssues } from '../../state/useAllIssues';
import type { ValidationSeverity } from '../../types/scenario';
import { SevDot } from './primitives';

type Filter = 'all' | ValidationSeverity;
const FILTERS: Filter[] = ['all', 'error', 'warning', 'info'];

export function IssuesDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const issues = useAllIssues();
  const drawerRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement | null;
    // Initial focus: Close button so Tab cycles into the drawer's controls.
    const closeBtn = drawerRef.current?.querySelector<HTMLButtonElement>('[data-drawer-close]');
    closeBtn?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Focus trap: keep Tab/Shift+Tab inside the drawer.
      if (e.key !== 'Tab' || !drawerRef.current) return;
      const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      lastFocus.current?.focus?.();
    };
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
      <div className="drawer" role="dialog" aria-label="Validation issues" aria-modal="true" ref={drawerRef}>
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
          <button className="btn sm" type="button" onClick={onClose} data-drawer-close>
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
