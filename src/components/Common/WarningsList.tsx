import type { ValidationIssue, ValidationSeverity } from '../../types/scenario';

const severityStyles: Record<ValidationSeverity, string> = {
  error: 'bg-rose-50 border-rose-300 text-rose-900',
  warning: 'bg-amber-50 border-amber-300 text-amber-900',
  info: 'bg-sky-50 border-sky-300 text-sky-900',
};

const severityIcon: Record<ValidationSeverity, string> = {
  error: 'ERROR',
  warning: 'WARN',
  info: 'INFO',
};

export function WarningsList({ issues, empty = 'No validation issues.' }: { issues: ValidationIssue[]; empty?: string }) {
  if (issues.length === 0) {
    return <p className="text-sm text-emerald-700">✓ {empty}</p>;
  }
  return (
    <ul className="space-y-1">
      {issues.map((i, idx) => (
        <li key={`${i.code}-${idx}`} className={`text-sm rounded border px-2 py-1 ${severityStyles[i.severity]}`}>
          <span className="font-mono text-[10px] uppercase mr-2">{severityIcon[i.severity]}</span>
          <span className="font-mono text-[10px] text-slate-500 mr-2">{i.code}</span>
          {i.message}
        </li>
      ))}
    </ul>
  );
}
