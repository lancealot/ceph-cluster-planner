import type { ClusterDerived } from '../../calc/cluster';
import type { PoolConfig } from '../../types/cluster';
import { bytes_to_tb, format_bytes, format_power, format_usd } from '../../calc/units';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-900">{value}</div>
      {hint ? <div className="text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function OutputsPanel({ derived, pools }: { derived: ClusterDerived; pools: PoolConfig[] }) {
  const usableTb = bytes_to_tb(derived.total_usable_bytes);
  const dollarsPerTb = usableTb > 0 ? derived.total_cost_usd / usableTb : 0;
  const wPerTb = usableTb > 0 ? derived.total_power_typical_w / usableTb : 0;

  return (
    <div className="bg-white border rounded p-3 space-y-3">
      <h4 className="text-sm font-semibold">Cluster outputs</h4>
      <div className="grid grid-cols-4 gap-3">
        <Stat label="Racks" value={`${derived.total_rack_count}`} />
        <Stat label="Nodes" value={`${derived.total_node_count}`} />
        <Stat label="OSDs" value={`${derived.total_osd_count}`} hint={`${derived.total_hdd_osd_count} HDD · ${derived.total_nvme_osd_count} NVMe`} />
        <Stat label="Raw capacity" value={format_bytes(derived.total_raw_bytes)} hint={`${format_bytes(derived.total_hdd_raw_bytes)} HDD`} />
        <Stat label="Usable (all pools)" value={format_bytes(derived.total_usable_bytes)} />
        <Stat label="Cost" value={format_usd(derived.total_cost_usd)} />
        <Stat label="Power (typ)" value={format_power(derived.total_power_typical_w)} hint={`max ${format_power(derived.total_power_max_w)}`} />
        <Stat label="$ / TB usable" value={usableTb > 0 ? format_usd(dollarsPerTb) : '—'} />
      </div>
      {pools.length > 0 ? (
        <div>
          <h5 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Per-pool usable</h5>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left">
              <tr>
                <th className="px-2 py-1">Pool</th>
                <th className="px-2 py-1">Type</th>
                <th className="px-2 py-1">Tier</th>
                <th className="px-2 py-1">Share</th>
                <th className="px-2 py-1">Efficiency</th>
                <th className="px-2 py-1 text-right">Usable</th>
              </tr>
            </thead>
            <tbody>
              {pools.map((p) => {
                const pd = derived.pools.find((x) => x.pool_id === p.id);
                if (!pd) return null;
                return (
                  <tr key={p.id} className="border-t">
                    <td className="px-2 py-1">{p.name}</td>
                    <td className="px-2 py-1">{p.type === 'ec' ? `EC ${p.k}+${p.m}` : `replica ×${p.replicas}`}</td>
                    <td className="px-2 py-1">{p.target_tier ?? '—'}</td>
                    <td className="px-2 py-1">{(p.capacity_share * 100).toFixed(1)}%</td>
                    <td className="px-2 py-1">{(pd.efficiency * 100).toFixed(1)}%</td>
                    <td className="px-2 py-1 text-right">{format_bytes(pd.usable_bytes)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {usableTb > 0 ? (
        <p className="text-xs text-slate-500">
          {format_power(wPerTb)} per TB usable typical · {format_bytes(derived.total_raw_bytes)} raw → {format_bytes(derived.total_usable_bytes)} usable across all pools.
        </p>
      ) : null}
    </div>
  );
}
