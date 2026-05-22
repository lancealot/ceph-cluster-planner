interface Props {
  date: string;
  now?: Date;
}

const DAY_MS = 1000 * 60 * 60 * 24;

export function FreshnessChip({ date, now = new Date() }: Props) {
  const ts = Date.parse(date);
  if (Number.isNaN(ts)) {
    return <span className="text-xs px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">unknown</span>;
  }
  const ageDays = Math.floor((now.getTime() - ts) / DAY_MS);
  const tier = ageDays < 90 ? 'fresh' : ageDays < 180 ? 'aging' : 'stale';
  const cls =
    tier === 'fresh'
      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300'
      : tier === 'aging'
      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
      : 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300';
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${cls}`} title={`as-of ${date} (${ageDays} days ago)`}>
      {date}
    </span>
  );
}
