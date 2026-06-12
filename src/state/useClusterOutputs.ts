import { useMemo } from 'react';
import { useWorkspace } from './workspace';
import { useLibrary } from './useLibrary';
import { deriveCluster } from '../calc/cluster';

export interface WaterfallStage {
  label: string;
  note?: string;
  tb: number;
  val: string;
  delta?: string;
}

export interface ClusterOutputs {
  clusterName: string;
  usable: string;
  usableUnit: string;
  raw: string;
  cost: string;
  perTB: string;
  power: string;
  counts: string;
  waterfall: WaterfallStage[];
  hasPool: boolean;
  totalPools: number;
  totalNodes: number;
  totalOsds: number;
  totalRacks: number;
}

function fmtCapacity(bytes: number): { val: string; unit: string } {
  const tb = bytes / 1e12;
  if (tb >= 1000) return { val: (tb / 1000).toFixed(2), unit: 'PB' };
  if (tb >= 1) return { val: tb.toFixed(2), unit: 'TB' };
  return { val: (tb * 1000).toFixed(2), unit: 'GB' };
}

function fmtCapStr(bytes: number): string {
  const { val, unit } = fmtCapacity(bytes);
  return `${val} ${unit}`;
}

function fmtCost(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}k`;
  return `$${usd.toFixed(0)}`;
}

function fmtPower(w: number): string {
  if (w >= 1000) return `${(w / 1000).toFixed(2)} kW`;
  return `${Math.round(w)} W`;
}

export function useClusterOutputs(): ClusterOutputs {
  const { workspace } = useWorkspace();
  const library = useLibrary();
  return useMemo(() => {
    const cluster = workspace.cluster;
    const rackMap = new Map(workspace.racks.map((r) => [r.id, r]));
    const nodeMap = new Map(workspace.nodes.map((n) => [n.id, n]));
    const d = deriveCluster(cluster, rackMap, nodeMap, library);

    const { val: usable, unit: usableUnit } = fmtCapacity(d.total_usable_bytes);
    const usableTb = d.total_usable_bytes / 1e12;
    const perTb = usableTb > 0 ? d.total_cost_usd / usableTb : 0;

    const counts = `${d.total_node_count} nodes · ${d.total_osd_count} OSDs · ${d.total_rack_count} racks · ${cluster.pools.length} pool${cluster.pools.length === 1 ? '' : 's'}`;

    let primary = d.pools[0];
    for (const p of d.pools) if (p.raw_share_bytes > (primary?.raw_share_bytes ?? 0)) primary = p;

    const waterfall: WaterfallStage[] = primary
      ? [
          {
            label: 'Raw share',
            note: `${d.total_osd_count} OSDs`,
            tb: primary.raw_share_bytes / 1e12,
            val: fmtCapStr(primary.raw_share_bytes),
          },
          {
            label: 'After BlueStore',
            note: `−${(cluster.defaults.bluestore_overhead_pct * 100).toFixed(0)}% metadata overhead`,
            tb: primary.after_bluestore_bytes / 1e12,
            val: fmtCapStr(primary.after_bluestore_bytes),
            delta: `${((primary.after_bluestore_bytes / primary.raw_share_bytes) * 100).toFixed(1)}%`,
          },
          {
            label: 'After efficiency',
            note: `${(primary.efficiency * 100).toFixed(1)}% — erasure coding / replication`,
            tb: primary.after_efficiency_bytes / 1e12,
            val: fmtCapStr(primary.after_efficiency_bytes),
            delta: `${((primary.after_efficiency_bytes / primary.raw_share_bytes) * 100).toFixed(1)}%`,
          },
          {
            label: 'Usable',
            note: `× ${cluster.defaults.nearfull_ratio} nearfull — operational ceiling`,
            tb: primary.usable_bytes / 1e12,
            val: fmtCapStr(primary.usable_bytes),
            delta: `${((primary.usable_bytes / primary.raw_share_bytes) * 100).toFixed(1)}%`,
          },
        ]
      : [];

    return {
      clusterName: cluster.name,
      usable,
      usableUnit,
      raw: fmtCapStr(d.total_raw_bytes),
      cost: fmtCost(d.total_cost_usd),
      perTB: usableTb > 0 ? fmtCost(perTb) : '—',
      power: fmtPower(d.total_power_typical_w),
      counts,
      waterfall,
      hasPool: cluster.pools.length > 0,
      totalPools: cluster.pools.length,
      totalNodes: d.total_node_count,
      totalOsds: d.total_osd_count,
      totalRacks: d.total_rack_count,
    };
  }, [workspace, library]);
}
