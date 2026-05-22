interface Props {
  date: string;
  now?: Date;
}

const DAY_MS = 1000 * 60 * 60 * 24;

export function FreshnessChip({ date, now = new Date() }: Props) {
  const ts = Date.parse(date);
  if (Number.isNaN(ts)) {
    return <span className="text-xs px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">unknown</span>;
  }
  const ageDays = Math.floor((now.getTime() - ts) / DAY_MS);
  const tier = ageDays < 90 ? 'fresh' : ageDays < 180 ? 'aging' : 'stale';
  const cls =
    tier === 'fresh'
      ? 'bg-emerald-100 text-emerald-800'
      : tier === 'aging'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-rose-100 text-rose-800';
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${cls}`} title={`as-of ${date} (${ageDays} days ago)`}>
      {date}
    </span>
  );
}
