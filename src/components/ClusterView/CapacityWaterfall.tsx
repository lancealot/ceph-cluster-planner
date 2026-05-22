import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import type { ClusterDerived } from '../../calc/cluster';
import type { PoolConfig } from '../../types/cluster';
import { format_bytes } from '../../calc/units';
import { useTheme } from '../../state/theme';

interface Props {
  derived: ClusterDerived;
  pools: PoolConfig[];
}

const colors = ['#0ea5e9', '#3b82f6', '#6366f1', '#10b981'];

export function CapacityWaterfall({ derived, pools }: Props) {
  const { theme } = useTheme();
  const gridStroke = theme === 'dark' ? '#334155' : '#e2e8f0';
  const axisStroke = theme === 'dark' ? '#cbd5e1' : '#475569';
  const tooltipStyle = theme === 'dark'
    ? { backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f1f5f9' }
    : undefined;
  if (pools.length === 0 || derived.pools.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-3 text-sm text-slate-500 dark:text-slate-400">
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
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-3">
      <h4 className="text-sm font-semibold mb-2">Capacity waterfall — {poolMeta?.name ?? pool.pool_id}</h4>
      <div style={{ width: '100%', height: 220 }} aria-label="Capacity waterfall chart">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke={gridStroke} />
            <XAxis type="number" tickFormatter={(v: number) => format_bytes(v)} stroke={axisStroke} />
            <YAxis type="category" dataKey="stage" width={170} stroke={axisStroke} />
            <Tooltip formatter={(v: number) => format_bytes(v)} contentStyle={tooltipStyle} />
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
