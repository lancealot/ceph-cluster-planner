import type { ValidationIssue } from '../../types/scenario';
import { SevDot } from '../Shell/primitives';

export function WarningsList({
  issues,
  empty = 'No validation issues.',
}: {
  issues: ValidationIssue[];
  empty?: string;
}) {
  if (issues.length === 0) {
    return (
      <div className="row" style={{ gap: 8 }}>
        <span className="dot ok" />
        <span style={{ fontSize: '12.5px', color: 'var(--text2)' }}>{empty}</span>
      </div>
    );
  }
  return (
    <div className="stack-sm">
      {issues.map((i, idx) => (
        <div className="row" key={`${i.code}-${idx}`} style={{ gap: 10, alignItems: 'baseline' }}>
          <SevDot sev={i.severity} />
          <span className="mono" style={{ fontSize: '10.5px', color: 'var(--text3)', minWidth: 200 }}>
            {i.code}
          </span>
          <span style={{ fontSize: '12.5px', color: 'var(--text2)' }}>{i.message}</span>
        </div>
      ))}
    </div>
  );
}
