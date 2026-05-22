import type { ValidationIssue, ValidationSeverity } from '../../types/scenario';

const severityStyles: Record<ValidationSeverity, string> = {
  error: 'bg-rose-50 dark:bg-rose-900/20 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200',
  warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200',
  info: 'bg-sky-50 dark:bg-sky-900/20 border-sky-300 dark:border-sky-700 text-sky-900 dark:text-sky-200',
};

const severityIcon: Record<ValidationSeverity, string> = {
  error: 'ERROR',
  warning: 'WARN',
  info: 'INFO',
};

export function WarningsList({ issues, empty = 'No validation issues.' }: { issues: ValidationIssue[]; empty?: string }) {
  if (issues.length === 0) {
    return <p className="text-sm text-emerald-700 dark:text-emerald-300">✓ {empty}</p>;
  }
  return (
    <ul className="space-y-1">
      {issues.map((i, idx) => (
        <li key={`${i.code}-${idx}`} className={`text-sm rounded border px-2 py-1 ${severityStyles[i.severity]}`}>
          <span className="font-mono text-[10px] uppercase mr-2">{severityIcon[i.severity]}</span>
          <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 mr-2">{i.code}</span>
          {i.message}
        </li>
      ))}
    </ul>
  );
}
