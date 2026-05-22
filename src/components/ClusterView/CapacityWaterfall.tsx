import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import type { ClusterDerived } from '../../calc/cluster';
import type { PoolConfig } from '../../types/cluster';
import { format_bytes } from '../../calc/units';

interface Props {
  derived: ClusterDerived;
  pools: PoolConfig[];
}

const colors = ['#0ea5e9', '#3b82f6', '#6366f1', '#10b981'];

export function CapacityWaterfall({ derived, pools }: Props) {
  if (pools.length === 0 || derived.pools.length === 0) {
    return (
      <div className="bg-white border rounded p-3 text-sm text-slate-500">
        Add a pool to see the capacity waterfall.
      </div>
    );
  }

  let pool = derived.pools[0];
  for (const p of derived.pools) {
    if (p.raw_share_bytes > pool.raw_share_bytes) pool = p;
  }
  const poolMeta = pools.find((p) => p.id === pool.pool_id);

  const data = [
    { stage: 'Raw share', bytes: pool.raw_share_bytes },
    { stage: 'After BlueStore (−1%)', bytes: pool.after_bluestore_bytes },
    { stage: `After ${poolMeta?.type === 'ec' ? `EC ${poolMeta.k}+${poolMeta.m}` : `×${poolMeta?.replicas} replica`}`, bytes: pool.after_efficiency_bytes },
    { stage: 'Usable (nearfull)', bytes: pool.usable_bytes },
  ];

  return (
    <div className="bg-white border rounded p-3">
      <h4 className="text-sm font-semibold mb-2">Capacity waterfall — {poolMeta?.name ?? pool.pool_id}</h4>
      <div style={{ width: '100%', height: 220 }} aria-label="Capacity waterfall chart">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" tickFormatter={(v: number) => format_bytes(v)} />
            <YAxis type="category" dataKey="stage" width={170} />
            <Tooltip formatter={(v: number) => format_bytes(v)} />
            <Bar dataKey="bytes" isAnimationActive={false}>
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
