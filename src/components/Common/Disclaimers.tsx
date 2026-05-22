export const DISCLAIMERS = [
  'Pricing reflects approximate public list prices at each component\'s as-of date; actual quotes vary by vendor, region, and volume.',
  'Power numbers are derived from datasheet typical/max ratings, not measured draw; real-world consumption depends on workload, ambient temperature, and PSU efficiency at load.',
  'Capacity uses decimal TB (10^12 bytes). Usable values include BlueStore overhead, EC/replication efficiency, and the configured nearfull ratio — they do not reflect Ceph internal metadata, OMAP growth, or RGW overhead, all of which can reduce usable capacity further.',
  'Validation rules surface common pitfalls but are not exhaustive. Treat warnings as prompts to investigate, not as a substitute for vendor sizing guidance, Ceph upstream documentation, or your own operational runbooks.',
];

export function Disclaimers() {
  return (
    <details className="text-xs text-slate-600 dark:text-slate-400">
      <summary className="cursor-pointer text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 font-medium">
        Disclaimers (read before procurement)
      </summary>
      <ol className="list-decimal pl-5 mt-1 space-y-1">
        {DISCLAIMERS.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ol>
    </details>
  );
}
