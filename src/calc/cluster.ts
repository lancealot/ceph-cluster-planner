import type { NodeConfig } from '../types/node';
import type { RackConfig } from '../types/rack';
import type { ClusterConfig, PoolConfig, DeviceTier } from '../types/cluster';
import type { ComponentLibrary } from '../types/components';
import { deriveNode } from './node';
import { deriveRack } from './rack';

export interface PoolDerived {
  pool_id: string;
  effective_size: number;
  efficiency: number;
  raw_share_bytes: number;
  after_bluestore_bytes: number;
  after_efficiency_bytes: number;
  usable_bytes: number;
}

interface ClusterTotals {
  total_raw_bytes: number;
  total_hdd_raw_bytes: number;
  total_nvme_raw_bytes: number;
  total_osd_count: number;
  total_hdd_osd_count: number;
  total_nvme_osd_count: number;
  total_node_count: number;
  total_host_count: number;
  // Hosts that have at least one OSD of the named class. A tier=nvme pool
  // with host failure-domain should be sized against the nvme host count,
  // not the total — HDD-only hosts can't take its placement groups.
  total_hdd_host_count: number;
  total_nvme_host_count: number;
  total_rack_count: number;
  total_power_typical_w: number;
  total_power_max_w: number;
  total_cost_usd: number;
}

export interface ClusterDerived extends ClusterTotals {
  pools: PoolDerived[];
  total_usable_bytes: number;
}

export function poolEfficiency(pool: PoolConfig): {
  efficiency: number;
  effective_size: number;
} {
  if (pool.type === 'replicated') {
    const replicas = Math.max(1, pool.replicas ?? 3);
    return { efficiency: 1 / replicas, effective_size: replicas };
  }
  const k = Math.max(1, pool.k ?? 8);
  const m = Math.max(1, pool.m ?? 3);
  return { efficiency: k / (k + m), effective_size: k + m };
}

function rawForTier(totals: ClusterTotals, tier: DeviceTier | undefined): number {
  if (!tier) return totals.total_raw_bytes;
  if (tier === 'hdd') return totals.total_hdd_raw_bytes;
  return totals.total_nvme_raw_bytes;
}

export function deriveCluster(
  cluster: ClusterConfig,
  rackMap: Map<string, RackConfig>,
  nodeMap: Map<string, NodeConfig>,
  library: ComponentLibrary
): ClusterDerived {
  let totalRaw = 0;
  let totalHddRaw = 0;
  let totalNvmeRaw = 0;
  let totalOsd = 0;
  let totalHddOsd = 0;
  let totalNvmeOsd = 0;
  let totalNodes = 0;
  let totalHddHosts = 0;
  let totalNvmeHosts = 0;
  let totalRacks = 0;
  let totalPowerTyp = 0;
  let totalPowerMax = 0;
  let totalCost = 0;

  for (const rackSlot of cluster.racks) {
    const rack = rackMap.get(rackSlot.rack_config_id);
    if (!rack) continue;
    totalRacks += rackSlot.count;
    const rd = deriveRack(rack, nodeMap, library, cluster.defaults);
    totalNodes += rd.node_count * rackSlot.count;
    totalPowerTyp += rd.power_typical_w * rackSlot.count;
    totalPowerMax += rd.power_max_w * rackSlot.count;
    totalCost += rd.cost_usd * rackSlot.count;
    for (const ns of rack.nodes) {
      const node = nodeMap.get(ns.node_config_id);
      if (!node) continue;
      const nd = deriveNode(node, library, cluster.defaults);
      const factor = ns.count * rackSlot.count;
      totalRaw += nd.raw_capacity_bytes * factor;
      totalHddRaw += nd.hdd_raw_capacity_bytes * factor;
      totalNvmeRaw += nd.nvme_raw_capacity_bytes * factor;
      totalOsd += nd.osd_count * factor;
      totalHddOsd += nd.hdd_osd_count * factor;
      totalNvmeOsd += nd.nvme_osd_count * factor;
      if (nd.hdd_osd_count > 0) totalHddHosts += factor;
      if (nd.nvme_osd_count > 0) totalNvmeHosts += factor;
    }
  }

  const totals: ClusterTotals = {
    total_raw_bytes: totalRaw,
    total_hdd_raw_bytes: totalHddRaw,
    total_nvme_raw_bytes: totalNvmeRaw,
    total_osd_count: totalOsd,
    total_hdd_osd_count: totalHddOsd,
    total_nvme_osd_count: totalNvmeOsd,
    total_node_count: totalNodes,
    total_host_count: totalNodes,
    total_hdd_host_count: totalHddHosts,
    total_nvme_host_count: totalNvmeHosts,
    total_rack_count: totalRacks,
    total_power_typical_w: totalPowerTyp,
    total_power_max_w: totalPowerMax,
    total_cost_usd: totalCost,
  };

  const pools: PoolDerived[] = cluster.pools.map((pool) => {
    const { efficiency, effective_size } = poolEfficiency(pool);
    const tierRaw = rawForTier(totals, pool.target_tier);
    const share = Math.max(0, Math.min(1, pool.capacity_share));
    const rawShare = tierRaw * share;
    const afterBlue = rawShare * (1 - cluster.defaults.bluestore_overhead_pct);
    const afterEff = afterBlue * efficiency;
    const usable = afterEff * cluster.defaults.nearfull_ratio;
    return {
      pool_id: pool.id,
      effective_size,
      efficiency,
      raw_share_bytes: rawShare,
      after_bluestore_bytes: afterBlue,
      after_efficiency_bytes: afterEff,
      usable_bytes: usable,
    };
  });

  return {
    ...totals,
    pools,
    total_usable_bytes: pools.reduce((s, p) => s + p.usable_bytes, 0),
  };
}
