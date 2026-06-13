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
      <div className="row">
        <span className="dot ok" />
        <span className="note2">{empty}</span>
      </div>
    );
  }
  return (
    <div className="stack-sm">
      {issues.map((i, idx) => (
        <div className="wl-row" key={`${i.code}-${idx}`}>
          <SevDot sev={i.severity} />
          <span className="wl-code">{i.code}</span>
          <span className="note2">{i.message}</span>
        </div>
      ))}
    </div>
  );
}
