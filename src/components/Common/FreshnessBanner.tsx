import { useMemo } from 'react';
import { useLibrary } from '../../state/useLibrary';

const DAY_MS = 1000 * 60 * 60 * 24;

export function FreshnessBanner({ now = new Date() }: { now?: Date } = {}) {
  const library = useLibrary();
  const stats = useMemo(() => {
    let fresh = 0;
    let aging = 0;
    let stale = 0;
    let oldestDays = 0;
    for (const c of Object.values(library)) {
      const ts = Date.parse(c.as_of_date);
      if (Number.isNaN(ts)) continue;
      const age = Math.floor((now.getTime() - ts) / DAY_MS);
      if (age > oldestDays) oldestDays = age;
      if (age < 90) fresh++;
      else if (age < 180) aging++;
      else stale++;
    }
    return { fresh, aging, stale, oldestDays, total: fresh + aging + stale };
  }, [library, now]);

  if (stats.total === 0) return null;

  const tone =
    stats.stale > 0
      ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 text-rose-900 dark:text-rose-200'
      : stats.aging > 0
      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 text-amber-900 dark:text-amber-200'
      : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 text-emerald-900 dark:text-emerald-200';

  return (
    <div className={`border rounded p-2 text-sm ${tone}`}>
      <strong>Library freshness:</strong>{' '}
      {stats.fresh} fresh (&lt; 90d) · {stats.aging} aging (90–180d) · {stats.stale} stale (&gt; 180d) ·
      oldest {stats.oldestDays} days. Prices are reference-only and should be checked against current
      vendor quotes before procurement.
    </div>
  );
}
