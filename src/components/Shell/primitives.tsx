import type { ReactNode } from 'react';
import type { ValidationSeverity } from '../../types/scenario';

export function Panel({
  title,
  right,
  children,
  tight = false,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  tight?: boolean;
}) {
  return (
    <section className="panel">
      {title ? (
        <div className="panel-hd">
          <span className="microlabel">{title}</span>
          {right ?? null}
        </div>
      ) : null}
      <div className={'panel-bd' + (tight ? ' tight' : '')}>{children}</div>
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="microlabel">{label}</span>
      {children}
    </label>
  );
}

export function SevDot({ sev }: { sev: ValidationSeverity }) {
  const cls = sev === 'error' ? 'err' : sev === 'warning' ? 'warn' : 'info';
  return <span className={`dot ${cls}`} aria-hidden />;
}

export function Freshness({ asof, now = new Date() }: { asof: string; now?: Date }) {
  const ts = Date.parse(asof);
  if (Number.isNaN(ts)) {
    return (
      <span className="fresh">
        <span className="dot info" />
        unknown
      </span>
    );
  }
  const ageDays = Math.floor((now.getTime() - ts) / (1000 * 60 * 60 * 24));
  const months = Math.floor(ageDays / 30);
  const cls = months <= 3 ? 'ok' : months <= 9 ? 'warn' : 'err';
  return (
    <span className="fresh" title={`${ageDays} days old`}>
      <span className={`dot ${cls}`} />
      {asof.slice(0, 7)}
    </span>
  );
}
